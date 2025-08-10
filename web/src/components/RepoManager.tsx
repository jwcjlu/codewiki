import React, { useEffect, useMemo, useState } from 'react';
import { Repo, RepoTreeResp, Function, CallRelation, Node, NodePosition } from '../types';
import { listRepos, createRepo, deleteRepo, analyzeRepo, getRepoTree, viewFileContent, fetchFunctionCalls } from '../services/api';
import CodeViewer from './CodeViewer';
import CallGraph from './CallGraph';
import NodeDetails from './NodeDetails';
import { initializeNodes, calculateGraphLayout } from '../utils/graphUtils';

const repoTypeOptions = [
  { label: '本地', value: 0, color: '#27AE60' },
  { label: 'GitHub', value: 1, color: '#3498DB' },
];

// 追加：语言选项
const languageOptions = [
  { label: 'Golang', value: 'Golang' },
  { label: 'Java', value: 'Java' },
  { label: 'Python', value: 'Python' },
  { label: 'Rust', value: 'Rust' },
];

// 统一样式
const styles = {
  input: {
    padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14,
    outline: 'none' as const, background: '#fff', width: '100%'
  },
  label: { fontSize: 12, color: '#666', marginBottom: 6 },
  btn: {
    padding: '8px 12px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    background: '#f3f4f6', color: '#374151'
  },
  btnPrimary: { background: '#2563eb', color: '#fff' },
  btnDanger: { background: '#ef4444', color: '#fff' },
  btnGhost: { background: '#fff', color: '#374151', border: '1px solid #e5e7eb' },
  badge: (bg: string) => ({ padding: '2px 8px', borderRadius: 999, fontSize: 12, color: '#fff', background: bg }),
  card: { border: '1px solid #eee', padding: 12, borderRadius: 12, background: '#fff' },
  toolbar: { display: 'flex', gap: 8, alignItems: 'center' },
};

