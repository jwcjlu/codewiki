import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Node, NodePosition } from '../types';

interface CallGraphProps {
  nodes: Map<string, Node>;
  visibleNodes: Set<string>;
  nodePositions: Map<string, NodePosition>;
  onNodeClick: (nodeId: string) => void;
  onNodeToggle: (nodeId: string) => void;
  focusedNodeId?: string;
  interfaceImplementationLinks?: Map<string, string>;
}

interface BranchInfo {
  id: string;
  name: string;
  nodeCount: number;
  depth: number;
  importance: number; // 重要性评分
  isVisible: boolean;
  rootNodeId: string;
  nodes: Set<string>;
}

const CallGraph: React.FC<CallGraphProps> = ({
  nodes,
  visibleNodes,
  nodePositions,
  onNodeClick,
  onNodeToggle,
  focusedNodeId,
  interfaceImplementationLinks = new Map()
}) => {
  // 引用
  const mermaidRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 状态
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBranchSelector, setShowBranchSelector] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [autoHideThreshold, setAutoHideThreshold] = useState(20); // 自动隐藏阈值

  // 分析调用分支
  const branchAnalysis = useMemo(() => {
    const branches = new Map<string, BranchInfo>();
    const visited = new Set<string>();

    // 从根节点开始分析分支
    const analyzeBranch = (nodeId: string, branchId: string, depth: number = 0) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.get(nodeId);
      if (!node) return;

      // 获取或创建分支信息
      if (!branches.has(branchId)) {
        branches.set(branchId, {
          id: branchId,
          name: `分支 ${branchId}`,
          nodeCount: 0,
          depth: 0,
          importance: 0,
          isVisible: true,
          rootNodeId: nodeId,
          nodes: new Set()
        });
      }

      const branch = branches.get(branchId)!;
      branch.nodes.add(nodeId);
      branch.nodeCount++;
      branch.depth = Math.max(branch.depth, depth);

      // 计算重要性评分（基于节点数量、深度、类型等）
      let importance = 0;
      importance += node.children.size * 2; // 子节点越多越重要
      importance += (node.parents.size === 0 ? 10 : 0); // 根节点更重要
      importance += (node.scope === '3' ? 5 : 0); // 接口节点更重要
      importance += Math.max(0, 10 - depth); // 深度越浅越重要

      branch.importance = Math.max(branch.importance, importance);

      // 递归分析子节点
      node.children.forEach(childId => {
        if (visibleNodes.has(childId)) {
          analyzeBranch(childId, branchId, depth + 1);
        }
      });
    };

    // 为每个根节点创建分支
    let branchCounter = 1;
    visibleNodes.forEach(nodeId => {
      const node = nodes.get(nodeId);
      if (node && node.parents.size === 0 && !visited.has(nodeId)) {
        const branchId = `branch_${branchCounter++}`;
        const branchName = node.name.length > 20 ? node.name.substring(0, 20) + '...' : node.name;
        
        branches.set(branchId, {
          id: branchId,
          name: branchName,
          nodeCount: 0,
          depth: 0,
          importance: 0,
          isVisible: true,
          rootNodeId: nodeId,
          nodes: new Set()
        });
        
        analyzeBranch(nodeId, branchId);
      }
    });

    // 按重要性排序
    const sortedBranches = Array.from(branches.values()).sort((a, b) => b.importance - a.importance);
    
    // 自动隐藏不重要的分支（当总节点数超过阈值时）
    if (visibleNodes.size > autoHideThreshold) {
      const branchesToHide = sortedBranches.slice(Math.ceil(sortedBranches.length * 0.3)); // 隐藏30%的分支
      branchesToHide.forEach(branch => {
        branch.isVisible = false;
        selectedBranches.delete(branch.id);
      });
    }

    return sortedBranches;
  }, [nodes, visibleNodes, autoHideThreshold]);

  // 计算实际可见的节点（基于分支选择）
  const effectiveVisibleNodes = useMemo(() => {
    const effectiveNodes = new Set<string>();
    
    branchAnalysis.forEach(branch => {
      if (branch.isVisible && selectedBranches.has(branch.id)) {
        branch.nodes.forEach(nodeId => {
          effectiveNodes.add(nodeId);
        });
      }
    });

    // 如果没有选择任何分支，显示所有节点
    if (effectiveNodes.size === 0) {
      return visibleNodes;
    }

    return effectiveNodes;
  }, [branchAnalysis, selectedBranches, visibleNodes]);

  // 初始化分支选择
  useEffect(() => {
    if (branchAnalysis.length > 0 && selectedBranches.size === 0) {
      const initialBranches = branchAnalysis
        .filter(branch => branch.isVisible)
        .slice(0, Math.min(5, branchAnalysis.length)) // 默认选择前5个分支
        .map(branch => branch.id);
      setSelectedBranches(new Set(initialBranches));
    }
  }, [branchAnalysis]);

  // 生成Mermaid图表代码
  const generateMermaidCode = useCallback((): string => {
    if (effectiveVisibleNodes.size === 0) {
      return 'graph TD\n    A[无节点数据]';
    }

    let mermaidCode = 'graph TD\n';
    const nodeMap = new Map<string, string>();
    let nodeCounter = 0;

    // 生成节点
    effectiveVisibleNodes.forEach(nodeId => {
      const node = nodes.get(nodeId);
      if (node) {
        const mermaidNodeId = `N${nodeCounter++}`;
        nodeMap.set(nodeId, mermaidNodeId);
        
        // 处理节点名称，确保Mermaid兼容
        const nodeName = node.name
          .replace(/[^\w\s\u4e00-\u9fa5\-_]/g, '') // 保留中文、英文、数字、空格、连字符、下划线
          .substring(0, 40); // 限制名称长度
        
        mermaidCode += `    ${mermaidNodeId}["${nodeName}"]\n`;
      }
    });

    // 生成连接关系
    effectiveVisibleNodes.forEach(nodeId => {
      const node = nodes.get(nodeId);
      if (!node) return;

      const sourceMermaidId = nodeMap.get(nodeId);
      if (!sourceMermaidId) return;

      node.children.forEach(childId => {
        if (effectiveVisibleNodes.has(childId)) {
          const targetMermaidId = nodeMap.get(childId);
          if (targetMermaidId) {
            mermaidCode += `    ${sourceMermaidId} --> ${targetMermaidId}\n`;
          }
        }
      });
    });

    // 添加样式定义
    mermaidCode += '\n    %% 节点样式\n';
    mermaidCode += '    classDef default fill:#f8f9fa,stroke:#6c757d,stroke-width:2px,color:#495057;\n';
    mermaidCode += '    classDef root fill:#d1ecf1,stroke:#0c5460,stroke-width:3px,color:#0c5460;\n';
    mermaidCode += '    classDef leaf fill:#f8d7da,stroke:#721c24,stroke-width:2px,color:#721c24;\n';
    mermaidCode += '    classDef interface fill:#fff3cd,stroke:#856404,stroke-width:2px,color:#856404;\n';

    // 应用样式类
    effectiveVisibleNodes.forEach(nodeId => {
      const node = nodes.get(nodeId);
      if (node) {
        const mermaidNodeId = nodeMap.get(nodeId);
        if (mermaidNodeId) {
          if (node.parents.size === 0) {
            mermaidCode += `    class ${mermaidNodeId} root;\n`;
          } else if (node.children.size === 0) {
            mermaidCode += `    class ${mermaidNodeId} leaf;\n`;
          } else if (node.scope === '3') { // 接口类型
            mermaidCode += `    class ${mermaidNodeId} interface;\n`;
          }
        }
      }
    });

    return mermaidCode;
  }, [effectiveVisibleNodes, nodes]);

  // 渲染Mermaid图表
  const renderMermaid = useCallback(async () => {
    if (!mermaidRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // 动态导入Mermaid
      const mermaid = await import('mermaid');

      // 配置Mermaid
      mermaid.default.initialize({
        startOnLoad: false,
        theme: 'default',
        flowchart: {
          useMaxWidth: false, // 允许图表超出容器宽度
          htmlLabels: true,
          curve: 'basis',
          nodeSpacing: 80,    // 节点间距
          rankSpacing: 120,   // 层级间距
          padding: 50         // 图表内边距
        },
        securityLevel: 'loose',
        maxTextSize: 50000,
        themeVariables: {
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif'
        }
      });

      // 生成图表代码
      const code = generateMermaidCode();
      console.log('Mermaid代码:', code);

      // 渲染图表
      const { svg } = await mermaid.default.render('mermaid-svg', code);
      
      // 检查组件是否仍然挂载
      if (!mermaidRef.current) return;
      
      mermaidRef.current.innerHTML = svg;
      
      // 添加节点点击事件
      const svgElement = mermaidRef.current.querySelector('svg');
      if (svgElement) {
        svgElement.style.cursor = 'pointer';
        
        // 为每个节点添加点击事件
        const nodeElements = svgElement.querySelectorAll('.node');
        nodeElements.forEach((nodeElement, index) => {
          const nodeId = Array.from(effectiveVisibleNodes)[index];
          if (nodeId) {
                         // 移除旧的事件监听器（如果存在）
             const oldClickHandler = nodeElement.getAttribute('data-click-handler');
             if (oldClickHandler) {
               nodeElement.removeEventListener('click', (window as any)[oldClickHandler]);
             }
            
            // 创建新的事件处理函数
            const clickHandler = () => {
              if (mermaidRef.current) { // 再次检查组件是否挂载
                onNodeClick(nodeId);
              }
            };
            
            // 存储事件处理函数引用
            const handlerId = `handler_${Date.now()}_${Math.random()}`;
            (window as any)[handlerId] = clickHandler;
            nodeElement.setAttribute('data-click-handler', handlerId);
            
            // 添加新的事件监听器
            nodeElement.addEventListener('click', clickHandler);
          }
        });
      }
    } catch (err) {
      console.error('Mermaid渲染失败:', err);
      setError(err instanceof Error ? err.message : '图表渲染失败');
      
      // 检查组件是否仍然挂载
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = `
          <div style="padding: 40px; text-align: center; color: #6c757d;">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <h3>图表渲染失败</h3>
            <p>${err instanceof Error ? err.message : '未知错误'}</p>
          </div>
        `;
      }
    } finally {
      // 检查组件是否仍然挂载
      if (mermaidRef.current) {
        setIsLoading(false);
      }
    }
  }, [effectiveVisibleNodes, onNodeClick, generateMermaidCode]);

  // 当数据变化时重新渲染
  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      if (!isMounted) return;
      await renderMermaid();
    };
    
    renderChart();
    
    // 清理函数
    return () => {
      isMounted = false;
    };
  }, [renderMermaid]);

  // 组件卸载时清理事件监听器
  useEffect(() => {
    return () => {
               // 清理所有存储的事件处理函数
         if (mermaidRef.current) {
           const nodeElements = mermaidRef.current.querySelectorAll('.node');
           nodeElements.forEach(nodeElement => {
             const handlerId = nodeElement.getAttribute('data-click-handler');
             if (handlerId && (window as any)[handlerId]) {
               nodeElement.removeEventListener('click', (window as any)[handlerId]);
               delete (window as any)[handlerId];
             }
           });
         }
    };
  }, []);

  // 拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 只处理左键点击，且不在按钮或其他交互元素上
    if (e.button === 0 && mermaidRef.current && !(e.target as HTMLElement).closest('button')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setScrollStart({
        x: mermaidRef.current.scrollLeft,
        y: mermaidRef.current.scrollTop
      });
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && mermaidRef.current) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      mermaidRef.current.scrollLeft = scrollStart.x - deltaX;
      mermaidRef.current.scrollTop = scrollStart.y - deltaY;
      
      e.preventDefault();
    }
  }, [isDragging, dragStart, scrollStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 全局鼠标事件监听
  useEffect(() => {
    let isMounted = true;
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isMounted || !isDragging || !mermaidRef.current) return;
      
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      mermaidRef.current.scrollLeft = scrollStart.x - deltaX;
      mermaidRef.current.scrollTop = scrollStart.y - deltaY;
      
      e.preventDefault();
    };

    const handleGlobalMouseUp = () => {
      if (isMounted) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      // 添加拖动时的样式
      if (mermaidRef.current) {
        mermaidRef.current.style.cursor = 'grabbing';
        mermaidRef.current.style.userSelect = 'none';
      }
    }

    return () => {
      isMounted = false;
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      
      // 恢复拖动后的样式
      if (mermaidRef.current) {
        mermaidRef.current.style.cursor = 'grab';
        mermaidRef.current.style.userSelect = 'none';
      }
    };
  }, [isDragging, dragStart, scrollStart]);

  // 重置视图
  const resetView = useCallback(() => {
    if (mermaidRef.current) {
      mermaidRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  }, []);

  // 切换最大化状态
  const toggleMaximize = useCallback(() => {
    setIsMaximized(!isMaximized);
  }, [isMaximized]);

  // 切换分支选择器显示
  const toggleBranchSelector = useCallback(() => {
    setShowBranchSelector(!showBranchSelector);
  }, [showBranchSelector]);

  // 处理分支选择
  const handleBranchToggle = useCallback((branchId: string) => {
    setSelectedBranches(prev => {
      const newSelectedBranches = new Set(prev);
      if (newSelectedBranches.has(branchId)) {
        newSelectedBranches.delete(branchId);
      } else {
        newSelectedBranches.add(branchId);
      }
      return newSelectedBranches;
    });
  }, []);

  // 全选/取消全选分支
  const toggleAllBranches = useCallback(() => {
    setSelectedBranches(prev => {
      if (prev.size === branchAnalysis.length) {
        return new Set();
      } else {
        return new Set(branchAnalysis.map(branch => branch.id));
      }
    });
  }, [branchAnalysis.length]);

  // 智能隐藏分支
  const smartHideBranches = useCallback(() => {
    const importantBranches = branchAnalysis
      .sort((a, b) => b.importance - a.importance)
      .slice(0, Math.ceil(branchAnalysis.length * 0.7)) // 保留70%的重要分支
      .map(branch => branch.id);
    setSelectedBranches(new Set(importantBranches));
  }, [branchAnalysis]);

  // 计算容器样式
  const containerStyle: React.CSSProperties = isMaximized ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    background: 'white',
    transition: 'all 0.3s ease'
  } : {
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    background: 'white',
    position: 'relative',
    transition: 'all 0.3s ease',
    minHeight: '600px',
    marginTop: '20px'
  };

  const mermaidContainerStyle: React.CSSProperties = {
    padding: '20px',
    minHeight: isMaximized ? 'calc(100vh - 200px)' : '500px',
    maxHeight: isMaximized ? 'calc(100vh - 200px)' : '800px',
    width: '100%',
    overflow: 'auto',
    background: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '6px',
    position: 'relative',
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    // 添加拖动相关的样式
    touchAction: 'none', // 禁用触摸操作，确保拖动正常工作
    WebkitUserSelect: 'none', // Safari兼容性
    MozUserSelect: 'none', // Firefox兼容性
    msUserSelect: 'none' // IE兼容性
  };

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* 控制栏 */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottom: '1px solid #dee2e6',
        borderRadius: isMaximized ? '0' : '8px 8px 0 0'
      }}>
        {/* 左侧：标题和状态 */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{
            padding: '6px 12px',
            backgroundColor: '#e3f2fd',
            color: '#1976d2',
            border: '1px solid #2196f3',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            📊 Mermaid 调用图
          </div>
          
          <div style={{
            padding: '4px 8px',
            backgroundColor: '#e8f5e8',
            color: '#2e7d32',
            borderRadius: '4px',
            fontSize: '11px',
            border: '1px solid #4caf50'
          }}>
            可见节点: {effectiveVisibleNodes.size} / {visibleNodes.size}
          </div>

          <div style={{
            padding: '4px 8px',
            backgroundColor: '#fff3cd',
            color: '#856404',
            borderRadius: '4px',
            fontSize: '11px',
            border: '1px solid #ffc107'
          }}>
            分支: {selectedBranches.size} / {branchAnalysis.length}
          </div>

          {/* 拖动状态指示 */}
          <div style={{
            padding: '4px 8px',
            backgroundColor: isDragging ? '#e8f5e8' : '#f8f9fa',
            color: isDragging ? '#2e7d32' : '#6c757d',
            borderRadius: '4px',
            fontSize: '11px',
            border: `1px solid ${isDragging ? '#4caf50' : '#dee2e6'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isDragging ? '🖱️ 拖动中' : '🖱️ 可拖动'}
          </div>

          {isLoading && (
            <div style={{
              padding: '4px 8px',
              backgroundColor: '#fff3cd',
              color: '#856404',
              borderRadius: '4px',
              fontSize: '11px',
              border: '1px solid #ffc107'
            }}>
              🔄 渲染中...
            </div>
          )}

          {error && (
            <div style={{
              padding: '4px 8px',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              borderRadius: '4px',
              fontSize: '11px',
              border: '1px solid #dc3545'
            }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* 右侧：控制按钮 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={toggleBranchSelector}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
            title="分支选择器"
          >
            🌿 分支选择
          </button>

          <button
            onClick={resetView}
            style={{
              padding: '6px 12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
            title="回到顶部"
          >
            🏠 重置视图
          </button>

          <button
            onClick={toggleMaximize}
            style={{
              padding: '6px 12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
            title={isMaximized ? '恢复窗口' : '最大化窗口'}
          >
            {isMaximized ? '⛶ 恢复' : '⛶ 最大化'}
          </button>
        </div>
      </div>

      {/* 分支选择器 */}
      {showBranchSelector && (
        <div style={{
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#495057' }}>分支选择器</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={toggleAllBranches}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                {selectedBranches.size === branchAnalysis.length ? '取消全选' : '全选'}
              </button>
              <button
                onClick={smartHideBranches}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#fd7e14',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                智能隐藏
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px'
          }}>
            {branchAnalysis.map(branch => {
              const isSelected = selectedBranches.has(branch.id);
              return (
                <div
                  key={branch.id}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: isSelected ? '#e3f2fd' : '#ffffff',
                    border: `3px solid ${isSelected ? '#2196f3' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: isSelected 
                      ? '0 4px 12px rgba(33, 150, 243, 0.3), 0 2px 4px rgba(0, 0, 0, 0.1)' 
                      : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transform: isSelected ? 'translateY(-2px)' : 'translateY(0)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => handleBranchToggle(branch.id)}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                      e.currentTarget.style.borderColor = '#bdbdbd';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {/* 选中状态指示器 */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 0,
                      height: 0,
                      borderStyle: 'solid',
                      borderWidth: '0 20px 20px 0',
                      borderColor: 'transparent #2196f3 transparent transparent'
                    }} />
                  )}
                  
                  {/* 选中状态图标 */}
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      width: '16px',
                      height: '16px',
                      backgroundColor: '#2196f3',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      ✓
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{
                      fontWeight: '600',
                      fontSize: '13px',
                      color: isSelected ? '#1976d2' : '#495057',
                      textDecoration: isSelected ? 'underline' : 'none'
                    }}>
                      {branch.name}
                    </span>
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: isSelected ? '#2196f3' : '#6c757d',
                      color: 'white',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: '500',
                      boxShadow: isSelected ? '0 2px 4px rgba(33, 150, 243, 0.3)' : 'none'
                    }}>
                      {branch.nodeCount} 节点
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: isSelected ? '#1976d2' : '#6c757d'
                  }}>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: isSelected ? '#e3f2fd' : '#f8f9fa',
                      borderRadius: '4px',
                      border: `1px solid ${isSelected ? '#2196f3' : '#dee2e6'}`
                    }}>
                      深度: {branch.depth}
                    </span>
                    <span style={{
                      padding: '2px 6px',
                      backgroundColor: isSelected ? '#e3f2fd' : '#f8f9fa',
                      borderRadius: '4px',
                      border: `1px solid ${isSelected ? '#2196f3' : '#dee2e6'}`
                    }}>
                      重要性: {branch.importance}
                    </span>
                  </div>

                  {/* 选中状态提示 */}
                  {isSelected && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 8px',
                      backgroundColor: '#e8f5e8',
                      color: '#2e7d32',
                      borderRadius: '4px',
                      fontSize: '10px',
                      textAlign: 'center',
                      border: '1px solid #4caf50'
                    }}>
                      ✅ 已选择 - 此分支将在图表中显示
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 选择统计和提示 */}
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#e8f5e8',
            borderRadius: '8px',
            border: '1px solid #4caf50'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#2e7d32',
                fontWeight: '500'
              }}>
                📊 选择统计
              </div>
              <div style={{
                fontSize: '11px',
                color: '#2e7d32'
              }}>
                已选择: {selectedBranches.size} / {branchAnalysis.length} 分支
              </div>
            </div>
            <div style={{
              fontSize: '11px',
              color: '#2e7d32',
              lineHeight: '1.4'
            }}>
              💡 提示：选择要显示的分支，智能隐藏会自动保留重要的调用分支。
              <br />
              🎯 建议：对于大型调用图，建议选择3-5个主要分支以获得最佳显示效果。
            </div>
          </div>
        </div>
      )}

      {/* Mermaid图表容器 */}
      <div style={{ position: 'relative' }}>
        {/* 图表控制按钮 */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={() => {
              if (mermaidRef.current) {
                mermaidRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
              }
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500'
            }}
            title="回到顶部"
          >
            🏠 顶部
          </button>

          <button
            onClick={() => {
              if (mermaidRef.current) {
                const svg = mermaidRef.current.querySelector('svg');
                if (svg) {
                  const currentScale = svg.style.transform.match(/scale\(([^)]+)\)/);
                  const newScale = currentScale && currentScale[1] === '0.8' ? '1' : '0.8';
                  svg.style.transform = `scale(${newScale})`;
                }
              }
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6f42c1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500'
            }}
            title="切换缩放"
          >
            🔍 缩放
          </button>
        </div>

        {/* Mermaid图表 */}
        <div
          ref={mermaidRef}
          style={mermaidContainerStyle}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {!isLoading && !error && (
            <div style={{
              textAlign: 'center',
              color: '#6c757d',
              fontSize: '14px',
              padding: '40px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <p>正在加载Mermaid图表...</p>
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#f8f9fa',
        borderTop: '1px solid #dee2e6',
        fontSize: '12px',
        color: '#6c757d',
        borderRadius: isMaximized ? '0' : '0 0 8px 8px'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span>💡 提示：</span>
          <span>🖱️ 拖拽图表进行平移</span>
          <span>🔍 使用缩放按钮调整大小</span>
          <span>🌿 使用分支选择器隐藏不重要的调用分支</span>
          <span>⛶ 最大化窗口获得更好体验</span>
          <span>🏠 重置视图回到初始位置</span>
        </div>
        
        {/* 拖动操作说明 */}
        {isDragging && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: '#e3f2fd',
            color: '#1976d2',
            borderRadius: '6px',
            fontSize: '11px',
            border: '1px solid #2196f3',
            textAlign: 'center'
          }}>
            🎯 正在拖动图表 - 移动鼠标来平移视图，释放鼠标完成拖动
          </div>
        )}
      </div>
    </div>
  );
};

export default CallGraph;
