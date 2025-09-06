import React, { useState, useEffect } from 'react';
import MermaidExporter, { ChartConfig, ExportFormat } from './MermaidExporter';
import { 
  convertCallRelationsToMermaid, 
  CHART_CONFIGS, 
  generateArchitectureDiagram,
  generateQualityAnalysisChart,
  validateMermaidSyntax 
} from '../utils/mermaidUtils';
import { CallRelation, Repo, PackageNode, FileNode, Function as CodeFunction } from '../types';
import { fetchFunctionCalls, getRepoTree, viewFileContent, listRepos, getRepo } from '../services/api';
import './MermaidTest.css';

interface MermaidTestProps {
  selectedRepoId?: string;
  selectedFunctionId?: string;
  onChartGenerated?: (chartType: string, mermaidCode: string) => void;
}

const MermaidTest: React.FC<MermaidTestProps> = ({ 
  selectedRepoId, 
  selectedFunctionId,
  onChartGenerated 
}) => {
  const [selectedChartType, setSelectedChartType] = useState<string>('flowchart');
  const [customMermaidCode, setCustomMermaidCode] = useState<string>('');
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; error?: string } | null>(null);
  
  // 代码库数据状态
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [repoTree, setRepoTree] = useState<{ packages: PackageNode[]; files: FileNode[] } | null>(null);
  const [callRelations, setCallRelations] = useState<CallRelation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 新增：文件和函数选择状态
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<CodeFunction | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileFunctions, setFileFunctions] = useState<CodeFunction[]>([]);

  // 初始化时加载仓库列表
  useEffect(() => {
    loadRepos();
  }, []);

  // 当selectedRepoId变化时加载对应仓库数据
  useEffect(() => {
    if (selectedRepoId) {
      loadRepoData(selectedRepoId);
    }
  }, [selectedRepoId]);

  // 当selectedFunctionId变化时加载调用关系
  useEffect(() => {
    if (selectedFunctionId && selectedRepoId) {
      loadCallRelations(selectedFunctionId);
    }
  }, [selectedFunctionId, selectedRepoId]);

  // 加载仓库列表
  const loadRepos = async () => {
    try {
      const response = await listRepos();
      setRepos(response.body.repo || []);
    } catch (error) {
      console.error('加载仓库列表失败:', error);
      setError('加载仓库列表失败');
    }
  };

  // 加载仓库数据
  const loadRepoData = async (repoId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 获取仓库信息
      const repoData = await getRepo(repoId);
      setSelectedRepo(repoData.body.repo);

      // 获取仓库树结构
      const treeData = await getRepoTree(repoId);
      setRepoTree(treeData.body);
    } catch (error) {
      setError('加载仓库数据失败');
      console.error('加载仓库数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载调用关系
  const loadCallRelations = async (functionId: string) => {
    try {
      const relations = await fetchFunctionCalls(functionId);
      setCallRelations(relations);
    } catch (error) {
      console.error('加载调用关系失败:', error);
      setCallRelations([]);
    }
  };

  // 根据选择的图表类型生成Mermaid代码
  const generateMermaidCode = (): string => {
    switch (selectedChartType) {
      case 'flowchart':
        return callRelations.length > 0 
          ? convertCallRelationsToMermaid(callRelations, 'flowchart')
          : generateEmptyFlowchart();
      case 'sequence':
        return callRelations.length > 0 
          ? convertCallRelationsToMermaid(callRelations, 'sequence')
          : generateEmptySequence();
      case 'architecture':
        return repoTree 
          ? generateArchitectureDiagram(
              repoTree.packages.map(p => ({ name: p.name, files: [] })), 
              []
            )
          : generateEmptyArchitecture();
      case 'quality':
        return generateQualityAnalysisChart([
          { name: '代码覆盖率', value: 85, max: 100 },
          { name: '复杂度', value: 3, max: 10 },
          { name: '重复率', value: 5, max: 100 },
          { name: '文档完整性', value: 90, max: 100 }
        ]);
      case 'custom':
        return customMermaidCode;
      default:
        return callRelations.length > 0 
          ? convertCallRelationsToMermaid(callRelations, 'flowchart')
          : generateEmptyFlowchart();
    }
  };

  // 生成空图表
  const generateEmptyFlowchart = () => `flowchart TD
    A[开始] --> B{是否有数据}
    B -->|否| C[请选择代码库和函数]
    B -->|是| D[生成调用流程图]
    C --> E[结束]
    D --> E`;

  const generateEmptySequence = () => `sequenceDiagram
    participant User
    participant System
    
    Note over User,System: 请选择代码库和函数来生成调用序列图`;

  const generateEmptyArchitecture = () => `flowchart TD
    A[代码架构] --> B{是否已加载}
    B -->|否| C[请先选择代码库]
    B -->|是| D[显示包结构]
    C --> E[结束]
    D --> E`;

  // 获取图表配置
  const getChartConfig = (): ChartConfig => {
    const baseConfig = CHART_CONFIGS.FUNCTION_CALL;
    
    switch (selectedChartType) {
      case 'flowchart':
        return { 
          ...baseConfig, 
          title: `函数调用流程图 - ${selectedRepo?.name || '未选择仓库'}`, 
          description: callRelations.length > 0 
            ? `展示 ${callRelations.length} 个函数之间的调用关系`
            : '请选择代码库和函数来生成调用流程图',
          mermaidCode: generateMermaidCode()
        };
      case 'sequence':
        return { 
          ...baseConfig, 
          title: `调用序列图 - ${selectedRepo?.name || '未选择仓库'}`, 
          description: callRelations.length > 0 
            ? `展示函数调用的时序关系`
            : '请选择代码库和函数来生成调用序列图',
          mermaidCode: generateMermaidCode()
        };
      case 'architecture':
        return { 
          ...baseConfig, 
          title: `代码架构图 - ${selectedRepo?.name || '未选择仓库'}`, 
          description: repoTree 
            ? `展示包结构和依赖关系，包含 ${repoTree.packages.length} 个包和 ${repoTree.files.length} 个文件`
            : '请先选择代码库来查看架构图',
          mermaidCode: generateMermaidCode()
        };
      case 'quality':
        return { 
          ...baseConfig, 
          title: `代码质量分析 - ${selectedRepo?.name || '未选择仓库'}`, 
          description: '展示代码质量指标和评估结果',
          mermaidCode: generateMermaidCode()
        };
      case 'custom':
        return { 
          ...baseConfig, 
          title: `自定义图表 - ${selectedRepo?.name || '未选择仓库'}`, 
          description: '用户自定义的Mermaid图表',
          mermaidCode: customMermaidCode || generateMermaidCode()
        };
      default:
        return {
          ...baseConfig,
          title: `图表 - ${selectedRepo?.name || '未选择仓库'}`,
          description: '请选择图表类型',
          mermaidCode: generateMermaidCode()
        };
    }
  };

  // 验证自定义Mermaid代码
  const handleValidateCode = () => {
    if (customMermaidCode.trim()) {
      const result = validateMermaidSyntax(customMermaidCode);
      setValidationResult(result);
    } else {
      setValidationResult({ isValid: false, error: '请输入Mermaid代码' });
    }
  };

  // 处理导出
  const handleExport = (format: ExportFormat, data: string) => {
    console.log(`导出${format}格式的图表:`, data);
    onChartGenerated?.(selectedChartType, data);
  };

  // 处理仓库选择
  const handleRepoSelect = (repoId: string) => {
    loadRepoData(repoId);
  };

  // 处理文件选择
  const handleFileSelect = async (file: FileNode) => {
    setSelectedFile(file);
    setSelectedFunction(null);
    
    try {
      // 获取文件内容
      const fileData = await viewFileContent(selectedRepoId!, file.id);
      setFileContent(fileData.body.Content);
      setFileFunctions(fileData.body.functions);
      
      // 如果有函数，自动选择第一个
      if (fileData.body.functions.length > 0) {
        setSelectedFunction(fileData.body.functions[0]);
        // 加载该函数的调用关系
        await loadCallRelations(fileData.body.functions[0].id);
      }
    } catch (error) {
      console.error('加载文件内容失败:', error);
      setError('加载文件内容失败');
    }
  };

  // 处理函数选择
  const handleFunctionSelect = async (func: CodeFunction) => {
    setSelectedFunction(func);
    // 加载该函数的调用关系
    await loadCallRelations(func.id);
  };

  // 预设的Mermaid代码示例
  const presetExamples = {
    flowchart: `flowchart TD
    A[开始] --> B{条件判断}
    B -->|是| C[处理A]
    B -->|否| D[处理B]
    C --> E[结束]
    D --> E`,
    
    sequence: `sequenceDiagram
    participant User
    participant System
    participant Database
    
    User->>System: 发送请求
    System->>Database: 查询数据
    Database-->>System: 返回结果
    System-->>User: 响应请求`,
    
    class: `classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +bark()
    }
    class Cat {
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
    
    er: `erDiagram
    USER {
        string id
        string name
        string email
    }
    POST {
        string id
        string title
        string content
        string userId
    }
    USER ||--o{ POST : creates`
  };

  // 加载预设示例
  const loadPresetExample = (type: string) => {
    if (presetExamples[type as keyof typeof presetExamples]) {
      setCustomMermaidCode(presetExamples[type as keyof typeof presetExamples]);
      setSelectedChartType('custom');
    }
  };

  return (
    <div className="mermaid-test">
      <div className="test-header">
        <h1>🎨 Mermaid图表测试与导出</h1>
        <p>基于代码库数据生成各种Mermaid图表，并体验导出功能</p>
      </div>

      {/* 代码库选择 */}
      <div className="repo-selector">
        <h3>选择代码库</h3>
        <div className="repo-list">
          {repos.map(repo => (
            <button
              key={repo.id}
              className={`repo-btn ${selectedRepo?.id === repo.id ? 'active' : ''}`}
              onClick={() => handleRepoSelect(repo.id)}
            >
              📁 {repo.name}
            </button>
          ))}
        </div>
        {selectedRepo && (
          <div className="repo-info">
            <p><strong>当前仓库:</strong> {selectedRepo.name}</p>
            <p><strong>类型:</strong> {selectedRepo.repoType}</p>
            <p><strong>语言:</strong> {selectedRepo.language}</p>
          </div>
        )}
      </div>

      {/* 图表类型选择 */}
      <div className="chart-type-selector">
        <h3>选择图表类型</h3>
        <div className="type-buttons">
          <button
            className={`type-btn ${selectedChartType === 'flowchart' ? 'active' : ''}`}
            onClick={() => setSelectedChartType('flowchart')}
            disabled={!selectedRepo}
          >
            📊 流程图
          </button>
          <button
            className={`type-btn ${selectedChartType === 'sequence' ? 'active' : ''}`}
            onClick={() => setSelectedChartType('sequence')}
            disabled={!selectedRepo}
          >
            ⏱️ 序列图
          </button>
          <button
            className={`type-btn ${selectedChartType === 'architecture' ? 'active' : ''}`}
            onClick={() => setSelectedChartType('architecture')}
            disabled={!selectedRepo}
          >
            🏗️ 架构图
          </button>
          <button
            className={`type-btn ${selectedChartType === 'quality' ? 'active' : ''}`}
            onClick={() => setSelectedChartType('quality')}
            disabled={!selectedRepo}
          >
            📈 质量分析
          </button>
          <button
            className={`type-btn ${selectedChartType === 'custom' ? 'active' : ''}`}
            onClick={() => setSelectedChartType('custom')}
          >
            ✏️ 自定义
          </button>
        </div>
      </div>

      {/* 数据状态显示 */}
      {selectedRepo && (
        <div className="data-status">
          <h3>数据状态</h3>
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">仓库树:</span>
              <span className={`status-value ${repoTree ? 'loaded' : 'loading'}`}>
                {repoTree ? `已加载 (${repoTree.packages.length}包, ${repoTree.files.length}文件)` : '加载中...'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">调用关系:</span>
              <span className={`status-value ${callRelations.length > 0 ? 'loaded' : 'empty'}`}>
                {callRelations.length > 0 ? `已加载 (${callRelations.length}个关系)` : '未选择函数'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">选中文件:</span>
              <span className={`status-value ${selectedFile ? 'loaded' : 'empty'}`}>
                {selectedFile ? selectedFile.name : '未选择'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">选中函数:</span>
              <span className={`status-value ${selectedFunction ? 'loaded' : 'empty'}`}>
                {selectedFunction ? selectedFunction.name : '未选择'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 文件选择器 */}
      {selectedRepo && repoTree && (
        <div className="file-selector">
          <h3>选择文件和函数</h3>
          <div className="file-tree">
            {repoTree.packages.map(pkg => (
              <div key={pkg.id} className="package-item">
                <div className="package-header">
                  <span className="package-icon">📁</span>
                  <span className="package-name">{pkg.name}</span>
                </div>
                <div className="package-files">
                  {repoTree.files
                    .filter(file => file.pkgId === pkg.id)
                    .map(file => (
                      <div 
                        key={file.id} 
                        className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                        onClick={() => handleFileSelect(file)}
                      >
                        <span className="file-icon">📄</span>
                        <span className="file-name">{file.name}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 函数选择器 */}
      {selectedFile && fileFunctions.length > 0 && (
        <div className="function-selector">
          <h3>选择函数</h3>
          <div className="function-list">
            {fileFunctions.map(func => (
              <button
                key={func.id}
                className={`function-btn ${selectedFunction?.id === func.id ? 'active' : ''}`}
                onClick={() => handleFunctionSelect(func)}
              >
                <span className="function-icon">⚡</span>
                <span className="function-name">{func.name}</span>
                {func.receiver && (
                  <span className="function-receiver">({func.receiver})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 自定义代码编辑器 */}
      {selectedChartType === 'custom' && (
        <div className="custom-code-editor">
          <h3>自定义Mermaid代码</h3>
          <div className="editor-controls">
            <button onClick={() => loadPresetExample('flowchart')}>加载流程图示例</button>
            <button onClick={() => loadPresetExample('sequence')}>加载序列图示例</button>
            <button onClick={() => loadPresetExample('class')}>加载类图示例</button>
            <button onClick={() => loadPresetExample('er')}>加载ER图示例</button>
            <button onClick={handleValidateCode} className="validate-btn">验证代码</button>
          </div>
          
          <textarea
            value={customMermaidCode}
            onChange={(e) => setCustomMermaidCode(e.target.value)}
            placeholder="输入Mermaid代码..."
            rows={10}
            className="mermaid-code-input"
          />
          
          {validationResult && (
            <div className={`validation-result ${validationResult.isValid ? 'valid' : 'invalid'}`}>
              {validationResult.isValid ? '✅ 代码语法正确' : `❌ ${validationResult.error}`}
            </div>
          )}
        </div>
      )}

      {/* 错误显示 */}
      {error && (
        <div className="error-message">
          <span>❌ {error}</span>
        </div>
      )}

      {/* Mermaid导出组件 */}
      <MermaidExporter
        chartConfig={getChartConfig()}
        onExport={handleExport}
      />

      {/* 功能说明 */}
      <div className="feature-description">
        <h3>🚀 功能特性</h3>
        <div className="features-grid">
          <div className="feature-item">
            <h4>📊 多种图表类型</h4>
            <p>支持流程图、序列图、类图、ER图、甘特图等多种图表类型</p>
          </div>
          <div className="feature-item">
            <h4>💾 多格式导出</h4>
            <p>支持SVG、PNG、PDF等多种导出格式，满足不同使用场景</p>
          </div>
          <div className="feature-item">
            <h4>🎨 主题定制</h4>
            <p>支持多种主题，包括默认、森林、暗色、中性等主题</p>
          </div>
          <div className="feature-item">
            <h4>📱 响应式设计</h4>
            <p>支持桌面和移动设备，提供良好的用户体验</p>
          </div>
          <div className="feature-item">
            <h4>🔧 代码验证</h4>
            <p>内置Mermaid语法验证，确保图表正确渲染</p>
          </div>
          <div className="feature-item">
            <h4>👁️ 实时预览</h4>
            <p>支持在新窗口中预览图表，方便查看和分享</p>
          </div>
          <div className="feature-item">
            <h4>🔗 代码库联动</h4>
            <p>基于真实代码库数据生成图表，支持多种代码分析</p>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="usage-instructions">
        <h3>📖 使用说明</h3>
        <ol>
          <li><strong>选择代码库</strong>：从可用的代码库中选择要分析的仓库</li>
          <li><strong>选择图表类型</strong>：从预设的图表类型中选择，或使用自定义模式</li>
          <li><strong>生成图表</strong>：基于选择的代码库数据自动生成相应的图表</li>
          <li><strong>编辑图表代码</strong>：在自定义模式下，可以编辑Mermaid代码</li>
          <li><strong>配置导出选项</strong>：设置导出格式、文件名、尺寸和背景色</li>
          <li><strong>导出图表</strong>：点击导出按钮，选择保存位置</li>
          <li><strong>复制代码</strong>：可以复制Mermaid代码到其他工具中使用</li>
          <li><strong>预览图表</strong>：在新窗口中预览图表效果</li>
        </ol>
      </div>
    </div>
  );
};

export default MermaidTest;
