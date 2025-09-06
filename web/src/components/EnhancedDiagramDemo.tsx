import React, { useState } from 'react';
import EnhancedDiagramGenerator, { EnhancedDiagramConfig } from './EnhancedDiagramGenerator';
import SSADataFlowAnalyzer, { 
  SSADataFlowGraph, 
  DataFlowAnalysisResult 
} from './SSADataFlowAnalyzer';
import './EnhancedDiagramDemo.css';

const EnhancedDiagramDemo: React.FC = () => {
  const [generatedConfigs, setGeneratedConfigs] = useState<EnhancedDiagramConfig[]>([]);
  const [ssaResults, setSsaResults] = useState<Array<{
    ssaGraph: SSADataFlowGraph;
    analysisResult: DataFlowAnalysisResult;
    timestamp: Date;
  }>>([]);
  const [exportHistory, setExportHistory] = useState<Array<{
    title: string;
    type: string;
    timestamp: Date;
    format: string;
  }>>([]);

  // 处理图表生成
  const handleGenerate = (config: EnhancedDiagramConfig) => {
    setGeneratedConfigs(prev => [config, ...prev]);
  };

  // 处理SSA分析完成
  const handleSSAAnalysisComplete = (ssaGraph: SSADataFlowGraph, analysisResult: DataFlowAnalysisResult) => {
    setSsaResults(prev => [{
      ssaGraph,
      analysisResult,
      timestamp: new Date()
    }, ...prev]);
  };

  // 处理导出
  const handleExport = (format: 'svg' | 'png' | 'pdf', data: string) => {
    const config = generatedConfigs[0];
    if (config) {
      setExportHistory(prev => [{
        title: config.title,
        type: config.type,
        timestamp: new Date(),
        format
      }, ...prev]);
    }

    // 创建下载链接
    const blob = new Blob([data], { type: `image/${format}` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // 清空历史记录
  const clearHistory = () => {
    setGeneratedConfigs([]);
    setSsaResults([]);
    setExportHistory([]);
  };

  return (
    <div className="enhanced-diagram-demo">
      <div className="demo-header">
        <h1>🚀 增强图表生成器演示</h1>
        <p>集成SSA数据流分析的智能图表生成系统</p>
        <div className="demo-features">
          <span className="feature-tag">📊 时序图</span>
          <span className="feature-tag">🕸️ 调用图</span>
          <span className="feature-tag">🔄 流程图</span>
          <span className="feature-tag">🏗️ 架构图</span>
          <span className="feature-tag">🔍 SSA分析</span>
        </div>
      </div>

      <div className="demo-content">
        {/* 主要图表生成器 */}
        <EnhancedDiagramGenerator
          onGenerate={handleGenerate}
          onExport={handleExport}
        />

        {/* 历史记录和统计 */}
        {(generatedConfigs.length > 0 || ssaResults.length > 0 || exportHistory.length > 0) && (
          <div className="demo-history">
            <div className="history-header">
              <h2>📈 生成历史与统计</h2>
              <button className="btn btn-secondary" onClick={clearHistory}>
                🗑️ 清空历史
              </button>
            </div>

            <div className="history-grid">
              {/* 图表生成历史 */}
              {generatedConfigs.length > 0 && (
                <div className="history-section">
                  <h3>📊 生成的图表</h3>
                  <div className="history-list">
                    {generatedConfigs.slice(0, 5).map((config, index) => (
                      <div key={index} className="history-item">
                        <div className="item-header">
                          <span className="item-title">{config.title}</span>
                          <span className={`item-type type-${config.type}`}>
                            {getDiagramTypeName(config.type)}
                          </span>
                        </div>
                        <div className="item-details">
                          <span>节点: {config.nodes.length}</span>
                          <span>边: {config.edges.length}</span>
                          {config.participants && (
                            <span>参与者: {config.participants.length}</span>
                          )}
                        </div>
                        <div className="item-timestamp">
                          {new Date().toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SSA分析历史 */}
              {ssaResults.length > 0 && (
                <div className="history-section">
                  <h3>🔍 SSA分析结果</h3>
                  <div className="history-list">
                    {ssaResults.slice(0, 5).map((result, index) => (
                      <div key={index} className="history-item">
                        <div className="item-header">
                          <span className="item-title">SSA数据流分析</span>
                          <span className="item-type type-ssa">数据流</span>
                        </div>
                        <div className="item-details">
                          <span>变量: {result.ssaGraph.variables.size}</span>
                          <span>基本块: {result.ssaGraph.basicBlocks.size}</span>
                          <span>数据流: {result.ssaGraph.dataFlow.length}</span>
                        </div>
                        <div className="item-timestamp">
                          {result.timestamp.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 导出历史 */}
              {exportHistory.length > 0 && (
                <div className="history-section">
                  <h3>📤 导出历史</h3>
                  <div className="history-list">
                    {exportHistory.slice(0, 5).map((export_, index) => (
                      <div key={index} className="history-item">
                        <div className="item-header">
                          <span className="item-title">{export_.title}</span>
                          <span className={`item-type type-${export_.type}`}>
                            {getDiagramTypeName(export_.type)}
                          </span>
                        </div>
                        <div className="item-details">
                          <span>格式: {export_.format.toUpperCase()}</span>
                        </div>
                        <div className="item-timestamp">
                          {export_.timestamp.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="demo-guide">
        <h2>📖 使用指南</h2>
        <div className="guide-content">
          <div className="guide-section">
            <h3>🎯 核心功能</h3>
            <ul>
              <li><strong>仓库结构浏览</strong>：浏览文件、目录、函数和类的层次结构</li>
              <li><strong>智能选择</strong>：搜索和选择需要分析的代码元素</li>
              <li><strong>多图表类型</strong>：支持时序图、调用图、流程图和架构图</li>
              <li><strong>SSA数据流分析</strong>：使用静态单赋值技术分析代码数据流</li>
              <li><strong>调用链分析</strong>：分析函数间的调用关系和依赖</li>
            </ul>
          </div>

          <div className="guide-section">
            <h3>🔍 SSA分析特性</h3>
            <ul>
              <li><strong>变量分析</strong>：识别变量定义、使用和生命周期</li>
              <li><strong>基本块分析</strong>：分析控制流和数据流</li>
              <li><strong>优化建议</strong>：提供常量传播、复制传播等优化建议</li>
              <li><strong>数据流图</strong>：生成可视化的数据流图表</li>
              <li><strong>Phi节点</strong>：处理控制流合并点的变量赋值</li>
            </ul>
          </div>

          <div className="guide-section">
            <h3>🚀 高级功能</h3>
            <ul>
              <li><strong>实时预览</strong>：即时查看生成的图表效果</li>
              <li><strong>多格式导出</strong>：支持SVG、PNG、PDF等格式</li>
              <li><strong>历史记录</strong>：保存生成和分析的历史记录</li>
              <li><strong>响应式设计</strong>：适配各种屏幕尺寸</li>
              <li><strong>错误处理</strong>：优雅处理图表渲染错误</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// 获取图表类型名称
const getDiagramTypeName = (type: string): string => {
  switch (type) {
    case 'sequence':
      return '时序图';
    case 'callgraph':
      return '调用图';
    case 'flowchart':
      return '流程图';
    case 'architecture':
      return '架构图';
    default:
      return '图表';
  }
};

export default EnhancedDiagramDemo;
