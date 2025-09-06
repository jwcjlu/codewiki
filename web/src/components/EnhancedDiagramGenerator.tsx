import React, { useState, useEffect } from 'react';
import mermaid from 'mermaid';
import RepositoryIntegration, { 
  RepositoryNode, 
  CallChainInfo,
  RepositoryStructure 
} from './RepositoryIntegration';
import SSADataFlowAnalyzer, {
  SSADataFlowGraph,
  DataFlowAnalysisResult
} from './SSADataFlowAnalyzer';
import MermaidErrorBoundary from './MermaidErrorBoundary';
import './EnhancedDiagramGenerator.css';

export interface EnhancedDiagramConfig {
  title: string;
  description: string;
  type: 'sequence' | 'callgraph' | 'flowchart' | 'architecture';
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    path: string;
    metadata?: any;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label: string;
    type: string;
    metadata?: any;
  }>;
  participants?: string[];
  messages?: Array<{
    from: string;
    to: string;
    message: string;
    type?: 'request' | 'response' | 'note' | 'error';
  }>;
}

interface EnhancedDiagramGeneratorProps {
  onGenerate?: (config: EnhancedDiagramConfig) => void;
  onExport?: (format: 'svg' | 'png' | 'pdf', data: string) => void;
}

const EnhancedDiagramGenerator: React.FC<EnhancedDiagramGeneratorProps> = ({
  onGenerate,
  onExport
}) => {
  const [selectedNodes, setSelectedNodes] = useState<RepositoryNode[]>([]);
  const [selectedCallChains, setSelectedCallChains] = useState<CallChainInfo[]>([]);
  const [diagramType, setDiagramType] = useState<'sequence' | 'callgraph' | 'flowchart' | 'architecture'>('sequence');
  const [generatedConfig, setGeneratedConfig] = useState<EnhancedDiagramConfig | null>(null);
  const [mermaidCode, setMermaidCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ssaGraph, setSsaGraph] = useState<SSADataFlowGraph | null>(null);
  const [dataFlowResult, setDataFlowResult] = useState<DataFlowAnalysisResult | null>(null);
  const [showSSAAnalysis, setShowSSAAnalysis] = useState(false);

  // 初始化Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
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
      },
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }, []);

  // 处理节点选择
  const handleNodeSelect = (node: RepositoryNode) => {
    setSelectedNodes(prev => {
      const existing = prev.find(n => n.id === node.id);
      if (existing) {
        return prev.filter(n => n.id !== node.id);
      } else {
        return [...prev, node];
      }
    });
  };

  // 处理调用链选择
  const handleCallChainSelect = (callChains: CallChainInfo[]) => {
    setSelectedCallChains(callChains);
  };

  // 处理SSA分析完成
  const handleSSAAnalysisComplete = (ssaGraph: SSADataFlowGraph, analysisResult: DataFlowAnalysisResult) => {
    setSsaGraph(ssaGraph);
    setDataFlowResult(analysisResult);
  };

  // 生成图表
  const generateDiagram = async () => {
    if (selectedNodes.length === 0 && selectedCallChains.length === 0) {
      setError('请先选择仓库节点或调用链！');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let config: EnhancedDiagramConfig;

      switch (diagramType) {
        case 'sequence':
          config = await generateSequenceDiagram();
          break;
        case 'callgraph':
          config = await generateCallGraph();
          break;
        case 'flowchart':
          config = await generateFlowchart();
          break;
        case 'architecture':
          config = await generateArchitectureDiagram();
          break;
        default:
          throw new Error('不支持的图表类型');
      }

      setGeneratedConfig(config);
      const mermaidCode = generateMermaidCode(config);
      setMermaidCode(mermaidCode);

      if (onGenerate) {
        onGenerate(config);
      }
    } catch (err) {
      setError(`生成图表时出错: ${err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 生成时序图
  const generateSequenceDiagram = async (): Promise<EnhancedDiagramConfig> => {
    const participants = selectedNodes
      .filter(node => node.type === 'file')
      .map(node => node.name.replace(/\.(tsx?|jsx?|go|py|java)$/, ''));

    const messages: Array<{from: string, to: string, message: string, type?: 'request' | 'response' | 'note' | 'error'}> = [];

    // 基于调用链生成消息
    selectedCallChains.forEach(chain => {
      const callerName = chain.caller.name;
      const calleeName = chain.callee.name;
      
      messages.push({
        from: callerName,
        to: calleeName,
        message: `${chain.context || `调用 ${calleeName}`}`,
        type: 'request'
      });

      // 添加响应消息
      if (chain.returnType && chain.returnType !== 'void') {
        messages.push({
          from: calleeName,
          to: callerName,
          message: `返回 ${chain.returnType}`,
          type: 'response'
        });
      }
    });

    // 如果没有调用链，基于选择的文件生成模拟调用
    if (messages.length === 0 && participants.length > 1) {
      for (let i = 0; i < participants.length - 1; i++) {
        messages.push({
          from: participants[i],
          to: participants[i + 1],
          message: '调用方法',
          type: 'request'
        });
        messages.push({
          from: participants[i + 1],
          to: participants[i],
          message: '返回结果',
          type: 'response'
        });
      }
    }

    return {
      title: '代码调用时序图',
      description: '基于选择的文件和调用链生成的时序图',
      type: 'sequence',
      nodes: selectedNodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        path: node.path,
        metadata: node.metadata
      })),
      edges: [],
      participants,
      messages
    };
  };

  // 生成调用图
  const generateCallGraph = async (): Promise<EnhancedDiagramConfig> => {
    const nodes = selectedNodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      path: node.path,
      metadata: node.metadata
    }));

    const edges = selectedCallChains.map(chain => ({
      from: chain.caller.id,
      to: chain.callee.id,
      label: `${chain.caller.name} → ${chain.callee.name}`,
      type: chain.callType,
      metadata: {
        context: chain.context,
        parameters: chain.parameters,
        returnType: chain.returnType
      }
    }));

    return {
      title: '函数调用关系图',
      description: '基于选择的文件和调用链生成的调用关系图',
      type: 'callgraph',
      nodes,
      edges
    };
  };

  // 生成流程图
  const generateFlowchart = async (): Promise<EnhancedDiagramConfig> => {
    const nodes = selectedNodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      path: node.path,
      metadata: node.metadata
    }));

    // 基于调用链生成流程边
    const edges = selectedCallChains.map(chain => ({
      from: chain.caller.id,
      to: chain.callee.id,
      label: chain.context || '调用',
      type: 'flow',
      metadata: {
        callType: chain.callType,
        parameters: chain.parameters
      }
    }));

    return {
      title: '代码执行流程图',
      description: '基于选择的文件和调用链生成的执行流程图',
      type: 'flowchart',
      nodes,
      edges
    };
  };

  // 生成架构图
  const generateArchitectureDiagram = async (): Promise<EnhancedDiagramConfig> => {
    const nodes = selectedNodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      path: node.path,
      metadata: node.metadata
    }));

    // 基于文件类型和依赖关系生成架构边
    const edges: Array<{from: string, to: string, label: string, type: string, metadata?: any}> = [];
    
    selectedNodes.forEach(node => {
      if (node.metadata?.dependencies) {
        node.metadata.dependencies.forEach((dep: string) => {
          const targetNode = selectedNodes.find(n => 
            n.name.includes(dep) || n.metadata?.exports?.includes(dep)
          );
          if (targetNode) {
            edges.push({
              from: node.id,
              to: targetNode.id,
              label: `依赖 ${dep}`,
              type: 'dependency',
              metadata: { dependency: dep }
            });
          }
        });
      }
    });

    return {
      title: '系统架构图',
      description: '基于选择的文件和依赖关系生成的架构图',
      type: 'architecture',
      nodes,
      edges
    };
  };

  // 生成Mermaid代码
  const generateMermaidCode = (config: EnhancedDiagramConfig): string => {
    switch (config.type) {
      case 'sequence':
        return generateSequenceMermaidCode(config);
      case 'callgraph':
        return generateCallGraphMermaidCode(config);
      case 'flowchart':
        return generateFlowchartMermaidCode(config);
      case 'architecture':
        return generateArchitectureMermaidCode(config);
      default:
        return '';
    }
  };

  // 生成时序图Mermaid代码
  const generateSequenceMermaidCode = (config: EnhancedDiagramConfig): string => {
    let code = 'sequenceDiagram\n';
    
    if (config.participants) {
      config.participants.forEach(participant => {
        code += `    participant ${participant}\n`;
      });
    }
    
    code += '\n';
    
    if (config.messages) {
      config.messages.forEach(message => {
        if (message.type === 'response') {
          code += `    ${message.to}-->>${message.from}: ${message.message}\n`;
        } else if (message.type === 'note') {
          code += `    Note over ${message.from},${message.to}: ${message.message}\n`;
        } else if (message.type === 'error') {
          code += `    ${message.from}->>${message.to}: ${message.message}\n`;
        } else {
          code += `    ${message.from}->>${message.to}: ${message.message}\n`;
        }
      });
    }
    
    return code;
  };

  // 生成调用图Mermaid代码
  const generateCallGraphMermaidCode = (config: EnhancedDiagramConfig): string => {
    let code = 'graph TD\n';
    
    // 添加节点
    config.nodes.forEach(node => {
      const nodeStyle = getNodeStyle(node.type);
      const nodeId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
      code += `    ${nodeId}["${node.name}<br/>${node.type}"]${nodeStyle}\n`;
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

  // 生成流程图Mermaid代码
  const generateFlowchartMermaidCode = (config: EnhancedDiagramConfig): string => {
    let code = 'flowchart TD\n';
    
    // 添加节点
    config.nodes.forEach(node => {
      const nodeStyle = getFlowchartNodeStyle(node.type);
      const nodeId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
      code += `    ${nodeId}["${node.name}"]${nodeStyle}\n`;
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

  // 生成架构图Mermaid代码
  const generateArchitectureMermaidCode = (config: EnhancedDiagramConfig): string => {
    let code = 'graph LR\n';
    
    // 添加节点
    config.nodes.forEach(node => {
      const nodeStyle = getArchitectureNodeStyle(node.type);
      const nodeId = node.id.replace(/[^a-zA-Z0-9]/g, '_');
      code += `    ${nodeId}["${node.name}<br/>${node.type}"]${nodeStyle}\n`;
    });
    
    code += '\n';
    
    // 添加边
    config.edges.forEach(edge => {
      const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
      const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
      code += `    ${fromId} -.->|${edge.label}| ${toId}\n`;
    });
    
    return code;
  };

  // 获取节点样式
  const getNodeStyle = (type: string): string => {
    switch (type) {
      case 'file':
        return ':::file';
      case 'directory':
        return ':::directory';
      case 'function':
        return ':::function';
      case 'class':
        return ':::class';
      default:
        return ':::default';
    }
  };

  // 获取流程图节点样式
  const getFlowchartNodeStyle = (type: string): string => {
    switch (type) {
      case 'file':
        return ':::file';
      case 'function':
        return ':::function';
      case 'class':
        return ':::class';
      default:
        return ':::default';
    }
  };

  // 获取架构图节点样式
  const getArchitectureNodeStyle = (type: string): string => {
    switch (type) {
      case 'file':
        return ':::file';
      case 'directory':
        return ':::directory';
      case 'function':
        return ':::function';
      case 'class':
        return ':::class';
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
    setSelectedNodes([]);
    setSelectedCallChains([]);
    setGeneratedConfig(null);
    setMermaidCode('');
    setError(null);
    setSsaGraph(null);
    setDataFlowResult(null);
    setShowSSAAnalysis(false);
  };

  return (
    <div className="enhanced-diagram-generator">
      <div className="generator-header">
        <h2>🚀 增强图表生成器</h2>
        <p>基于仓库结构和调用链信息生成准确的时序图、调用图、流程图和架构图</p>
        
        {/* 图表类型选择器 */}
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
          <button
            className={`type-btn ${diagramType === 'flowchart' ? 'active' : ''}`}
            onClick={() => setDiagramType('flowchart')}
          >
            🔄 流程图
          </button>
          <button
            className={`type-btn ${diagramType === 'architecture' ? 'active' : ''}`}
            onClick={() => setDiagramType('architecture')}
          >
            🏗️ 架构图
          </button>
        </div>
      </div>

      <div className="generator-content">
        {/* 仓库结构集成 */}
        <RepositoryIntegration
          onNodeSelect={handleNodeSelect}
          onCallChainSelect={handleCallChainSelect}
        />

        {/* 选择摘要和操作 */}
        {(selectedNodes.length > 0 || selectedCallChains.length > 0) && (
          <div className="selection-summary">
            <div className="summary-stats">
              <div className="stat-item">
                <div className="stat-number">{selectedNodes.length}</div>
                <div className="stat-label">已选节点</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{selectedCallChains.length}</div>
                <div className="stat-label">已选调用链</div>
              </div>
            </div>
            <div className="summary-actions">
              <button
                className="btn btn-primary"
                onClick={generateDiagram}
                disabled={isGenerating}
              >
                {isGenerating ? '🔄 生成中...' : `🚀 生成${getDiagramTypeName(diagramType)}`}
              </button>
              <button 
                className="btn btn-info"
                onClick={() => setShowSSAAnalysis(!showSSAAnalysis)}
              >
                🔍 {showSSAAnalysis ? '隐藏' : '显示'}SSA分析
              </button>
              <button className="btn btn-secondary" onClick={clearSelection}>
                🗑️ 清空选择
              </button>
            </div>
          </div>
        )}

        {/* SSA数据流分析 */}
        {showSSAAnalysis && (
          <SSADataFlowAnalyzer
            selectedNodes={selectedNodes}
            selectedCallChains={selectedCallChains}
            onAnalysisComplete={handleSSAAnalysisComplete}
          />
        )}

        {/* 生成的图表区域 */}
        {generatedConfig && (
          <div className="generated-diagram-section">
            <div className="diagram-header">
              <h3>📊 生成的{getDiagramTypeName(diagramType)}</h3>
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
                <p><strong>标题:</strong> {generatedConfig.title}</p>
                <p><strong>描述:</strong> {generatedConfig.description}</p>
                <p><strong>节点数量:</strong> {generatedConfig.nodes.length}</p>
                <p><strong>边数量:</strong> {generatedConfig.edges.length}</p>
                {generatedConfig.participants && (
                  <p><strong>参与者:</strong> {generatedConfig.participants.join(', ')}</p>
                )}
                {generatedConfig.messages && (
                  <p><strong>消息数量:</strong> {generatedConfig.messages.length}</p>
                )}
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

export default EnhancedDiagramGenerator;
