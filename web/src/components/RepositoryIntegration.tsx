import React, { useState, useEffect } from 'react';
import './RepositoryIntegration.css';

export interface RepositoryNode {
  id: string;
  name: string;
  type: 'file' | 'directory' | 'function' | 'class' | 'interface';
  path: string;
  parentId?: string;
  children?: RepositoryNode[];
  metadata?: {
    language?: string;
    size?: number;
    lines?: number;
    complexity?: number;
    lastModified?: string;
    dependencies?: string[];
    imports?: string[];
    exports?: string[];
  };
}

export interface CallChainInfo {
  caller: {
    id: string;
    name: string;
    file: string;
    line: number;
    type: 'function' | 'method' | 'constructor';
  };
  callee: {
    id: string;
    name: string;
    file: string;
    line: number;
    type: 'function' | 'method' | 'constructor';
  };
  callType: 'direct' | 'indirect' | 'callback' | 'async';
  context?: string;
  parameters?: string[];
  returnType?: string;
}

export interface RepositoryStructure {
  root: RepositoryNode;
  callChains: CallChainInfo[];
  dependencies: Map<string, string[]>;
  imports: Map<string, string[]>;
}

interface RepositoryIntegrationProps {
  onNodeSelect: (node: RepositoryNode) => void;
  onCallChainSelect: (callChains: CallChainInfo[]) => void;
  repositoryPath?: string;
}

