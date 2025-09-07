import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import MermaidErrorBoundary from './MermaidErrorBoundary';
import './SequenceDiagramGenerator.css';

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  type: string;
  scope: string;
  size?: number;
  complexity?: 'low' | 'medium' | 'high';
  lastModified?: string;
  functions: string[];
  description?: string;
}

export interface CallRelation {
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  calleeFileId: string;
  callerFileId: string;
  calleeScope: string;
  callerScope: string;
  calleeEntityId: string;
  callerEntityId: string;
}

export interface SequenceDiagramConfig {
  title: string;
  description: string;
  participants: string[];
  messages: Array<{
    from: string;
    to: string;
    message: string;
    type?: 'request' | 'response' | 'note';
  }>;
}

export interface CallGraphConfig {
  title: string;
  description: string;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    scope: string;
    functions: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string;
    type: 'call' | 'dependency' | 'import';
  }>;
}

interface SequenceDiagramGeneratorProps {
  onGenerate?: (config: SequenceDiagramConfig) => void;
  onExport?: (format: 'svg' | 'png' | 'pdf', data: string) => void;
}

const SequenceDiagramGenerator: React.FC<SequenceDiagramGeneratorProps> = ({ 
  onGenerate, 
  onExport 
}) => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set());
  const [filteredFiles, setFilteredFiles] = useState<FileInfo[]>([]);
  const [filteredFunctions, setFilteredFunctions] = useState<Array<{name: string, file: string, path: string}>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [maxResults, setMaxResults] = useState(100);
  const [searchMode, setSearchMode] = useState<'contains' | 'startsWith' | 'regex'>('contains');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDiagram, setGeneratedDiagram] = useState<SequenceDiagramConfig | null>(null);
  const [generatedCallGraph, setGeneratedCallGraph] = useState<CallGraphConfig | null>(null);
  const [mermaidCode, setMermaidCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<'sequence' | 'callgraph'>('sequence');

  // 模拟数据 - 实际使用时应该从API获取
  const mockData: { files: FileInfo[], callRelations: CallRelation[] } = {
    files: [
      {
        id: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@controllers@AssignVm.go",
        name: "AssignVm.go",
        path: "vm-manager/controllers/AssignVm.go",
        type: ".go",
        scope: "controllers",
        size: 45,
        complexity: "medium",
        lastModified: "2024-01-15",
        functions: ["AssignVm", "DoLockAssignVm", "parseAssignVmParam"],
        description: "VM分配控制器，处理VM分配请求"
      },
      {
        id: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@models@VmSessionModel.go",
        name: "VmSessionModel.go",
        path: "vm-manager/models/VmSessionModel.go",
        type: ".go",
        scope: "models",
        size: 32,
        complexity: "low",
        lastModified: "2024-01-10",
        functions: ["SaveVMAssignSession", "GetgVMAssignSessionHashsetKey"],
        description: "VM会话模型，管理VM分配会话"
      },
      {
        id: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@models@UserInfo.go",
        name: "UserInfo.go",
        path: "vm-manager/models/UserInfo.go",
        type: ".go",
        scope: "models",
        size: 28,
        complexity: "low",
        lastModified: "2024-01-08",
        functions: ["GetUserInfoEffective", "GetBIZByUID"],
        description: "用户信息模型，管理用户基本信息"
      },
      {
        id: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@internal@dao@UserInfoDao.go",
        name: "UserInfoDao.go",
        path: "vm-manager/internal/dao/UserInfoDao.go",
        type: ".go",
        scope: "dao",
        size: 55,
        complexity: "high",
        lastModified: "2024-01-12",
        functions: ["GetUserInfoEffective", "GetBIZByUID", "UpdateUserInfo"],
        description: "用户信息数据访问对象"
      },
      {
        id: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@services@VMService.go",
        name: "VMService.go",
        path: "vm-manager/services/VMService.go",
        type: ".go",
        scope: "services",
        size: 78,
        complexity: "high",
        lastModified: "2024-01-14",
        functions: ["AllocateVM", "DeallocateVM", "GetVMStatus"],
        description: "VM服务层，处理VM相关的业务逻辑"
      }
    ],
    callRelations: [
      {
        callerId: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@controllers:VmManagerController.DoLockAssignVm",
        callerName: "DoLockAssignVm",
        calleeId: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@models:SaveVMAssignSession",
        calleeName: "SaveVMAssignSession",
        calleeFileId: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@models@VmSessionModel.go",
        callerFileId: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@controllers@AssignVm.go",
        calleeScope: "2",
        callerScope: "2",
        calleeEntityId: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@models@VmSessionModel.go",
        callerEntityId: "bafc26d7-32fe-4e28-b727-6503583db09a@vm-manager@controllers@AssignVm.go"
      }
    ]
  };

  useEffect(() => {
    // 初始化Mermaid
    mermaid.initialize({
      startOnLoad: false, // 改为false，手动控制渲染
      theme: 'default',
      securityLevel: 'loose',
      sequence: {
        useMaxWidth: false,
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35,
        mirrorActors: true,
        bottomMarginAdj: 1,
        rightAngles: false,
        showSequenceNumbers: false
      }
    });
  }, []);

  // 手动渲染Mermaid图表（带防抖）
  useEffect(() => {
    if (mermaidCode) {
      let isCancelled = false;
      
      const renderChart = async () => {
        if (isCancelled) return;
        
        try {
          // 清除之前的图表 - 使用更安全的方法
          const chartContainer = document.querySelector('.mermaid-chart .mermaid');
          if (chartContainer && !isCancelled) {
            chartContainer.textContent = '';
          }
          
          // 重新渲染图表
          if (!isCancelled) {
            await mermaid.run();
          }
        } catch (error) {
          if (!isCancelled) {
            console.error('Mermaid渲染错误:', error);
            setError(`图表渲染失败: ${error}`);
          }
        }
      };
      
      // 防抖渲染，避免频繁重新渲染
      const timer = setTimeout(renderChart, 300);
      
      return () => {
        isCancelled = true;
        clearTimeout(timer);
        // 清理Mermaid图表 - 使用更安全的方法
        try {
          const chartContainer = document.querySelector('.mermaid-chart .mermaid');
          if (chartContainer) {
            chartContainer.textContent = '';
          }
        } catch (error) {
          console.error('清理图表时出错:', error);
        }
      };
    }
  }, [mermaidCode]);

  // 搜索功能
  const performSearch = () => {
    const term = searchTerm.toLowerCase();
    
    const filtered = mockData.files.filter(file => {
      let matchesSearch = false;
      
      switch (searchMode) {
        case 'contains':
          matchesSearch = file.name.toLowerCase().includes(term) || 
                         file.path.toLowerCase().includes(term);
          break;
        case 'startsWith':
          matchesSearch = file.name.toLowerCase().startsWith(term) || 
                         file.path.toLowerCase().startsWith(term);
          break;
        case 'regex':
          try {
            const regex = new RegExp(term, 'i');
            matchesSearch = regex.test(file.name) || regex.test(file.path);
          } catch (e) {
            matchesSearch = false;
          }
          break;
      }

      const matchesType = !fileTypeFilter || file.type === fileTypeFilter;
      const matchesScope = !scopeFilter || file.scope === scopeFilter;
      
      return matchesSearch && matchesType && matchesScope;
    }).slice(0, maxResults);

    setFilteredFiles(filtered);
    updateFunctionList();
  };

  // 更新函数列表
  const updateFunctionList = () => {
    const selectedFileIds = Array.from(selectedFiles);
    
    if (selectedFileIds.length === 0) {
      setFilteredFunctions([]);
      return;
    }

    const allFunctions: Array<{name: string, file: string, path: string}> = [];
    selectedFileIds.forEach(fileId => {
      const file = mockData.files.find(f => f.id === fileId);
      if (file) {
        file.functions.forEach(func => {
          if (!allFunctions.find(f => f.name === func)) {
            allFunctions.push({
              name: func,
              file: file.name,
              path: file.path
            });
          }
        });
      }
    });

    setFilteredFunctions(allFunctions);
  };

  // 切换文件选择
  const toggleFileSelection = (fileId: string) => {
    const newSelectedFiles = new Set(selectedFiles);
    if (newSelectedFiles.has(fileId)) {
      newSelectedFiles.delete(fileId);
      // 移除相关函数
      const file = mockData.files.find(f => f.id === fileId);
      if (file) {
        const newSelectedFunctions = new Set(selectedFunctions);
        file.functions.forEach(func => newSelectedFunctions.delete(func));
        setSelectedFunctions(newSelectedFunctions);
      }
    } else {
      newSelectedFiles.add(fileId);
    }
    
    setSelectedFiles(newSelectedFiles);
    updateFunctionList();
  };

  // 切换函数选择
  const toggleFunctionSelection = (functionName: string) => {
    const newSelectedFunctions = new Set(selectedFunctions);
    if (newSelectedFunctions.has(functionName)) {
      newSelectedFunctions.delete(functionName);
    } else {
      newSelectedFunctions.add(functionName);
    }
    setSelectedFunctions(newSelectedFunctions);
  };

  // 全选文件
  const selectAllFiles = () => {
    const allFileIds = new Set(filteredFiles.map(f => f.id));
    setSelectedFiles(allFileIds);
    updateFunctionList();
  };

  // 取消全选文件
  const deselectAllFiles = () => {
    setSelectedFiles(new Set());
    setSelectedFunctions(new Set());
    setFilteredFunctions([]);
  };

  // 全选函数
  const selectAllFunctions = () => {
    const allFunctionNames = new Set(filteredFunctions.map(f => f.name));
    setSelectedFunctions(allFunctionNames);
  };

  // 取消全选函数
  const deselectAllFunctions = () => {
    setSelectedFunctions(new Set());
  };

  // 生成图表
  const generateDiagram = async () => {
    if (selectedFiles.size === 0 && selectedFunctions.size === 0) {
      setError('请先选择文件或函数！');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      if (diagramType === 'sequence') {
        await generateSequenceDiagram();
      } else {
        await generateCallGraph();
      }
    } catch (err) {
      setError(`生成图表时出错: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 生成时序图
  const generateSequenceDiagram = async () => {
    // 构建参与者列表
    const participants = Array.from(selectedFiles).map(fileId => {
      const file = mockData.files.find(f => f.id === fileId);
      return file ? file.name.replace('.go', '') : '';
    }).filter(Boolean);

    // 构建消息列表
    const messages: Array<{from: string, to: string, message: string, type?: 'request' | 'response' | 'note'}> = [];
    
    // 根据选择的文件和函数生成调用关系
    const selectedFileIds = Array.from(selectedFiles);
    const selectedFunctionNames = Array.from(selectedFunctions);

    // 模拟调用流程
    if (selectedFileIds.length > 0) {
      // 从控制器开始
      const controllerFile = mockData.files.find(f => f.scope === 'controllers' && selectedFileIds.includes(f.id));
      if (controllerFile) {
        const controllerName = controllerFile.name.replace('.go', '');
        
        // 添加控制器到其他组件的调用
        selectedFileIds.forEach(fileId => {
          const file = mockData.files.find(f => f.id === fileId);
          if (file && file.scope !== 'controllers') {
            const targetName = file.name.replace('.go', '');
            messages.push({
              from: controllerName,
              to: targetName,
              message: `调用 ${file.functions[0] || '方法'}`,
              type: 'request'
            });
            
            // 添加响应
            messages.push({
              from: targetName,
              to: controllerName,
              message: '返回结果',
              type: 'response'
            });
          }
        });
      }
    }

    const config: SequenceDiagramConfig = {
      title: 'VM分配时序图',
      description: '基于选择的文件和函数生成的时序图',
      participants,
      messages
    };

    setGeneratedDiagram(config);
    setGeneratedCallGraph(null);
    
    // 生成Mermaid代码
    const mermaidCode = generateMermaidCode(config);
    setMermaidCode(mermaidCode);

    if (onGenerate) {
      onGenerate(config);
    }
  };

  // 生成调用图
  const generateCallGraph = async () => {
    const selectedFileIds = Array.from(selectedFiles);
    
    // 构建节点
    const nodes = selectedFileIds.map(fileId => {
      const file = mockData.files.find(f => f.id === fileId);
      if (!file) return null;
      
      return {
        id: file.id,
        name: file.name.replace('.go', ''),
        type: file.type,
        scope: file.scope,
        functions: file.functions
      };
    }).filter(Boolean);

    // 构建边（调用关系）
    const edges: Array<{from: string, to: string, label: string, type: 'call' | 'dependency' | 'import'}> = [];
    
    // 根据选择的文件生成调用关系
    selectedFileIds.forEach(fileId => {
      const file = mockData.files.find(f => f.id === fileId);
      if (!file) return;

      // 查找调用关系
      const relations = mockData.callRelations.filter(rel => 
        rel.callerFileId === fileId || rel.calleeFileId === fileId
      );

      relations.forEach(rel => {
        const fromFile = mockData.files.find(f => f.id === rel.callerFileId);
        const toFile = mockData.files.find(f => f.id === rel.calleeFileId);
        
        if (fromFile && toFile && selectedFileIds.includes(fromFile.id) && selectedFileIds.includes(toFile.id)) {
          edges.push({
            from: fromFile.name.replace('.go', ''),
            to: toFile.name.replace('.go', ''),
            label: `${rel.callerName} → ${rel.calleeName}`,
            type: 'call'
          });
        }
      });
    });

    const config: CallGraphConfig = {
      title: 'VM分配调用图',
      description: '基于选择的文件和函数生成的调用关系图',
      nodes: nodes as any,
      edges
    };

    setGeneratedCallGraph(config);
    setGeneratedDiagram(null);
    
    // 生成Mermaid代码
    const mermaidCode = generateCallGraphMermaidCode(config);
    setMermaidCode(mermaidCode);

    if (onGenerate) {
      onGenerate(config as any);
    }
  };

  // 生成Mermaid代码
  const generateMermaidCode = (config: SequenceDiagramConfig): string => {
    let code = 'sequenceDiagram\n';
    
    // 添加参与者
    config.participants.forEach(participant => {
      code += `    participant ${participant}\n`;
    });
    
    code += '\n';
    
    // 添加消息
    config.messages.forEach(message => {
      if (message.type === 'response') {
        code += `    ${message.to}-->>${message.from}: ${message.message}\n`;
      } else {
        code += `    ${message.from}->>${message.to}: ${message.message}\n`;
      }
    });
    
    return code;
  };

  // 生成调用图Mermaid代码
  const generateCallGraphMermaidCode = (config: CallGraphConfig): string => {
    let code = 'graph TD\n';
    
    // 添加节点
    config.nodes.forEach(node => {
      const nodeStyle = getNodeStyle(node.scope);
      code += `    ${node.id.replace(/[^a-zA-Z0-9]/g, '_')}["${node.name}<br/>${node.scope}"]${nodeStyle}\n`;
    });
    
    code += '\n';
    
    // 添加边
    config.edges.forEach(edge => {
      const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
      const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
      code += `    ${fromId} -->|${edge.label}| ${toId}\n`;
    });
    
    return code;
  };

  // 获取节点样式
  const getNodeStyle = (scope: string): string => {
    switch (scope) {
      case 'controllers':
        return ':::controller';
      case 'models':
        return ':::model';
      case 'services':
        return ':::service';
      case 'dao':
        return ':::dao';
      default:
        return ':::default';
    }
  };

  // 导出图表
  const exportDiagram = async (format: 'svg' | 'png' | 'pdf') => {
    if (!mermaidCode) {
      setError('没有可导出的图表');
      return;
    }

    try {
      if (format === 'svg') {
        const uniqueId = `export-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, mermaidCode);
        if (onExport) {
          onExport('svg', svg);
        }
        // 清理临时元素
        try {
          const tempElement = document.getElementById(uniqueId);
          if (tempElement) {
            tempElement.remove();
          }
        } catch (error) {
          console.error('清理临时元素时出错:', error);
        }
      } else {
        setError(`${format}导出功能开发中...`);
      }
    } catch (err) {
      console.error('导出图表时出错:', err);
      setError(`导出失败: ${err}`);
    }
  };

  // 清空选择
  const clearSelection = () => {
    setSelectedFiles(new Set());
    setSelectedFunctions(new Set());
    setFilteredFunctions([]);
    setGeneratedDiagram(null);
    setGeneratedCallGraph(null);
    setMermaidCode('');
    setError(null);
  };

  // 搜索建议
  const getSearchSuggestions = () => {
    if (searchTerm.length < 2) return [];
    
    const suggestions: Array<{type: 'file' | 'function', text: string}> = [];
    
    // 文件建议
    const matchingFiles = mockData.files.filter(file => 
      file.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      file.path.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 3);
    
    matchingFiles.forEach(file => {
      suggestions.push({
        type: 'file',
        text: `${file.name} (${file.path})`
      });
    });
    
    // 函数建议
    const matchingFunctions: Array<{type: 'function', text: string}> = [];
    mockData.files.forEach(file => {
      file.functions.forEach(func => {
        if (func.toLowerCase().includes(searchTerm.toLowerCase())) {
          matchingFunctions.push({
            type: 'function',
            text: `${func} in ${file.name}`
          });
        }
      });
    });
    
    suggestions.push(...matchingFunctions.slice(0, 2));
    
    return suggestions;
  };

  const searchSuggestions = getSearchSuggestions();

  return (
    <div className="sequence-diagram-generator">
             <div className="generator-header">
         <h2>🔍 图表生成器</h2>
         <p>搜索并选择文件和函数，自动生成时序图或调用图</p>
         
         {/* 图表类型切换 */}
         <div className="diagram-type-selector">
           <button
             className={`type-btn ${diagramType === 'sequence' ? 'active' : ''}`}
             onClick={() => setDiagramType('sequence')}
           >
             📊 时序图
           </button>
           <button
             className={`type-btn ${diagramType === 'callgraph' ? 'active' : ''}`}
             onClick={() => setDiagramType('callgraph')}
           >
             🕸️ 调用图
           </button>
         </div>
       </div>

      <div className="generator-content">
        {/* 搜索和选择区域 */}
        <div className="selector-section">
          <div className="search-area">
            <div className="search-box">
              <input
                type="text"
                className="search-input"
                placeholder="输入文件名、函数名或路径进行搜索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSearch()}
              />
              <button className="search-btn" onClick={performSearch}>
                🔍 搜索
              </button>
            </div>

            {/* 搜索建议 */}
            {searchSuggestions.length > 0 && (
              <div className="search-suggestions">
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="suggestion-item"
                    onClick={() => {
                      setSearchTerm(suggestion.text);
                      performSearch();
                    }}
                  >
                    {suggestion.type === 'file' ? '📁' : '⚙️'} {suggestion.text}
                  </div>
                ))}
              </div>
            )}

            <div className="basic-filters">
              <div className="filter-group">
                <label>文件类型:</label>
                <select
                  value={fileTypeFilter}
                  onChange={(e) => setFileTypeFilter(e.target.value)}
                >
                  <option value="">全部</option>
                  <option value=".go">Go文件</option>
                  <option value=".js">JavaScript</option>
                  <option value=".ts">TypeScript</option>
                  <option value=".py">Python</option>
                  <option value=".java">Java</option>
                </select>
              </div>
              <div className="filter-group">
                <label>作用域:</label>
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                >
                  <option value="">全部</option>
                  <option value="controllers">控制器</option>
                  <option value="models">模型</option>
                  <option value="services">服务</option>
                  <option value="dao">数据访问</option>
                </select>
              </div>
              <div className="filter-group">
                <label>最大结果:</label>
                <input
                  type="number"
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  min="10"
                  max="1000"
                />
              </div>
              <div className="filter-group">
                <label>搜索模式:</label>
                <select
                  value={searchMode}
                  onChange={(e) => setSearchMode(e.target.value as any)}
                >
                  <option value="contains">包含匹配</option>
                  <option value="startsWith">开头匹配</option>
                  <option value="regex">正则表达式</option>
                </select>
              </div>
            </div>

            <button
              className="toggle-filters-btn"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? '隐藏' : '显示'}高级筛选
            </button>

            {showAdvancedFilters && (
              <div className="advanced-filters">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>文件大小范围 (KB):</label>
                    <input type="range" min="0" max="1000" defaultValue="1000" />
                    <span className="range-value">1000 KB</span>
                  </div>
                  <div className="filter-group">
                    <label>复杂度:</label>
                    <select>
                      <option value="">全部</option>
                      <option value="low">低复杂度</option>
                      <option value="medium">中等复杂度</option>
                      <option value="high">高复杂度</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 结果区域 */}
          <div className="results-section">
            {/* 文件列表 */}
            <div className="file-list">
              <div className="section-header">
                <h3>📁 文件列表</h3>
                <div className="section-actions">
                  <button className="action-btn" onClick={selectAllFiles}>
                    全选
                  </button>
                  <button className="action-btn" onClick={deselectAllFiles}>
                    取消全选
                  </button>
                </div>
              </div>
              <div className="list-content">
                {filteredFiles.length === 0 ? (
                  <div className="no-results">
                    输入搜索条件开始搜索文件...
                  </div>
                ) : (
                  filteredFiles.map(file => (
                    <div
                      key={file.id}
                      className={`file-item ${selectedFiles.has(file.id) ? 'selected' : ''}`}
                      onClick={() => toggleFileSelection(file.id)}
                    >
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedFiles.has(file.id)}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="item-info">
                        <div className="item-name">{file.name}</div>
                        <div className="item-path">{file.path}</div>
                        <div className="item-meta">
                          <span className="meta-tag">{file.type}</span>
                          <span className="meta-tag">{file.scope}</span>
                          {file.size && <span className="meta-tag">{file.size}KB</span>}
                          {file.complexity && <span className="meta-tag">{file.complexity}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 函数列表 */}
            <div className="function-list">
              <div className="section-header">
                <h3>⚙️ 函数列表</h3>
                <div className="section-actions">
                  <button className="action-btn" onClick={selectAllFunctions}>
                    全选
                  </button>
                  <button className="action-btn" onClick={deselectAllFunctions}>
                    取消全选
                  </button>
                </div>
              </div>
              <div className="list-content">
                {filteredFunctions.length === 0 ? (
                  <div className="no-results">
                    选择文件后显示相关函数...
                  </div>
                ) : (
                  filteredFunctions.map(func => (
                    <div
                      key={func.name}
                      className={`function-item ${selectedFunctions.has(func.name) ? 'selected' : ''}`}
                      onClick={() => toggleFunctionSelection(func.name)}
                    >
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={selectedFunctions.has(func.name)}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="item-info">
                        <div className="item-name">{func.name}</div>
                        <div className="item-path">{func.file} - {func.path}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 选择摘要 */}
          {(selectedFiles.size > 0 || selectedFunctions.size > 0) && (
            <div className="selection-summary">
              <div className="summary-stats">
                <div className="stat-item">
                  <div className="stat-number">{selectedFiles.size}</div>
                  <div className="stat-label">已选文件</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">{selectedFunctions.size}</div>
                  <div className="stat-label">已选函数</div>
                </div>
              </div>
              <div className="summary-actions">
                                 <button
                   className="btn btn-primary"
                   onClick={generateDiagram}
                   disabled={isGenerating}
                 >
                   {isGenerating ? '🔄 生成中...' : `🚀 生成${diagramType === 'sequence' ? '时序图' : '调用图'}`}
                 </button>
                <button className="btn btn-secondary" onClick={clearSelection}>
                  🗑️ 清空选择
                </button>
              </div>
            </div>
          )}
        </div>

                 {/* 生成的图表区域 */}
         {(generatedDiagram || generatedCallGraph) && (
           <div className="generated-diagram-section">
             <div className="diagram-header">
               <h3>📊 生成的{diagramType === 'sequence' ? '时序图' : '调用图'}</h3>
               <div className="diagram-actions">
                 <button
                   className="btn btn-secondary"
                   onClick={() => exportDiagram('svg')}
                 >
                   📤 导出SVG
                 </button>
                 <button
                   className="btn btn-secondary"
                   onClick={() => exportDiagram('png')}
                 >
                   📤 导出PNG
                 </button>
               </div>
             </div>

            <div className="diagram-content">
              {error && (
                <div className="error-message">
                  ❌ {error}
                </div>
              )}

                             {mermaidCode && (
                 <div className="mermaid-chart">
                   <MermaidErrorBoundary>
                     <div className="mermaid" key={`mermaid-${Date.now()}`}>
                       {mermaidCode}
                     </div>
                   </MermaidErrorBoundary>
                 </div>
               )}

                             <div className="diagram-info">
                 <h4>图表信息</h4>
                 {diagramType === 'sequence' && generatedDiagram ? (
                   <>
                     <p><strong>标题:</strong> {generatedDiagram.title}</p>
                     <p><strong>描述:</strong> {generatedDiagram.description}</p>
                     <p><strong>参与者:</strong> {generatedDiagram.participants.join(', ')}</p>
                     <p><strong>消息数量:</strong> {generatedDiagram.messages.length}</p>
                   </>
                 ) : generatedCallGraph ? (
                   <>
                     <p><strong>标题:</strong> {generatedCallGraph.title}</p>
                     <p><strong>描述:</strong> {generatedCallGraph.description}</p>
                     <p><strong>节点数量:</strong> {generatedCallGraph.nodes.length}</p>
                     <p><strong>边数量:</strong> {generatedCallGraph.edges.length}</p>
                   </>
                 ) : null}
               </div>

              <div className="mermaid-code">
                <h4>Mermaid代码</h4>
                <pre>
                  <code>{mermaidCode}</code>
                </pre>
                <button
                  className="btn btn-secondary"
                  onClick={() => navigator.clipboard.writeText(mermaidCode)}
                >
                  📋 复制代码
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SequenceDiagramGenerator;
