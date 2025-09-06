import React, { useState, useEffect } from 'react';
import { RepositoryNode, CallChainInfo } from './RepositoryIntegration';
import './SSADataFlowAnalyzer.css';

// SSA数据流分析相关的接口定义
export interface SSAVariable {
  id: string;
  name: string;
  type: string;
  scope: string;
  definition: string;
  uses: string[];
  reachingDefinitions: string[];
  liveRange: {
    start: number;
    end: number;
  };
}

export interface SSABasicBlock {
  id: string;
  label: string;
  instructions: SSAInstruction[];
  predecessors: string[];
  successors: string[];
  dominance: string[];
  dominanceFrontier: string[];
}

export interface SSAInstruction {
  id: string;
  type: 'assignment' | 'call' | 'branch' | 'return' | 'phi';
  ssaForm: string;
  originalCode: string;
  variables: {
    defined: string[];
    used: string[];
  };
  dataFlow: {
    reachingDefinitions: string[];
    liveVariables: string[];
    availableExpressions: string[];
  };
}

export interface SSADataFlowGraph {
  variables: Map<string, SSAVariable>;
  basicBlocks: Map<string, SSABasicBlock>;
  controlFlow: Array<{
    from: string;
    to: string;
    condition?: string;
  }>;
  dataFlow: Array<{
    from: string;
    to: string;
    variable: string;
    type: 'definition' | 'use' | 'kill';
  }>;
  phiNodes: Array<{
    block: string;
    variable: string;
    operands: Array<{
      value: string;
      source: string;
    }>;
  }>;
}

export interface DataFlowAnalysisResult {
  reachingDefinitions: Map<string, Set<string>>;
  liveVariables: Map<string, Set<string>>;
  availableExpressions: Map<string, Set<string>>;
  constantPropagation: Map<string, any>;
  copyPropagation: Map<string, string>;
}

interface SSADataFlowAnalyzerProps {
  selectedNodes: RepositoryNode[];
  selectedCallChains: CallChainInfo[];
  onAnalysisComplete?: (result: SSADataFlowGraph, analysisResult: DataFlowAnalysisResult) => void;
}