const RepositoryIntegration: React.FC<RepositoryIntegrationProps> = ({
  onNodeSelect,
  onCallChainSelect,
  repositoryPath = '/workspace'
}) => {
  const [repositoryStructure, setRepositoryStructure] = useState<RepositoryStructure | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedCallChains, setSelectedCallChains] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'graph' | 'list'>('tree');
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // 模拟仓库结构数据
  useEffect(() => {
    const mockStructure: RepositoryStructure = {
      root: {
        id: 'root',
        name: 'codewiki',
        type: 'directory',
        path: '/workspace/codewiki',
        children: [
          {
            id: 'web',
            name: 'web',
            type: 'directory',
            path: '/workspace/codewiki/web',
            parentId: 'root',
            children: [
              {
                id: 'src',
                name: 'src',
                type: 'directory',
                path: '/workspace/codewiki/web/src',
                parentId: 'web',
                children: [
                  {
                    id: 'components',
                    name: 'components',
                    type: 'directory',
                    path: '/workspace/codewiki/web/src/components',
                    parentId: 'src',
                    children: [
                      {
                        id: 'SequenceDiagramGenerator',
                        name: 'SequenceDiagramGenerator.tsx',
                        type: 'file',
                        path: '/workspace/codewiki/web/src/components/SequenceDiagramGenerator.tsx',
                        parentId: 'components',
                        metadata: {
                          language: 'typescript',
                          size: 45,
                          lines: 1200,
                          complexity: 8,
                          lastModified: '2024-01-15',
                          dependencies: ['react', 'mermaid'],
                          imports: ['react', 'mermaid', './MermaidErrorBoundary'],
                          exports: ['SequenceDiagramGenerator', 'FileInfo', 'CallRelation']
                        }
                      },
                      {
                        id: 'MermaidErrorBoundary',
                        name: 'MermaidErrorBoundary.tsx',
                        type: 'file',
                        path: '/workspace/codewiki/web/src/components/MermaidErrorBoundary.tsx',
                        parentId: 'components',
                        metadata: {
                          language: 'typescript',
                          size: 2,
                          lines: 50,
                          complexity: 2,
                          lastModified: '2024-01-15',
                          dependencies: ['react'],
                          imports: ['react'],
                          exports: ['MermaidErrorBoundary']
                        }
                      }
                    ]
                  },
                  {
                    id: 'utils',
                    name: 'utils',
                    type: 'directory',
                    path: '/workspace/codewiki/web/src/utils',
                    parentId: 'src',
                    children: [
                      {
                        id: 'mermaidUtils',
                        name: 'mermaidUtils.ts',
                        type: 'file',
                        path: '/workspace/codewiki/web/src/utils/mermaidUtils.ts',
                        parentId: 'utils',
                        metadata: {
                          language: 'typescript',
                          size: 15,
                          lines: 400,
                          complexity: 5,
                          lastModified: '2024-01-15',
                          dependencies: ['mermaid'],
                          imports: ['mermaid'],
                          exports: ['generateMermaidCode', 'parseCallChain']
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            id: 'internal',
            name: 'internal',
            type: 'directory',
            path: '/workspace/codewiki/internal',
            parentId: 'root',
            children: [
              {
                id: 'biz',
                name: 'biz',
                type: 'directory',
                path: '/workspace/codewiki/internal/biz',
                parentId: 'internal',
                children: [
                  {
                    id: 'git.go',
                    name: 'git.go',
                    type: 'file',
                    path: '/workspace/codewiki/internal/biz/git.go',
                    parentId: 'biz',
                    metadata: {
                      language: 'go',
                      size: 25,
                      lines: 800,
                      complexity: 6,
                      lastModified: '2024-01-15',
                      dependencies: ['github.com/go-git/go-git/v5'],
                      imports: ['github.com/go-git/go-git/v5'],
                      exports: ['GitService', 'CloneRepository', 'GetFileContent']
                    }
                  }
                ]
              }
            ]
          }
        ]
      },
      callChains: [
        {
          caller: {
            id: 'SequenceDiagramGenerator.generateDiagram',
            name: 'generateDiagram',
            file: 'SequenceDiagramGenerator.tsx',
            line: 45,
            type: 'function'
          },
          callee: {
            id: 'SequenceDiagramGenerator.generateSequenceDiagram',
            name: 'generateSequenceDiagram',
            file: 'SequenceDiagramGenerator.tsx',
            line: 120,
            type: 'function'
          },
          callType: 'direct',
          context: 'Generate sequence diagram based on selected files',
          parameters: ['selectedFiles', 'selectedFunctions'],
          returnType: 'Promise<void>'
        },
        {
          caller: {
            id: 'SequenceDiagramGenerator.generateSequenceDiagram',
            name: 'generateSequenceDiagram',
            file: 'SequenceDiagramGenerator.tsx',
            line: 120,
            type: 'function'
          },
          callee: {
            id: 'SequenceDiagramGenerator.generateMermaidCode',
            name: 'generateMermaidCode',
            file: 'SequenceDiagramGenerator.tsx',
            line: 200,
            type: 'function'
          },
          callType: 'direct',
          context: 'Convert diagram config to Mermaid code',
          parameters: ['config'],
          returnType: 'string'
        },
        {
          caller: {
            id: 'SequenceDiagramGenerator.generateMermaidCode',
            name: 'generateMermaidCode',
            file: 'SequenceDiagramGenerator.tsx',
            line: 200,
            type: 'function'
          },
          callee: {
            id: 'mermaid.render',
            name: 'render',
            file: 'mermaid',
            line: 1,
            type: 'function'
          },
          callType: 'direct',
          context: 'Render Mermaid diagram',
          parameters: ['id', 'code'],
          returnType: 'Promise<{svg: string}>'
        }
      ],
      dependencies: new Map([
        ['SequenceDiagramGenerator.tsx', ['react', 'mermaid', 'MermaidErrorBoundary']],
        ['MermaidErrorBoundary.tsx', ['react']],
        ['mermaidUtils.ts', ['mermaid']],
        ['git.go', ['github.com/go-git/go-git/v5']]
      ]),
      imports: new Map([
        ['SequenceDiagramGenerator.tsx', ['react', 'mermaid', './MermaidErrorBoundary']],
        ['MermaidErrorBoundary.tsx', ['react']],
        ['mermaidUtils.ts', ['mermaid']],
        ['git.go', ['github.com/go-git/go-git/v5']]
      ])
    };

    setRepositoryStructure(mockStructure);
  }, []);

  // 搜索节点
  const searchNodes = (term: string, node: RepositoryNode): RepositoryNode[] => {
    const results: RepositoryNode[] = [];
    
    if (node.name.toLowerCase().includes(term.toLowerCase()) ||
        node.path.toLowerCase().includes(term.toLowerCase())) {
      results.push(node);
    }
    
    if (node.children) {
      node.children.forEach(child => {
        results.push(...searchNodes(term, child));
      });
    }
    
    return results;
  };

  // 获取搜索结果
  const getSearchResults = () => {
    if (!repositoryStructure || !searchTerm) return [];
    return searchNodes(searchTerm, repositoryStructure.root);
  };

  // 选择节点
  const handleNodeSelect = (node: RepositoryNode) => {
    const newSelected = new Set(selectedNodes);
    if (newSelected.has(node.id)) {
      newSelected.delete(node.id);
    } else {
      newSelected.add(node.id);
    }
    setSelectedNodes(newSelected);
    onNodeSelect(node);
  };

  // 选择调用链
  const handleCallChainSelect = (callChain: CallChainInfo) => {
    const newSelected = new Set(selectedCallChains);
    const chainId = `${callChain.caller.id}->${callChain.callee.id}`;
    
    if (newSelected.has(chainId)) {
      newSelected.delete(chainId);
    } else {
      newSelected.add(chainId);
    }
    setSelectedCallChains(newSelected);
    
    // 获取选中的调用链
    const selectedChains = repositoryStructure!.callChains.filter(chain => {
      const id = `${chain.caller.id}->${chain.callee.id}`;
      return newSelected.has(id);
    });
    
    onCallChainSelect(selectedChains);
  };

  // 渲染树形结构
  const renderTreeNode = (node: RepositoryNode, level: number = 0) => {
    const isSelected = selectedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.id} className="tree-node" style={{ paddingLeft: level * 20 }}>
        <div 
          className={`node-content ${isSelected ? 'selected' : ''}`}
          onClick={() => handleNodeSelect(node)}
        >
          <span className="node-icon">
            {node.type === 'directory' ? '📁' : 
             node.type === 'file' ? '📄' : 
             node.type === 'function' ? '⚙️' : 
             node.type === 'class' ? '🏗️' : '🔧'}
          </span>
          <span className="node-name">{node.name}</span>
          {node.metadata && (
            <span className="node-meta">
              {node.metadata.language && <span className="meta-tag">{node.metadata.language}</span>}
              {node.metadata.lines && <span className="meta-tag">{node.metadata.lines}行</span>}
            </span>
          )}
        </div>
        {hasChildren && (
          <div className="node-children">
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // 渲染调用链列表
  const renderCallChains = () => {
    if (!repositoryStructure) return null;
    
    return (
      <div className="call-chains-list">
        {repositoryStructure.callChains.map((chain, index) => {
          const chainId = `${chain.caller.id}->${chain.callee.id}`;
          const isSelected = selectedCallChains.has(chainId);
          
          return (
            <div 
              key={index}
              className={`call-chain-item ${isSelected ? 'selected' : ''}`}
              onClick={() => handleCallChainSelect(chain)}
            >
              <div className="chain-header">
                <span className="chain-caller">{chain.caller.name}</span>
                <span className="chain-arrow">→</span>
                <span className="chain-callee">{chain.callee.name}</span>
              </div>
              <div className="chain-details">
                <span className="chain-file">{chain.caller.file}:{chain.caller.line}</span>
                <span className="chain-type">{chain.callType}</span>
                {chain.context && <span className="chain-context">{chain.context}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!repositoryStructure) {
    return <div className="loading">加载仓库结构...</div>;
  }

  return (
    <div className="repository-integration">
      <div className="integration-header">
        <h3>🔗 仓库结构集成</h3>
        <div className="view-controls">
          <button 
            className={`view-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            🌳 树形视图
          </button>
          <button 
            className={`view-btn ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
          >
            🕸️ 图形视图
          </button>
          <button 
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 列表视图
          </button>
        </div>
      </div>

      <div className="integration-content">
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="搜索文件、函数或类..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">全部类型</option>
            <option value="file">文件</option>
            <option value="function">函数</option>
            <option value="class">类</option>
            <option value="directory">目录</option>
          </select>
        </div>

        <div className="content-panels">
          <div className="structure-panel">
            <h4>📁 仓库结构</h4>
            <div className="structure-content">
              {viewMode === 'tree' && renderTreeNode(repositoryStructure.root)}
              {viewMode === 'list' && (
                <div className="list-view">
                  {getSearchResults().map(node => (
                    <div 
                      key={node.id}
                      className={`list-item ${selectedNodes.has(node.id) ? 'selected' : ''}`}
                      onClick={() => handleNodeSelect(node)}
                    >
                      <span className="item-icon">
                        {node.type === 'directory' ? '📁' : 
                         node.type === 'file' ? '📄' : 
                         node.type === 'function' ? '⚙️' : 
                         node.type === 'class' ? '🏗️' : '🔧'}
                      </span>
                      <span className="item-name">{node.name}</span>
                      <span className="item-path">{node.path}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="call-chains-panel">
            <h4>🔗 调用链信息</h4>
            <div className="call-chains-content">
              {renderCallChains()}
            </div>
          </div>
        </div>

        <div className="selection-summary">
          <div className="summary-item">
            <span className="summary-label">已选节点:</span>
            <span className="summary-value">{selectedNodes.size}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">已选调用链:</span>
            <span className="summary-value">{selectedCallChains.size}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RepositoryIntegration;