const RepoManager: React.FC = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', repoType: 0, target: '', path: '', token: '', description: '', language: 'Golang', excludes: '' });
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [tree, setTree] = useState<RepoTreeResp | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(new Set());
  const [viewingFile, setViewingFile] = useState<{ content: string; language: string; fileName: string; functions: Function[]; highlightFunction?: string } | null>(null);
  // 新增：当前高亮的文件ID
  const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);
  
  // 新增：调用图相关状态
  const [activeTab, setActiveTab] = useState<'tree' | 'callgraph'>('tree');
  const [callGraphNodes, setCallGraphNodes] = useState<Map<string, Node>>(new Map());
  const [visibleCallGraphNodes, setVisibleCallGraphNodes] = useState<Set<string>>(new Set());
  const [callGraphNodePositions, setCallGraphNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [selectedCallGraphNode, setSelectedCallGraphNode] = useState<Node | null>(null);
  const [callGraphLoading, setCallGraphLoading] = useState(false);
  const [callGraphError, setCallGraphError] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRepos();
      setRepos(data.repos || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createRepo({
        name: form.name.trim(),
        repoType: Number(form.repoType),
        target: form.target.trim(),
        path: form.path.trim() || undefined,
        token: form.token.trim() || undefined,
        description: form.description.trim() || undefined,
        language: form.language || undefined,
        excludes: form.excludes ? form.excludes.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      });
      setForm({ name: '', repoType: 0, target: '', path: '', token: '', description: '', language: 'Golang', excludes: '' });
      await load();
      showToast('success', '创建成功');
    } catch (e) {
      showToast('error', (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除该仓库吗？')) return;
    try {
      await deleteRepo(id);
      await load();
      if (selectedRepoId === id) {
        setSelectedRepoId(null);
        setTree(null);
      }
      showToast('success', '删除成功');
    } catch (e) {
      showToast('error', (e as Error).message);
    }
  };

  const handleAnalyze = async (id: string) => {
    try {
      await analyzeRepo(id);
      showToast('success', '已触发分析');
    } catch (e) {
      showToast('error', (e as Error).message);
    }
  };

  const handleShowTree = async (id: string) => {
    setSelectedRepoId(id);
    try {
      const data = await getRepoTree(id);
      setTree(data);
      // 默认只展开根节点，不展开所有子包
      setExpandedPkgs(new Set(['root']));
    } catch (error) {
      showToast('error', `Failed to load repo tree: ${error}`);
    }
  };

  const handleViewFile = async (repoId: string, fileId: string, fileName: string) => {
    try {
      const fileData = await viewFileContent(repoId, fileId);
      setViewingFile({
        content: fileData.Content,
        language: fileData.language,
        fileName: fileName,
        functions: fileData.functions
      });
    } catch (error) {
      showToast('error', `Failed to view file: ${error}`);
    }
  };

  const handleFunctionClick = async (func: Function) => {
    try {
      // 切换到调用图标签页
      setActiveTab('callgraph');
      
      // 显示加载状态
      setCallGraphLoading(true);
      setCallGraphError(null);
      
      // 构建函数ID（使用函数的id字段）
      const functionId = func.id;
      
      // 获取调用关系数据
      const relationships = await fetchFunctionCalls(functionId);
      
      if (relationships.length === 0) {
        setCallGraphError('没有找到该函数的调用关系');
        setCallGraphLoading(false);
        return;
      }

      // 初始化节点和布局
      const newNodes = initializeNodes(relationships);
      setCallGraphNodes(newNodes);

      // 初始化可见节点（只显示根节点）
      const rootNodes = new Set<string>();
      relationships.forEach(rel => {
        const caller = newNodes.get(rel.callerId);
        if (caller && caller.parents.size === 0) {
          rootNodes.add(rel.callerId);
        }
      });
      if (rootNodes.size === 0 && relationships.length > 0) {
        rootNodes.add(relationships[0].callerId);
      }

      setVisibleCallGraphNodes(rootNodes);
      const positions = calculateGraphLayout(newNodes, rootNodes);
      setCallGraphNodePositions(positions);
      setSelectedCallGraphNode(null);
      
      // 关闭文件查看器
      setViewingFile(null);
      // 清除文件高亮状态
      setHighlightedFileId(null);
      
      showToast('success', `正在显示函数 ${functionId} 的调用图`);
      
    } catch (err) {
      setCallGraphError(err instanceof Error ? err.message : '获取调用关系失败');
      showToast('error', '获取调用关系失败');
    } finally {
      setCallGraphLoading(false);
    }
  };

  // 新增：调用图节点详情
  const handleCallGraphNodeClick = (nodeId: string) => {
    const node = callGraphNodes.get(nodeId);
    if (node) setSelectedCallGraphNode(node);
  };

  // 新增：查看文件详情
  const handleViewFileDetails = async (nodeId: string, fileId?: string) => {
    if (!fileId) {
      showToast('error', '无法查看文件详情：文件ID不存在');
      return;
    }
    
    try {
      // 切换到仓库结构标签页
      setActiveTab('tree');
      
      // 确保仓库树已加载
      if (!tree) {
        setTreeLoading(true);
        try {
          const data = await getRepoTree(selectedRepoId!);
          setTree(data);
          setExpandedPkgs(new Set());
        } catch (error) {
          showToast('error', `Failed to load repo tree: ${error}`);
          return;
        } finally {
          setTreeLoading(false);
        }
      }
      
      // 展开包含该文件的包
      const file = tree?.files.find(f => f.id === fileId);
      if (file) {
        // 设置当前高亮的文件
        setHighlightedFileId(fileId);
        
        setExpandedPkgs(prev => new Set([...Array.from(prev), file.pkgId]));
        
        // 延迟一下确保包已展开，然后查看文件内容
        setTimeout(async () => {
          try {
            const fileData = await viewFileContent(selectedRepoId!, fileId);
            
            // 查找并高亮显示相关函数
            const node = callGraphNodes.get(nodeId);
            
            setViewingFile({
              content: fileData.Content,
              language: fileData.language,
              fileName: file.name,
              functions: fileData.functions,
              highlightFunction: node?.name // 设置要高亮的函数名
            });
            
            if (node) {
              // 在文件内容中查找函数名并滚动到位置
              highlightFunctionInFile(node.name, fileData.Content);
            }
          } catch (error) {
            showToast('error', `Failed to view file: ${error}`);
          }
        }, 300);
      }
      
      showToast('success', `正在查看文件 ${file?.name || fileId}`);
      
    } catch (error) {
      showToast('error', `查看文件详情失败: ${error}`);
    }
  };

  // 新增：在文件中高亮函数
  const highlightFunctionInFile = (functionName: string, content: string) => {
    // 这里可以添加在代码查看器中高亮显示函数的逻辑
    // 由于CodeViewer组件已经有函数高亮功能，我们只需要确保它正确显示
    console.log(`Highlighting function ${functionName} in file content`);
  };

  // 新增：调用图节点展开/折叠处理
  const handleCallGraphNodeToggle = (nodeId: string) => {
    const node = callGraphNodes.get(nodeId);
    if (!node) return;

    const newVisibleNodes = new Set(visibleCallGraphNodes);
    if (node.expanded) {
      const removeChildren = (parentId: string) => {
        const parent = callGraphNodes.get(parentId);
        parent?.children.forEach(childId => {
          if (newVisibleNodes.has(childId)) {
            newVisibleNodes.delete(childId);
            removeChildren(childId);
          }
        });
      };
      removeChildren(nodeId);
      node.expanded = false;
    } else {
      node.children.forEach(childId => newVisibleNodes.add(childId));
      node.expanded = true;
    }

    setVisibleCallGraphNodes(newVisibleNodes);
    setCallGraphNodePositions(calculateGraphLayout(callGraphNodes, newVisibleNodes));
  };



  const filteredRepos = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.target || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
  }, [repos, filter]);

  const TreeView: React.FC<{ tree: RepoTreeResp; rootId?: string }> = ({ tree, rootId }) => {
    const pkgById = new Map(tree.packages.map(p => [p.id, p]));
    const fileById = new Map(tree.files.map(f => [f.id, f]));
    const pkgChildren = new Map<string, string[]>();
    const filesByPkg = new Map<string, string[]>();

    // 构建包层次结构
    tree.packages.forEach(pkg => {
      if (pkg.parentId) {
        if (!pkgChildren.has(pkg.parentId)) pkgChildren.set(pkg.parentId, []);
        pkgChildren.get(pkg.parentId)!.push(pkg.id);
      }
    });

    // 构建文件到包的映射
    tree.files.forEach(file => {
      if (!filesByPkg.has(file.pkgId)) filesByPkg.set(file.pkgId, []);
      filesByPkg.get(file.pkgId)!.push(file.id);
    });

    const togglePkg = (id: string) => {
      const newExpanded = new Set(expandedPkgs);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
        // 同时折叠所有子包
        const removeChildren = (parentId: string) => {
          newExpanded.delete(parentId);
          const children = pkgChildren.get(parentId) || [];
          children.forEach(childId => removeChildren(childId));
        };
        removeChildren(id);
      } else {
        newExpanded.add(id);
      }
      setExpandedPkgs(newExpanded);
    };

    // 新增：折叠所有包
    const collapseAll = () => {
      setExpandedPkgs(new Set(['root']));
    };

    // 新增：展开所有包（谨慎使用）
    const expandAll = () => {
      const allPkgIds = new Set(tree.packages.map(p => p.id));
      allPkgIds.add('root');
      setExpandedPkgs(allPkgIds);
    };

    const renderPkg = (pkgId: string | 'root', level: number) => {
      const ids = pkgChildren.get(pkgId) || [];
      const isRoot = pkgId === (rootId || 'root');
      const isExpanded = expandedPkgs.has(pkgId as string) || isRoot;
      
      // 限制默认展开深度，避免显示过多内容
      const shouldShowChildren = isExpanded && (isRoot || level < 2);
      
      return (
        <div key={pkgId} style={{ marginLeft: level * 16 }}>
          {!isRoot && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
              <span
                onClick={() => togglePkg(pkgId as string)}
                style={{ cursor: 'pointer', userSelect: 'none', fontSize: 12, color: '#6b7280', width: 14, display: 'inline-block' }}
                title={expandedPkgs.has(pkgId as string) ? '折叠' : '展开'}
              >{expandedPkgs.has(pkgId as string) ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 600 }}>{pkgById.get(pkgId as string)?.name}</span>
              {ids.length > 0 && (
                <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '8px' }}>
                  ({ids.length} 子包)
                </span>
              )}
            </div>
          )}
          {shouldShowChildren && ids.map(id => renderPkg(id, level + 1))}
          {!isRoot && isExpanded && (filesByPkg.get(pkgId as string) || []).map(fid => (
            <div 
              key={fid} 
              style={{ 
                marginLeft: 24, 
                color: '#374151', 
                fontSize: 13, 
                padding: '4px 8px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8,
                borderRadius: 6,
                backgroundColor: highlightedFileId === fid ? '#fef3c7' : 'transparent',
                border: highlightedFileId === fid ? '2px solid #f59e0b' : '1px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              📄 {fileById.get(fid)?.name}
              <button 
                onClick={() => handleViewFile(selectedRepoId!, fid, fileById.get(fid)?.name || '')}
                style={{ 
                  fontSize: 11, 
                  padding: '2px 6px', 
                  background: highlightedFileId === fid ? '#f59e0b' : '#3b82f6', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 4, 
                  cursor: 'pointer' 
                }}
              >
                查看
              </button>
            </div>
          ))}
        </div>
      );
    };

    return (
      <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, background: '#fff' }}>
        {/* 新增：树形视图控制按钮 */}
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginBottom: '12px', 
          padding: '8px', 
          background: '#f9fafb', 
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          <button 
            onClick={collapseAll}
            style={{ 
              ...styles.btn, 
              fontSize: '11px', 
              padding: '4px 8px',
              background: '#fff',
              border: '1px solid #d1d5db'
            }}
          >
            折叠所有
          </button>
          <button 
            onClick={expandAll}
            style={{ 
              ...styles.btn, 
              fontSize: '11px', 
              padding: '4px 8px',
              background: '#fff',
              border: '1px solid #d1d5db'
            }}
          >
            展开所有
          </button>
          <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: 'auto', alignSelf: 'center' }}>
            默认只展开前2层，点击包名展开/折叠
          </span>
        </div>
        {renderPkg((rootId || 'root') as any, 0)}
      </div>
    );
  };

  // 新增：渲染调用图内容
  const renderCallGraphContent = () => {
    if (callGraphLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div style={{
            border: '5px solid #f3f3f3',
            borderTop: '5px solid #3498db',
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>正在加载调用关系...</p>
        </div>
      );
    }

    if (callGraphError) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h3>错误</h3>
          <p>{callGraphError}</p>
          <button 
            onClick={() => setCallGraphError(null)} 
            style={{ ...styles.btn, ...styles.btnPrimary }}
          >
            重试
          </button>
        </div>
      );
    }

    if (visibleCallGraphNodes.size === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
          <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>调用关系图</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px' }}>
            请在代码查看器中点击函数来查看调用关系图
          </p>
          <div style={{ 
            background: '#f9fafb', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px', 
            padding: '16px', 
            textAlign: 'left',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#374151' }}>使用步骤：</h4>
            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
              <li>选择左侧仓库并查看结构</li>
              <li>点击文件查看代码内容</li>
              <li>在代码中点击函数名称</li>
              <li>系统将显示该函数的调用关系图</li>
            </ol>
          </div>
        </div>
      );
    }

    return (
      <CallGraph
        nodes={callGraphNodes}
        visibleNodes={visibleCallGraphNodes}
        nodePositions={callGraphNodePositions}
        onNodeClick={handleCallGraphNodeClick}
        onNodeToggle={handleCallGraphNodeToggle}
        focusedNodeId={selectedCallGraphNode?.id}
      />
    );
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: toast.type === 'success' ? '#10b981' : '#ef4444', color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.15)', minWidth: 200
            }}>
              {toast.message}
            </div>
          </div>
        )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <CodeViewer
          content={viewingFile.content}
          language={viewingFile.language}
          fileName={viewingFile.fileName}
          functions={viewingFile.functions}
          highlightFunction={viewingFile.highlightFunction}
          onClose={() => {
            setViewingFile(null);
            setHighlightedFileId(null);
          }}
          onFunctionClick={handleFunctionClick}
        />
      )}

      {/* 左侧：创建表单 + 列表 */}
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>仓库列表</h3>
            <span style={{ fontSize: 12, color: '#6b7280' }}>共 {repos.length} 个</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input style={styles.input} placeholder="搜索名称/目标/描述" value={filter} onChange={e => setFilter(e.target.value)} />
            <button style={{ ...styles.btn }} onClick={() => setFilter('')}>清空</button>
          </div>

          {loading ? (
            <div>加载中...</div>
          ) : error ? (
            <div style={{ color: '#ef4444' }}>{error}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredRepos.map(r => (
                <div key={r.id} style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{r.name}</div>
                      <span style={styles.badge(repoTypeOptions[r.repoType as number]?.color || '#6b7280')}>
                        {repoTypeOptions[r.repoType as number]?.label || '未知'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{r.id}</div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>🎯 {r.target}</div>
                  {r.path && <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>📂 {r.path}</div>}
                  {r.description && <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>📝 {r.description}</div>}
                  <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                    语言：{(r.language as string) || '未设置'}
                  </div>
                  {Array.isArray(r.excludes) && r.excludes.length > 0 && (
                    <div style={{ marginTop: 2, fontSize: 12, color: '#6b7280' }}>排除：{r.excludes.join(', ')}</div>
                  )}
                  <div style={{ ...styles.toolbar, marginTop: 10 }}>
                    <button style={{ ...styles.btn, ...styles.btnGhost }} onClick={() => handleShowTree(r.id)}>查看树</button>
                    <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => handleAnalyze(r.id)}>分析</button>
                    <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={() => handleDelete(r.id)}>删除</button>
                  </div>
                </div>
              ))}
              {filteredRepos.length === 0 && <div style={{ color: '#6b7280' }}>无匹配结果</div>}
            </div>
          )}
        </div>

        <div style={styles.card}>
          <h3 style={{ margin: 0, marginBottom: 12 }}>创建仓库</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={styles.label}>名称</div>
              <input style={styles.input} placeholder="例如：my-service" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <div style={styles.label}>类型</div>
              <select style={styles.input as React.CSSProperties} value={form.repoType} onChange={e => setForm({ ...form, repoType: Number(e.target.value) })}>
                {repoTypeOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={styles.label}>目标（远端地址或本地路径）</div>
              <input style={styles.input} placeholder="https://github.com/org/repo 或 D:/code/project" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={styles.label}>本地路径（可选）</div>
                <input style={styles.input} placeholder="D:/code/project" value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} />
              </div>
              <div>
                <div style={styles.label}>Token（可选）</div>
                <input style={styles.input} placeholder="GitHub Token" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={styles.label}>语言</div>
                <select style={styles.input as React.CSSProperties} value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}>
                  {languageOptions.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              </div>
              <div>
                <div style={styles.label}>排除目录（逗号分隔）</div>
                <input style={styles.input} placeholder="vendor,node_modules,build" value={form.excludes} onChange={e => setForm({ ...form, excludes: e.target.value })} />
              </div>
            </div>
            <div>
              <div style={styles.label}>描述（可选）</div>
              <input style={styles.input} placeholder="用途说明" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={styles.toolbar}>
              <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }}>创建</button>
              <button type="button" style={{ ...styles.btn, ...styles.btnGhost }} onClick={() => setForm({ name: '', repoType: 0, target: '', path: '', token: '', description: '', language: 'Golang', excludes: '' })}>重置</button>
            </div>
          </form>
        </div>
      </div>

      {/* 右侧：仓库树 + 调用图 */}
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>仓库分析</h3>
          {selectedRepoId && <span style={{ fontSize: 12, color: '#6b7280' }}>Repo ID: {selectedRepoId}</span>}
        </div>
        
        {/* 标签页切换 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button 
            onClick={() => setActiveTab('tree')} 
            style={{ 
              ...styles.btn, 
              ...(activeTab === 'tree' ? styles.btnPrimary : styles.btnGhost),
              padding: '8px 16px'
            }}
          >
            仓库结构
          </button>
          <button 
            onClick={() => setActiveTab('callgraph')} 
            style={{ 
              ...styles.btn, 
              ...(activeTab === 'callgraph' ? styles.btnPrimary : styles.btnGhost),
              padding: '8px 16px'
            }}
          >
            调用图
          </button>
        </div>

        {/* 标签页内容 */}
        {activeTab === 'tree' ? (
          <div>
            {treeLoading ? (
              <div style={styles.card}>加载树...</div>
            ) : selectedRepoId && tree ? (
              <TreeView tree={tree} rootId={selectedRepoId || undefined} />
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '50px', 
                color: '#6b7280',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
                <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>仓库结构</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px' }}>
                  请选择左侧仓库查看包/文件结构
                </p>
                <div style={{ 
                  background: '#fff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '6px', 
                  padding: '12px', 
                  textAlign: 'left',
                  maxWidth: '300px',
                  margin: '0 auto'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#374151' }}>操作说明：</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', lineHeight: '1.5' }}>
                    <li>点击仓库名称查看结构</li>
                    <li>点击包名展开/折叠子包</li>
                    <li>点击文件名查看代码内容</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            {renderCallGraphContent()}
          </div>
        )}
        
        {/* 调用图节点详情 */}
        {activeTab === 'callgraph' && selectedCallGraphNode && (
          <NodeDetails
            selectedNode={selectedCallGraphNode}
            onClose={() => setSelectedCallGraphNode(null)}
            onViewFileDetails={handleViewFileDetails}
          />
        )}
      </div>
    </div>
    
    <style>{`
      @keyframes spin { 
        0% { transform: rotate(0deg); } 
        100% { transform: rotate(360deg); } 
      }
    `}</style>
    </>
  );
};

export default RepoManager;
