import React, { useEffect, useMemo, useState } from 'react';
import { Repo, RepoTreeResp, Function, CallRelation, Node, NodePosition } from '../types';
import { listRepos, createRepo, deleteRepo, analyzeRepo, getRepoTree, viewFileContent, fetchFunctionCalls, getImplement } from '../services/api';
import CodeViewer from './CodeViewer';
import CallGraph from './CallGraph';
import NodeDetails from './NodeDetails';
import CodeSearch from './CodeSearch';
import ErrorBoundary from './ErrorBoundary';
import { initializeNodes, calculateGraphLayout } from '../utils/graphUtils';

// 新增：树状布局计算函数
const calculateTreeLayout = (
  nodes: Map<string, Node>,
  visibleNodes: Set<string>
): Map<string, NodePosition> => {
  const positions = new Map<string, NodePosition>();
  const levels = new Map<number, string[]>();
  
  // 重置所有节点的层级
  visibleNodes.forEach(nodeId => {
    const node = nodes.get(nodeId);
    if (node) {
      node.level = 0;
    }
  });
  
  // 分配层级 - 使用拓扑排序
  const assignLevels = (nodeId: string, level: number, visited: Set<string>) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.get(nodeId);
    if (!node) return;
    
    // 确保节点层级不小于当前层级
    node.level = Math.max(node.level, level);
    
    if (!levels.has(level)) {
      levels.set(level, []);
    }
    if (!levels.get(level)!.includes(nodeId)) {
      levels.get(level)!.push(nodeId);
    }
    
    // 为子节点分配下一层级
    node.children.forEach(childId => {
      if (visibleNodes.has(childId)) {
        assignLevels(childId, level + 1, visited);
      }
    });
  };
  
  // 从根节点开始分配层级
  const visited = new Set<string>();
  visibleNodes.forEach(nodeId => {
    const node = nodes.get(nodeId);
    if (node && node.parents.size === 0) {
      assignLevels(nodeId, 0, visited);
    }
  });
  
  // 处理剩余的节点（可能是孤立的）
  visibleNodes.forEach(nodeId => {
    if (!visited.has(nodeId)) {
      const node = nodes.get(nodeId);
      if (node) {
        const maxLevel = levels.size > 0 ? Math.max(...Array.from(levels.keys())) : 0;
        assignLevels(nodeId, maxLevel + 1, visited);
      }
    }
  });
  
  // 如果没有找到任何层级，将所有节点放在同一层级
  if (levels.size === 0) {
    levels.set(0, Array.from(visibleNodes));
  }
  
  // 树状布局使用固定的间距
  const TREE_GAP_X = 200;  // 水平间距
  const TREE_GAP_Y = 100;  // 垂直间距
  
  // 根节点固定在左上角(0,0)
  const baseX = 0;
  const baseY = 0;
  
  // 从左到右（按层级）布局，每一列（层）垂直等间距排布
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  
  sortedLevels.forEach((level) => {
    const x = baseX + level * TREE_GAP_X;
    const nodeIds = levels.get(level)!;
    
    // 计算该层级节点的Y坐标，使其垂直居中
    const totalHeight = (nodeIds.length - 1) * TREE_GAP_Y;
    const startY = baseY - totalHeight / 2;
    
    nodeIds.forEach((nodeId, index) => {
      const y = startY + index * TREE_GAP_Y;
      positions.set(nodeId, { x, y });
    });
  });
  
  return positions;
};

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
  const [expandedPkgs, setExpandedPkgs] = useState<Set<string>>(new Set(['root']));
  const [viewingFile, setViewingFile] = useState<{ content: string; language: string; fileName: string; functions: Function[]; highlightFunction?: string } | null>(null);
  // 新增：当前高亮的文件ID
  const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);
  
  // 新增：调用图相关状态
  const [activeTab, setActiveTab] = useState<'tree' | 'callgraph' | 'search'>('tree');
  const [callGraphNodes, setCallGraphNodes] = useState<Map<string, Node>>(new Map());
  const [visibleCallGraphNodes, setVisibleCallGraphNodes] = useState<Set<string>>(new Set());
  const [callGraphNodePositions, setCallGraphNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [selectedCallGraphNode, setSelectedCallGraphNode] = useState<Node | null>(null);
  const [callGraphLoading, setCallGraphLoading] = useState(false);
  const [callGraphError, setCallGraphError] = useState<string | null>(null);

  // 新增：接口与实现的虚线连接关系
  const [interfaceImplementationLinks, setInterfaceImplementationLinks] = useState<Map<string, string>>(new Map());
  
  // 优化：使用useMemo缓存repoName计算，避免不必要的重新渲染
  const selectedRepoName = useMemo(() => {
    if (!selectedRepoId) return '';
    return repos.find(r => r.id === selectedRepoId)?.name || '未知仓库';
  }, [repos, selectedRepoId]);
  
  // 新增：处理调用图更新 - 改进版本
  const handleUpdateCallGraph = (callRelations: CallRelation[], selectedNodeId?: string) => {
    console.log('RepoManager: handleUpdateCallGraph called with', callRelations.length, 'relations, selectedNodeId:', selectedNodeId);
    
    // 如果提供了 selectedNodeId，先清理之前该节点的实现调用链
    if (selectedNodeId) {
      // 清理旧的接口实现连接关系
      setInterfaceImplementationLinks(prevLinks => {
        const updatedLinks = new Map(prevLinks);
        // 删除与当前选中节点相关的接口实现连接
        updatedLinks.forEach((implId, interfaceId) => {
          // 如果接口ID或实现ID与当前选中节点相关，则删除该连接
          if (interfaceId === selectedNodeId || implId === selectedNodeId) {
            updatedLinks.delete(interfaceId);
          }
        });
        return updatedLinks;
      });
      
      setCallGraphNodes(prevNodes => {
        const updatedNodes = new Map(prevNodes);
        
        // 找到并删除之前该节点的实现调用链节点
        const nodesToRemove = new Set<string>();
        
        // 遍历所有节点，找到属于之前实现调用链的节点
        updatedNodes.forEach((node, nodeId) => {
          // 如果节点属于之前的实现调用链，则标记为删除
          if (node.implementationChainId && node.implementationChainId !== implementationChainId) {
            nodesToRemove.add(nodeId);
          }
        });
        
        // 删除标记的节点
        nodesToRemove.forEach(nodeId => {
          updatedNodes.delete(nodeId);
        });
        
        return updatedNodes;
      });
      
      // 清理可见节点集合，移除之前实现调用链的节点
      setVisibleCallGraphNodes(prevVisible => {
        const newVisible = new Set(prevVisible);
        
        // 移除属于之前实现调用链的节点
        prevVisible.forEach(nodeId => {
          const node = callGraphNodes.get(nodeId);
          if (node && node.implementationChainId && node.implementationChainId !== implementationChainId) {
            newVisible.delete(nodeId);
          }
        });
        
        return newVisible;
      });
    }
    
    // 将新的调用关系转换为节点，保持与主调用链相同的逻辑
    const newNodes = new Map<string, Node>();
    
    // 为新的实现调用链生成一个唯一标识
    const implementationChainId = `impl_${selectedNodeId || 'unknown'}_${Date.now()}`;
    console.log(`创建新的实现调用链: ${implementationChainId}`);
    
    // 确定实现调用链的根节点
    // 如果 callRelations 不为空，第一个调用者就是实现调用链的根节点
    const implementationRootId = callRelations.length > 0 ? callRelations[0].callerId : null;
    
    // 如果提供了 selectedNodeId（接口方法），我们需要在接口方法和实现方法之间建立连接
    if (selectedNodeId && implementationRootId) {
      // 创建接口方法节点（如果不存在）
      if (!newNodes.has(selectedNodeId)) {
        const existingInterfaceNode = callGraphNodes.get(selectedNodeId);
        if (existingInterfaceNode) {
          const interfaceNode: Node = {
            ...existingInterfaceNode,
            children: new Set<string>(),
            parents: new Set<string>(),
            expanded: true,
            implementationChainId: implementationChainId
          };
          newNodes.set(selectedNodeId, interfaceNode);
        }
      }
      
      // 创建实现方法节点（如果不存在）
      if (!newNodes.has(implementationRootId)) {
        const existingImplNode = callGraphNodes.get(implementationRootId);
        if (existingImplNode) {
          const implNode: Node = {
            ...existingImplNode,
            children: new Set<string>(),
            parents: new Set<string>(),
            // 实现方法默认展开，方便查看调用链
            expanded: true,
            implementationChainId: implementationChainId
          };
          newNodes.set(implementationRootId, implNode);
        }
      }
      
      // 建立接口方法到实现方法的连接
      const interfaceNode = newNodes.get(selectedNodeId);
      const implNode = newNodes.get(implementationRootId);
      if (interfaceNode && implNode) {
        interfaceNode.children.add(implementationRootId);
        implNode.parents.add(selectedNodeId);
        console.log(`建立接口到实现的连接: ${selectedNodeId} -> ${implementationRootId}`);
      }
    }
    
    // 设置实现调用链的根节点为接口方法（用于可见性控制）
    const rootNodeId = selectedNodeId;
    
    callRelations.forEach((relation, index) => {
      // 创建调用者节点
      if (!newNodes.has(relation.callerId)) {
        // 检查是否已存在于主调用图中
        const existingCaller = callGraphNodes.get(relation.callerId);
        if (existingCaller) {
          // 如果已存在，复制现有节点信息，但重置关系
          newNodes.set(relation.callerId, {
            ...existingCaller,
            children: new Set(),
            parents: new Set(),
            // 实现方法默认展开，其他节点默认闭合
            expanded: existingCaller.expanded || relation.callerId === implementationRootId,
            // 标记为属于当前实现调用链
            implementationChainId: implementationChainId
          });
        } else {
          // 如果不存在，创建新节点
          newNodes.set(relation.callerId, {
            id: relation.callerId,
            name: relation.callerName,
            type: 'caller',
            level: 0,
            // 实现方法默认展开，其他节点默认闭合
            expanded: relation.callerId === implementationRootId,
            scope: relation.callerScope,
            entityId: relation.callerEntityId,
            fileId: relation.callerFileId,
            children: new Set(),
            parents: new Set(),
            // 标记为属于当前实现调用链
            implementationChainId: implementationChainId
          });
        }
      } else {
        // 如果节点已存在，确保它有正确的 implementationChainId
        const existingNode = newNodes.get(relation.callerId)!;
        existingNode.implementationChainId = implementationChainId;
      }
      
      // 创建被调用者节点
      if (!newNodes.has(relation.calleeId)) {
        // 检查是否已存在于主调用图中
        const existingCallee = callGraphNodes.get(relation.calleeId);
        if (existingCallee) {
          // 如果已存在，复制现有节点信息，但重置关系
          newNodes.set(relation.calleeId, {
            ...existingCallee,
            children: new Set(),
            parents: new Set(),
            // 实现方法默认展开，其他节点默认闭合
            expanded: existingCallee.expanded || relation.calleeId === implementationRootId,
            // 标记为属于当前实现调用链
            implementationChainId: implementationChainId
          });
        } else {
          // 如果不存在，创建新节点
          newNodes.set(relation.calleeId, {
            id: relation.calleeId,
            name: relation.calleeName,
            type: 'callee',
            level: 1,
            // 实现方法默认展开，其他节点默认闭合
            expanded: relation.calleeId === implementationRootId,
            scope: relation.calleeScope,
            entityId: relation.calleeEntityId,
            fileId: relation.calleeFileId,
            children: new Set(),
            parents: new Set(),
            // 标记为属于当前实现调用链
            implementationChainId
          });
        }
      } else {
        // 如果节点已存在，确保它有正确的 implementationChainId
        const existingNode = newNodes.get(relation.calleeId)!;
        existingNode.implementationChainId = implementationChainId;
      }
      
      // 建立父子关系
      const callerNode = newNodes.get(relation.callerId)!;
      const calleeNode = newNodes.get(relation.calleeId)!;
      
      callerNode.children.add(relation.calleeId);
      calleeNode.parents.add(relation.callerId);
      
      console.log(`建立父子关系: ${relation.callerId} -> ${relation.calleeId}`);
      console.log(`调用者节点 ${relation.callerId} 的子节点:`, Array.from(callerNode.children));
      console.log(`被调用者节点 ${relation.calleeId} 的父节点:`, Array.from(calleeNode.parents));
    });
    
    // 调试：显示创建的节点信息
    console.log(`创建了 ${newNodes.size} 个节点，实现调用链ID: ${implementationChainId}`);
    console.log(`根节点ID: ${rootNodeId}`);
    newNodes.forEach((node, id) => {
      console.log(`节点 ${id}: implementationChainId = ${node.implementationChainId}, children = ${Array.from(node.children)}, parents = ${Array.from(node.parents)}`);
    });
    

    
    // 建立接口与实现之间的虚线连接关系
    const newInterfaceLinks = new Map<string, string>();
    
    // 遍历新的调用关系，查找接口与实现的连接
    callRelations.forEach((relation) => {
      // 如果被调用者是接口（scope === '3'），且调用者是实现类
      if (relation.calleeScope === '3' && relation.callerScope === '1') {
        // 建立接口到实现的虚线连接
        newInterfaceLinks.set(relation.calleeId, relation.callerId);
      }
      
      // 如果调用者是接口（scope === '3'），且被调用者是实现类
      if (relation.callerScope === '3' && relation.calleeScope === '1') {
        // 建立接口到实现的虚线连接
        newInterfaceLinks.set(relation.callerId, relation.calleeId);
      }
    });
    
    // 更新接口实现连接关系
    setInterfaceImplementationLinks(prevLinks => {
      const updatedLinks = new Map(prevLinks);
      newInterfaceLinks.forEach((implId, interfaceId) => {
        updatedLinks.set(interfaceId, implId);
      });
      return updatedLinks;
    });
    
    // 更新现有的调用图节点
    setCallGraphNodes(prevNodes => {
      const updatedNodes = new Map(prevNodes);
      
      // 添加新节点
      newNodes.forEach((node, id) => {
        updatedNodes.set(id, node);
      });
      
      return updatedNodes;
    });
    
    // 对于Mermaid布局，显示所有节点以获得完整的调用图
    const allNodes = new Set(newNodes.keys());
    setVisibleCallGraphNodes(allNodes);
    console.log(`Mermaid布局显示所有节点:`, Array.from(allNodes));
    
    // 重新计算布局，确保新节点放在当前选中节点的后面，使用与主图一致的间距
    setTimeout(() => {
      // 使用与主图一致的间距常量
      const FIXED_GAP_X = 280;  // 水平间距固定为280
      const FIXED_GAP_Y = 120;  // 垂直间距固定为120
      
      // 使用 newNodes 和现有的 callGraphNodePositions 来计算位置
      const positions = new Map<string, NodePosition>();
      
      if (rootNodeId && callGraphNodePositions.has(rootNodeId)) {
        const rootPosition = callGraphNodePositions.get(rootNodeId)!;
        
        // 为新的调用链节点分配位置
        newNodes.forEach((node, nodeId) => {
          if (nodeId === rootNodeId) {
            // 接口方法保持原位置
            positions.set(nodeId, rootPosition);
          } else if (node.parents.has(rootNodeId)) {
            // 实现方法放在接口方法的右侧，使用主图间距
            const x = rootPosition.x + FIXED_GAP_X;
            const y = rootPosition.y;
            const newPos = { x, y };
            positions.set(nodeId, newPos);
          } else {
            // 其他节点按层级排列在实现方法的右侧，使用主图间距
            const level = node.level;
            const x = rootPosition.x + (FIXED_GAP_X * 2) + (level * FIXED_GAP_X);
            const y = rootPosition.y + (level * FIXED_GAP_Y);
            const newPos = { x, y };
            positions.set(nodeId, newPos);
          }
        });
      } else {
        // 现在默认使用Mermaid布局，不需要预先计算位置
        // const newVisibleNodes = new Set(newNodes.keys());
        // const positions = calculateTreeLayout(newNodes, newVisibleNodes);
        
        // 更新位置
        // setCallGraphNodePositions(prevPositions => {
        //   const newPositions = new Map(prevPositions);
        //   positions.forEach((pos, id) => {
        //     newPositions.set(id, pos);
        //   });
        //   return newPositions;
        // });
        return;
      }
      
      // 更新位置
      setCallGraphNodePositions(prevPositions => {
        const newPositions = new Map(prevPositions);
        positions.forEach((pos, id) => {
          newPositions.set(id, pos);
        });
        return newPositions;
      });
    }, 100);
    
    showToast('success', `成功更新调用链，添加 ${callRelations.length} 个调用关系`);
    

  };

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
      
      // 获取调用关系数据，传递函数名称用于更好的日志记录
      const relationships = await fetchFunctionCalls(functionId, func.name);
      
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

      // 对于Mermaid布局，显示所有节点以获得完整的调用图
      const allNodes = new Set(newNodes.keys());
      setVisibleCallGraphNodes(allNodes);
      
      // 现在默认使用Mermaid布局，不需要预先计算位置
      // const positions = calculateTreeLayout(newNodes, rootNodes);
      // setCallGraphNodePositions(positions);
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

    // 对于Mermaid布局，始终显示所有节点以获得完整的调用图
    const allNodes = new Set(callGraphNodes.keys());
    setVisibleCallGraphNodes(allNodes);
    // 现在默认使用Mermaid布局，不需要重新计算位置
    // setCallGraphNodePositions(calculateTreeLayout(callGraphNodes, newVisibleNodes));
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
    
    // 新增：文件名搜索相关状态
    const [fileSearchQuery, setFileSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; pkgName: string; pkgPath: string }>>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [selectedResultIndex, setSelectedResultIndex] = useState(-1); // 当前选中的搜索结果索引

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

    // 新增：文件名搜索逻辑
    const searchFiles = (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      const results: Array<{ id: string; name: string; pkgName: string; pkgPath: string }> = [];
      const queryLower = query.toLowerCase();

      // 遍历所有文件，查找匹配的文件名
      tree.files.forEach(file => {
        if (file.name.toLowerCase().includes(queryLower)) {
          // 找到文件所属的包
          const pkg = pkgById.get(file.pkgId);
          if (pkg) {
            // 构建包的完整路径
            const pkgPath = buildPackagePath(pkg.id);
            results.push({
              id: file.id,
              name: file.name,
              pkgName: pkg.name,
              pkgPath: pkgPath
            });
          }
        }
      });

      // 按相关性排序：完全匹配 > 开头匹配 > 包含匹配
      results.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // 完全匹配优先级最高
        if (aName === queryLower && bName !== queryLower) return -1;
        if (bName === queryLower && aName !== queryLower) return 1;
        
        // 开头匹配优先级次之
        if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
        if (bName.startsWith(queryLower) && !aName.startsWith(queryLower)) return 1;
        
        // 按文件名长度排序（短文件名优先）
        return aName.length - bName.length;
      });

      setSearchResults(results.slice(0, 20)); // 限制结果数量
      setShowSearchResults(true);
      setSelectedResultIndex(-1); // 重置选中索引
    };

    // 新增：构建包的完整路径
    const buildPackagePath = (pkgId: string): string => {
      const path: string[] = [];
      let currentPkgId = pkgId;
      
      while (currentPkgId) {
        const pkg = pkgById.get(currentPkgId);
        if (pkg) {
          path.unshift(pkg.name);
          currentPkgId = pkg.parentId || '';
        } else {
          break;
        }
      }
      
      return path.join('/');
    };

    // 新增：处理文件搜索选择
    const handleFileSelect = (fileId: string) => {
      // 展开到该文件所在的包
      const file = fileById.get(fileId);
      if (file) {
        console.log(`开始处理文件选择: ${file.name}, 文件ID: ${fileId}`);
        console.log(`文件所属包ID: ${file.pkgId}`);
        
        // 收集所有需要展开的包ID
        const packagesToExpand = new Set<string>();
        
        // 添加根节点
        packagesToExpand.add('root');
        if (rootId && rootId !== 'root') {
          packagesToExpand.add(rootId);
        }
        
        // 递归收集所有父包ID
        const collectParentPackages = (pkgId: string) => {
          packagesToExpand.add(pkgId);
          const pkg = pkgById.get(pkgId);
          if (pkg && pkg.parentId) {
            collectParentPackages(pkg.parentId);
          }
        };
        
        // 收集从文件包到根节点的所有包ID
        collectParentPackages(file.pkgId);
        
        console.log(`需要展开的包ID列表:`, Array.from(packagesToExpand));
        
        // 更新展开状态
        setExpandedPkgs(packagesToExpand);
        
        // 高亮该文件
        setHighlightedFileId(fileId);
        
        // 关闭搜索结果
        setShowSearchResults(false);
        setFileSearchQuery('');
        setSelectedResultIndex(-1); // 重置选中索引
        
        // 显示展开的包结构信息
        const expandedPackages = getExpandedPackagePath(file.pkgId);
        console.log(`展开的包路径: ${expandedPackages.join(' -> ')}`);
        
        // 使用更智能的等待机制，等待DOM更新完成
        setTimeout(() => {
          waitForFileElement(fileId);
        }, 200); // 给React状态更新一些时间
      }
    };

    // 新增：获取展开的包路径
    const getExpandedPackagePath = (pkgId: string): string[] => {
      const path: string[] = [];
      let currentPkgId = pkgId;
      
      while (currentPkgId) {
        const pkg = pkgById.get(currentPkgId);
        if (pkg) {
          path.unshift(pkg.name);
          currentPkgId = pkg.parentId || '';
        } else {
          break;
        }
      }
      
      // 添加根节点
      if (rootId && rootId !== 'root') {
        path.unshift(rootId);
      }
      path.unshift('root');
      
      return path;
    };

    // 新增：等待文件元素出现
    const waitForFileElement = (fileId: string, maxAttempts: number = 10, attempt: number = 0) => {
      if (attempt >= maxAttempts) {
        console.error(`等待文件元素超时: ${fileId}, 已尝试 ${maxAttempts} 次`);
        console.log(`当前展开的包:`, Array.from(expandedPkgs));
        console.log(`当前可见的文件元素:`, document.querySelectorAll('[data-file-id]').length);
        return;
      }
      
      const fileElement = document.querySelector(`[data-file-id="${fileId}"]`) as HTMLElement;
      if (fileElement) {
        console.log(`文件元素已找到: ${fileId}, 尝试次数: ${attempt + 1}`);
        // 文件元素已存在，执行滚动
        scrollToFileInTree(fileId);
      } else {
        console.log(`等待文件元素: ${fileId}, 尝试次数: ${attempt + 1}/${maxAttempts}`);
        console.log(`当前展开的包:`, Array.from(expandedPkgs));
        console.log(`当前可见的文件元素:`, document.querySelectorAll('[data-file-id]').length);
        
        // 检查文件是否应该可见
        const file = fileById.get(fileId);
        if (file) {
          console.log(`文件 ${file.name} 应该在包 ${file.pkgId} 中`);
          console.log(`包 ${file.pkgId} 是否展开:`, expandedPkgs.has(file.pkgId));
        }
        
        // 等待100ms后重试
        setTimeout(() => {
          waitForFileElement(fileId, maxAttempts, attempt + 1);
        }, 100);
      }
    };

    // 新增：滚动到树中的文件位置
    const scrollToFileInTree = (fileId: string) => {
      const fileElement = document.querySelector(`[data-file-id="${fileId}"]`) as HTMLElement;
      if (fileElement) {
        // 滚动到文件元素位置
        fileElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        // 添加闪烁动画效果，让用户更容易看到
        fileElement.style.animation = 'fileHighlight 1s ease-in-out';
        
        // 动画结束后移除动画样式
        setTimeout(() => {
          fileElement.style.animation = '';
        }, 1000);
        
        console.log(`成功滚动到文件: ${fileId}`);
      } else {
        console.error(`滚动时文件元素未找到: ${fileId}`);
      }
    };

    // 新增：键盘导航处理
    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
      if (!showSearchResults || searchResults.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedResultIndex(prev => 
            prev < searchResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedResultIndex(prev => 
            prev > 0 ? prev - 1 : searchResults.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedResultIndex >= 0 && selectedResultIndex < searchResults.length) {
            const selectedResult = searchResults[selectedResultIndex];
            handleFileSelect(selectedResult.id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSearchResults(false);
          setSelectedResultIndex(-1);
          break;
      }
    };

    // 新增：滚动到选中项
    useEffect(() => {
      if (selectedResultIndex >= 0 && showSearchResults) {
        const resultElement = document.querySelector(`[data-result-index="${selectedResultIndex}"]`) as HTMLElement;
        if (resultElement) {
          resultElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }
      }
    }, [selectedResultIndex, showSearchResults]);

    // 新增：点击外部区域关闭搜索结果
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-search-container]')) {
          setShowSearchResults(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);

    const renderPkg = (pkgId: string | 'root', level: number) => {
      const ids = pkgChildren.get(pkgId) || [];
      const isRoot = pkgId === (rootId || 'root');
      const isExpanded = expandedPkgs.has(pkgId as string) || isRoot;
      
      // 显示子包：根节点默认展开，其他节点根据用户手动展开状态显示
      const shouldShowChildren = isExpanded;
      
      // 调试信息
      if (isRoot) {
        console.log(`渲染根节点: ${pkgId}, 展开状态: ${isExpanded}, 子包数量: ${ids.length}`);
      }
      
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
              data-file-id={fid}
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
        {/* 新增：文件名搜索框 */}
        <div 
          data-search-container
          style={{ 
            marginBottom: '12px',
            position: 'relative'
          }}
        >
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            alignItems: 'center'
          }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 搜索文件名..."
                value={fileSearchQuery}
                onChange={(e) => {
                  const query = e.target.value;
                  setFileSearchQuery(query);
                  searchFiles(query);
                }}
                onFocus={() => {
                  if (fileSearchQuery.trim()) {
                    setShowSearchResults(true);
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                style={{
                  ...styles.input,
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px'
                }}
              />
              
              {/* 搜索结果下拉框 */}
              {showSearchResults && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {searchResults.map((result, index) => (
                    <div
                      key={result.id}
                      data-result-index={index}
                      onClick={() => handleFileSelect(result.id)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: index < searchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'background-color 0.2s',
                        backgroundColor: index === selectedResultIndex ? '#3b82f6' : 'transparent',
                        color: index === selectedResultIndex ? 'white' : 'inherit'
                      }}
                      onMouseEnter={(e) => {
                        if (index !== selectedResultIndex) {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }
                        setSelectedResultIndex(index);
                      }}
                      onMouseLeave={(e) => {
                        if (index !== selectedResultIndex) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div style={{ 
                        fontWeight: '500', 
                        color: index === selectedResultIndex ? 'white' : '#374151',
                        fontSize: '13px'
                      }}>
                        📄 {result.name}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: index === selectedResultIndex ? 'rgba(255,255,255,0.8)' : '#6b7280',
                        fontFamily: 'monospace'
                      }}>
                        📁 {result.pkgPath}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {fileSearchQuery && (
              <button
                onClick={() => {
                  setFileSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                style={{
                  ...styles.btn,
                  fontSize: '11px',
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db'
                }}
              >
                清空
              </button>
            )}
          </div>
          
          {/* 搜索结果统计和键盘提示 */}
          {searchResults.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '4px',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '11px',
                color: '#6b7280',
                padding: '4px 8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                找到 {searchResults.length} 个匹配文件
              </div>
              <div style={{
                fontSize: '10px',
                color: '#9ca3af',
                padding: '4px 8px',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                border: '1px solid #e5e7eb'
              }}>
                ⌨️ ↑↓ 选择 | Enter 确认 | Esc 关闭
              </div>
            </div>
          )}
        </div>

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
            点击包名展开/折叠，支持无限层级
          </span>
        </div>
        <div style={{ 
          maxHeight: '600px', 
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '8px'
        }}>
          {renderPkg((rootId || 'root') as any, 0)}
        </div>
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
        interfaceImplementationLinks={interfaceImplementationLinks}
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
        
        {/* 标签页按钮 */}
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
          <button 
            onClick={() => setActiveTab('search')} 
            style={{ 
              ...styles.btn, 
              ...(activeTab === 'search' ? styles.btnPrimary : styles.btnGhost),
              padding: '8px 16px'
            }}
          >
            AI问答
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
                    <li>点击包名展开/折叠子包（支持无限层级）</li>
                    <li>点击文件名查看代码内容</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'callgraph' ? (
          <div>
            {renderCallGraphContent()}
          </div>
        ) : activeTab === 'search' ? (
          <div>
            {selectedRepoId ? (
              <ErrorBoundary>
                <CodeSearch 
                  key={selectedRepoId} // 添加key确保组件稳定性
                  repoId={selectedRepoId} 
                  repoName={selectedRepoName} 
                />
              </ErrorBoundary>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '50px', 
                color: '#6b7280',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🤖</div>
                <h3 style={{ margin: '0 0 16px 0', color: '#374151' }}>AI问答</h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px' }}>
                  请先选择左侧仓库，然后使用自然语言提问
                </p>
                <div style={{ 
                  background: '#fff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '6px', 
                  padding: '12px', 
                  textAlign: 'left',
                  maxWidth: '400px',
                  margin: '0 auto'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#374151' }}>功能说明：</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', lineHeight: '1.5' }}>
                    <li>基于AI的智能代码问答</li>
                    <li>支持自然语言提问，如"如何实现用户认证"</li>
                    <li>AI会基于代码库内容提供准确回答</li>
                    <li>帮助理解代码逻辑和架构设计</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : null}
        
        {/* 调用图节点详情 */}
        {activeTab === 'callgraph' && selectedCallGraphNode && (
          <NodeDetails
            selectedNode={selectedCallGraphNode}
            onClose={() => setSelectedCallGraphNode(null)}
            onViewFileDetails={handleViewFileDetails}
            onUpdateCallGraph={handleUpdateCallGraph}
          />
        )}
      </div>
    </div>
    
    <style>{`
      @keyframes spin { 
        0% { transform: rotate(0deg); } 
        100% { transform: rotate(360deg); } 
      }
      
      @keyframes fileHighlight {
        0% { 
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
        }
        50% { 
          transform: scale(1.02);
          box-shadow: 0 0 0 10px rgba(245, 158, 11, 0.3);
        }
        100% { 
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
        }
      }
    `}</style>
    </>
  );
};

export default RepoManager;