const SSADataFlowAnalyzer: React.FC<SSADataFlowAnalyzerProps> = ({
  selectedNodes,
  selectedCallChains,
  onAnalysisComplete
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [ssaGraph, setSsaGraph] = useState<SSADataFlowGraph | null>(null);
  const [analysisResult, setAnalysisResult] = useState<DataFlowAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<'basic' | 'advanced' | 'full'>('basic');

  // 模拟SSA分析过程
  const performSSAAnalysis = async () => {
    if (selectedNodes.length === 0) {
      setError('请先选择要分析的代码文件！');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);

    try {
      // 模拟分析进度
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // 执行SSA分析
      const result = await executeSSAAnalysis();
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);

      setSsaGraph(result.ssaGraph);
      setAnalysisResult(result.analysisResult);

      if (onAnalysisComplete) {
        onAnalysisComplete(result.ssaGraph, result.analysisResult);
      }

      // 重置进度
      setTimeout(() => setAnalysisProgress(0), 1000);
    } catch (err) {
      setError(`SSA分析失败: ${err}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 执行SSA分析的核心逻辑
  const executeSSAAnalysis = async (): Promise<{
    ssaGraph: SSADataFlowGraph;
    analysisResult: DataFlowAnalysisResult;
  }> => {
    // 模拟分析延迟
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 基于选择的节点生成模拟SSA图
    const ssaGraph = generateMockSSAGraph();
    
    // 执行数据流分析
    const analysisResult = performDataFlowAnalysis(ssaGraph);

    return { ssaGraph, analysisResult };
  };

  // 生成模拟SSA图（实际项目中应该基于真实代码分析）
  const generateMockSSAGraph = (): SSADataFlowGraph => {
    const variables = new Map<string, SSAVariable>();
    const basicBlocks = new Map<string, SSABasicBlock>();
    
    // 为每个选择的节点生成模拟变量
    selectedNodes.forEach((node, index) => {
      if (node.type === 'function') {
        const varId = `var_${index}`;
        variables.set(varId, {
          id: varId,
          name: `${node.name}_result`,
          type: 'any',
          scope: node.path,
          definition: `${node.name}()`,
          uses: [`use_${index}_1`, `use_${index}_2`],
          reachingDefinitions: [`def_${index}_1`],
          liveRange: { start: index * 10, end: (index + 1) * 10 }
        });
      }
    });

    // 生成基本块
    const blockCount = Math.min(selectedNodes.length, 5);
    for (let i = 0; i < blockCount; i++) {
      const blockId = `block_${i}`;
      basicBlocks.set(blockId, {
        id: blockId,
        label: `Block ${i}`,
        instructions: [
          {
            id: `inst_${i}_1`,
            type: 'assignment',
            ssaForm: `var_${i}_1 = expr_${i}`,
            originalCode: `var${i} = expression${i}`,
            variables: {
              defined: [`var_${i}_1`],
              used: [`expr_${i}`]
            },
            dataFlow: {
              reachingDefinitions: [`def_${i}_1`],
              liveVariables: [`var_${i}_1`],
              availableExpressions: [`expr_${i}`]
            }
          }
        ],
        predecessors: i > 0 ? [`block_${i - 1}`] : [],
        successors: i < blockCount - 1 ? [`block_${i + 1}`] : [],
        dominance: [`block_${i}`],
        dominanceFrontier: []
      });
    }

    // 生成控制流
    const controlFlow = [];
    for (let i = 0; i < blockCount - 1; i++) {
      controlFlow.push({
        from: `block_${i}`,
        to: `block_${i + 1}`,
        condition: i === 0 ? 'entry' : undefined
      });
    }

    // 生成数据流
    const dataFlow: Array<{
      from: string;
      to: string;
      variable: string;
      type: 'definition' | 'use' | 'kill';
    }> = [];
    variables.forEach((variable, varId) => {
      dataFlow.push({
        from: variable.definition,
        to: variable.uses[0],
        variable: variable.name,
        type: 'definition'
      });
    });

    return {
      variables,
      basicBlocks,
      controlFlow,
      dataFlow,
      phiNodes: []
    };
  };

  // 执行数据流分析
  const performDataFlowAnalysis = (ssaGraph: SSADataFlowGraph): DataFlowAnalysisResult => {
    const reachingDefinitions = new Map<string, Set<string>>();
    const liveVariables = new Map<string, Set<string>>();
    const availableExpressions = new Map<string, Set<string>>();
    const constantPropagation = new Map<string, any>();
    const copyPropagation = new Map<string, string>();

    // 分析到达定义
    ssaGraph.variables.forEach((variable, varId) => {
      reachingDefinitions.set(varId, new Set(variable.reachingDefinitions));
    });

    // 分析活跃变量
    ssaGraph.variables.forEach((variable, varId) => {
      liveVariables.set(varId, new Set([variable.name, ...variable.uses]));
    });

    // 分析可用表达式
    ssaGraph.basicBlocks.forEach((block, blockId) => {
      const expressions = new Set<string>();
      block.instructions.forEach(inst => {
        expressions.add(inst.ssaForm);
      });
      availableExpressions.set(blockId, expressions);
    });

    // 模拟常量传播和复制传播
    ssaGraph.variables.forEach((variable, varId) => {
      if (variable.name.includes('const')) {
        constantPropagation.set(varId, 'constant_value');
      }
      if (variable.name.includes('copy')) {
        copyPropagation.set(varId, 'original_var');
      }
    });

    return {
      reachingDefinitions,
      liveVariables,
      availableExpressions,
      constantPropagation,
      copyPropagation
    };
  };

  // 生成数据流图表的Mermaid代码
  const generateDataFlowMermaid = (): string => {
    if (!ssaGraph) return '';

    let mermaidCode = 'graph TD\n';
    
    // 添加变量节点
    ssaGraph.variables.forEach((variable, varId) => {
      mermaidCode += `  ${varId}[${variable.name}<br/>${variable.type}]:::variable\n`;
    });

    // 添加基本块节点
    ssaGraph.basicBlocks.forEach((block, blockId) => {
      mermaidCode += `  ${blockId}[${block.label}]:::block\n`;
    });

    // 添加数据流边
    ssaGraph.dataFlow.forEach(flow => {
      mermaidCode += `  ${flow.from} -->|${flow.variable}| ${flow.to}\n`;
    });

    // 添加控制流边
    ssaGraph.controlFlow.forEach(flow => {
      const label = flow.condition ? `|${flow.condition}|` : '';
      mermaidCode += `  ${flow.from} -->${label} ${flow.to}\n`;
    });

    // 添加样式
    mermaidCode += `
  classDef variable fill:#e1f5fe,stroke:#01579b,stroke-width:2px
  classDef block fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
`;

    return mermaidCode;
  };

  return (
    <div className="ssa-analyzer">
      <div className="analyzer-header">
        <h3>🔍 SSA数据流分析</h3>
        <p>使用静态单赋值技术分析代码的数据流和控制流</p>
      </div>

      <div className="analysis-controls">
        <div className="analysis-type-selector">
          <label>分析类型：</label>
          <select 
            value={analysisType} 
            onChange={(e) => setAnalysisType(e.target.value as any)}
            disabled={isAnalyzing}
          >
            <option value="basic">基础分析</option>
            <option value="advanced">高级分析</option>
            <option value="full">完整分析</option>
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={performSSAAnalysis}
          disabled={isAnalyzing || selectedNodes.length === 0}
        >
          {isAnalyzing ? '分析中...' : '开始SSA分析'}
        </button>
      </div>

      {isAnalyzing && (
        <div className="analysis-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${analysisProgress}%` }}
            ></div>
          </div>
          <span className="progress-text">{analysisProgress}%</span>
        </div>
      )}

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {ssaGraph && analysisResult && (
        <div className="analysis-results">
          <div className="results-header">
            <h4>分析结果</h4>
            <button 
              className="btn btn-sm btn-secondary"
              onClick={() => {
                const mermaidCode = generateDataFlowMermaid();
                navigator.clipboard.writeText(mermaidCode);
                alert('数据流图Mermaid代码已复制到剪贴板！');
              }}
            >
              复制Mermaid代码
            </button>
          </div>

          <div className="results-grid">
            <div className="result-section">
              <h5>变量信息</h5>
              <div className="variables-list">
                {Array.from(ssaGraph.variables.values()).map(variable => (
                  <div key={variable.id} className="variable-item">
                    <strong>{variable.name}</strong>
                    <span className="variable-type">{variable.type}</span>
                    <span className="variable-scope">{variable.scope}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="result-section">
              <h5>基本块</h5>
              <div className="blocks-list">
                {Array.from(ssaGraph.basicBlocks.values()).map(block => (
                  <div key={block.id} className="block-item">
                    <strong>{block.label}</strong>
                    <span className="block-instructions">
                      {block.instructions.length} 条指令
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="result-section">
              <h5>数据流分析</h5>
              <div className="dataflow-summary">
                <div className="summary-item">
                  <span className="label">到达定义：</span>
                  <span className="value">{Array.from(analysisResult.reachingDefinitions.values()).reduce((sum, set) => sum + set.size, 0)}</span>
                </div>
                <div className="summary-item">
                  <span className="label">活跃变量：</span>
                  <span className="value">{Array.from(analysisResult.liveVariables.values()).reduce((sum, set) => sum + set.size, 0)}</span>
                </div>
                <div className="summary-item">
                  <span className="label">可用表达式：</span>
                  <span className="value">{Array.from(analysisResult.availableExpressions.values()).reduce((sum, set) => sum + set.size, 0)}</span>
                </div>
              </div>
            </div>

            <div className="result-section">
              <h5>优化建议</h5>
              <div className="optimization-suggestions">
                {analysisResult.constantPropagation.size > 0 && (
                  <div className="suggestion">
                    <span className="suggestion-icon">💡</span>
                    发现 {analysisResult.constantPropagation.size} 个常量传播机会
                  </div>
                )}
                {analysisResult.copyPropagation.size > 0 && (
                  <div className="suggestion">
                    <span className="suggestion-icon">💡</span>
                    发现 {analysisResult.copyPropagation.size} 个复制传播机会
                  </div>
                )}
                {ssaGraph.phiNodes.length > 0 && (
                  <div className="suggestion">
                    <span className="suggestion-icon">🔗</span>
                    生成 {ssaGraph.phiNodes.length} 个Phi节点
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="dataflow-visualization">
            <h5>数据流图</h5>
            <div className="mermaid-container">
              <pre className="mermaid-code">
                {generateDataFlowMermaid()}
              </pre>
            </div>
          </div>
        </div>
      )}

      <div className="analysis-info">
        <h5>SSA技术说明</h5>
        <ul>
          <li><strong>静态单赋值 (SSA)</strong>：每个变量只被赋值一次，便于数据流分析</li>
          <li><strong>到达定义分析</strong>：确定每个程序点可能到达的变量定义</li>
          <li><strong>活跃变量分析</strong>：识别在程序点之后可能被使用的变量</li>
          <li><strong>可用表达式分析</strong>：找出可以重用的计算结果</li>
          <li><strong>常量传播</strong>：在编译时计算常量表达式</li>
          <li><strong>复制传播</strong>：用原始变量替换副本变量</li>
        </ul>
      </div>
    </div>
  );
};

export default SSADataFlowAnalyzer;
