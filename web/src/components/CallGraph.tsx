import React, { useState, useRef, useEffect } from 'react';
import { Node, NodePosition } from '../types';
import { getNodeColor } from '../utils/graphUtils';

interface CallGraphProps {
  nodes: Map<string, Node>;
  visibleNodes: Set<string>;
  nodePositions: Map<string, NodePosition>;
  onNodeClick: (nodeId: string) => void;
  onNodeToggle: (nodeId: string) => void;
  focusedNodeId?: string;
  interfaceImplementationLinks?: Map<string, string>; // 接口ID -> 实现ID的映射
}

interface Line {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface NodeElement {
  id: string;
  node: Node;
  position: NodePosition;
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 本地状态，用于拖拽时的位置更新
  const [nodePositionsLocal, setNodePositionsLocal] = useState<Map<string, NodePosition>>(new Map());
  
  // 新增：跟踪当前显示的是调用者还是被调用者
  const [showingCallers, setShowingCallers] = useState<Set<string>>(new Set());
  const [showingCallees, setShowingCallees] = useState<Set<string>>(new Set());

  // 当nodePositions更新时，同步到本地状态，但保持现有节点位置不变
  useEffect(() => {
    setNodePositionsLocal(prev => {
      const newPositions = new Map(prev);
      
      // 只添加新的节点位置，保持现有节点位置不变
      nodePositions.forEach((position, nodeId) => {
        if (!newPositions.has(nodeId)) {
          newPositions.set(nodeId, position);
        }
      });
      
      return newPositions;
    });
  }, [nodePositions]);

  // 当focusedNodeId变化时，自动聚焦到对应节点
  useEffect(() => {
    if (focusedNodeId && nodePositionsLocal.has(focusedNodeId)) {
      const position = nodePositionsLocal.get(focusedNodeId)!;
      const centerX = 800 / 2; // 使用固定值
      const centerY = 600 / 2; // 使用固定值
      
      const tx = centerX / scale - position.x;
      const ty = centerY / scale - position.y;
      setTranslate({ x: tx, y: ty });
    }
  }, [focusedNodeId, nodePositionsLocal, scale]);

  // 生成连接线
  const lines: Line[] = [];
  visibleNodes.forEach(nodeId => {
    const node = nodes.get(nodeId);
    if (!node) return;

    const position = nodePositionsLocal.get(nodeId);
    if (!position) return;

    node.children.forEach(childId => {
      if (visibleNodes.has(childId)) {
        const childPosition = nodePositionsLocal.get(childId);
        if (childPosition) {
          // 计算连接线的起点和终点，避免与节点重叠
          const dx = childPosition.x - position.x;
          const dy = childPosition.y - position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const unitX = dx / distance;
            const unitY = dy / distance;
            
            // 起点：从源节点边缘开始
            const startX = position.x + unitX * 25; // 使用固定值
            const startY = position.y + unitY * 25; // 使用固定值
            
            // 终点：到目标节点边缘结束
            const endX = childPosition.x - unitX * 25; // 使用固定值
            const endY = childPosition.y - unitY * 25; // 使用固定值
            
            lines.push({
              id: `${nodeId}-${childId}`,
              x1: startX,
              y1: startY,
              x2: endX,
              y2: endY
            });
          }
        }
      }
    });
  });

  // 生成接口与实现之间的虚线连接
  const interfaceLines: Line[] = [];
  interfaceImplementationLinks.forEach((implId, interfaceId) => {
    // 检查接口和实现节点是否都可见
    if (visibleNodes.has(interfaceId) && visibleNodes.has(implId)) {
      const interfacePosition = nodePositionsLocal.get(interfaceId);
      const implPosition = nodePositionsLocal.get(implId);
      
      if (interfacePosition && implPosition) {
        // 计算连接线的起点和终点
        const dx = implPosition.x - interfacePosition.x;
        const dy = implPosition.y - interfacePosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const unitX = dx / distance;
          const unitY = dy / distance;
          
          // 起点：从接口节点边缘开始
          const startX = interfacePosition.x + unitX * 25;
          const startY = interfacePosition.y + unitY * 25;
          
          // 终点：到实现节点边缘结束
          const endX = implPosition.x - unitX * 25;
          const endY = implPosition.y - unitY * 25;
          
          interfaceLines.push({
            id: `interface-${interfaceId}-${implId}`,
            x1: startX,
            y1: startY,
            x2: endX,
            y2: endY
          });
        }
      }
    }
  });

  // 生成节点
  const nodeElements: NodeElement[] = [];
  visibleNodes.forEach(nodeId => {
    const node = nodes.get(nodeId);
    if (!node) return;

    const position = nodePositionsLocal.get(nodeId);
    if (!position) return;

    nodeElements.push({
      id: nodeId,
      node,
      position
    });
  });

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    
    const position = nodePositionsLocal.get(nodeId);
    if (position) {
      setDragOffset({
        x: svgP.x - position.x,
        y: svgP.y - position.y
      });
      setDraggedNode(nodeId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNode && !isPanning) {
      const svg = svgRef.current;
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

      const newPosition = {
        x: svgP.x - dragOffset.x,
        y: svgP.y - dragOffset.y
      };

      setNodePositionsLocal(prev => new Map(prev).set(draggedNode, newPosition));
    } else if (isPanning) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setTranslate(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsDragging(false);
    setIsPanning(false);
  };

  const handleMouseDownPan = (e: React.MouseEvent) => {
    if (e.button === 0) { // 左键
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.1, Math.min(3, prev * delta)));
  };

  const resetView = () => {
    setTranslate({ x: 0, y: 0 });
    setScale(1);
  };

  // 节点点击处理
  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedNode && !isPanning) {
      console.log('点击节点:', nodeId);
      
      // 清除之前的选择
      setShowingCallers(new Set());
      setShowingCallees(new Set());
      
      // 根据节点类型决定显示调用者还是被调用者
      const currentNode = nodes.get(nodeId);
      if (currentNode) {
        if (currentNode.type === 'caller') {
          // 如果是调用者，显示该节点的被调用者
          setShowingCallees(new Set([nodeId]));
        } else if (currentNode.type === 'callee') {
          // 如果是被调用者，显示该节点的调用者
          setShowingCallers(new Set([nodeId]));
        } else {
          // 其他类型，默认显示被调用者
          setShowingCallees(new Set([nodeId]));
        }
      }
      
      onNodeClick(nodeId);
    }
  };

  // 计算SVG的viewBox
  const calculateViewBox = () => {
    if (nodePositionsLocal.size === 0) {
      return `0 0 800 600`;
    }

    let maxX = -Infinity, maxY = -Infinity;
    
    nodePositionsLocal.forEach((position) => {
      maxX = Math.max(maxX, position.x + 50);
      maxY = Math.max(maxY, position.y + 50);
    });

    const width = Math.max(maxX + 100, 800);
    const height = Math.max(maxY + 100, 600);
    
    return `0 0 ${width} ${height}`;
  };

  // 计算实际需要的SVG尺寸
  const calculateSvgSize = () => {
    if (nodePositionsLocal.size === 0) {
      return { width: 800, height: 600 };
    }

    let maxX = -Infinity, maxY = -Infinity;
    
    nodePositionsLocal.forEach((position) => {
      maxX = Math.max(maxX, position.x + 50);
      maxY = Math.max(maxY, position.y + 50);
    });

    const width = Math.max(maxX + 200, 800);
    const height = Math.max(maxY + 200, 600);
    
    return { width, height };
  };

  const svgSize = calculateSvgSize();
  const nodeRadius = 25;
  const labelFontSize = 12;

  // 调试：检查实现调用链节点
  const implementationNodes = nodeElements.filter(({ node }) => node.implementationChainId);
  console.log(`实现调用链节点数量: ${implementationNodes.length}`);
  if (implementationNodes.length > 0) {
    console.log(`实现调用链节点:`, implementationNodes.map(({ id, node }) => `${id} (链ID: ${node.implementationChainId})`));
  }

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '4px',
      background: 'white',
      minHeight: '600px',
      marginTop: '20px',
      position: 'relative'
    }}>
      {/* 控制按钮 */}
      <div style={{
        position: 'sticky',
        top: '0',
        right: '10px',
        zIndex: 10,
        display: 'flex',
        gap: '5px',
        justifyContent: 'flex-end',
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderBottom: '1px solid #ddd'
      }}>
        <button
          onClick={resetView}
          style={{
            padding: '5px 10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          重置视图
        </button>
        <div style={{
          padding: '5px 10px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          缩放: {Math.round(scale * 100)}%
        </div>
        <div style={{
          padding: '5px 10px',
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#1976d2'
        }}>
          节点: {nodeElements.length}
        </div>
      </div>

      {/* SVG画布 */}
      <svg
        ref={svgRef}
        width={svgSize.width}
        height={svgSize.height}
        viewBox={calculateViewBox()}
        style={{
          display: 'block',
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDownPan}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* 背景网格 */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f0f0f0" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* 变换组 - 处理平移和缩放 */}
        <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
          {/* 连接线 */}
          {lines.map((line, index) => {
            // 检查这条连接线是否应该高亮
            const [sourceId, targetId] = line.id.split('-');
            const shouldHighlightCallers = showingCallers.has(sourceId) || showingCallers.has(targetId);
            const shouldHighlightCallees = showingCallees.has(sourceId) || showingCallees.has(targetId);
            
            // 根据高亮状态决定线条样式
            const strokeColor = shouldHighlightCallers || shouldHighlightCallees ? '#1E40AF' : '#2563EB';
            const strokeWidth = shouldHighlightCallers || shouldHighlightCallees ? 4 : 2;
            const opacity = shouldHighlightCallers || shouldHighlightCallees ? 1 : 0.8;
            
            return (
              <g key={line.id}>
                {/* 箭头标记 */}
                <defs>
                  <marker
                    id={`arrow-${line.id}`}
                    markerWidth="10"
                    markerHeight="8"
                    refX="9"
                    refY="4"
                    orient="auto"
                  >
                    <polygon
                      points="0 0, 10 4, 0 8"
                      fill={strokeColor}
                      stroke={shouldHighlightCallers || shouldHighlightCallees ? '#1E3A8A' : '#1D4ED8'}
                      strokeWidth="0.8"
                    />
                  </marker>
                </defs>
                
                {/* 连接线 */}
                <path
                  d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  markerEnd={`url(#arrow-${line.id})`}
                  opacity={opacity}
                />
              </g>
            );
          })}

          {/* 接口与实现的虚线连接 */}
          {interfaceLines.map((line) => (
            <g key={line.id}>
              {/* 虚线箭头标记 */}
              <defs>
                <marker
                  id={`dashed-arrow-${line.id}`}
                  markerWidth="10"
                  markerHeight="8"
                  refX="9"
                  refY="4"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 4, 0 8"
                    fill="#9CA3AF"
                    stroke="#6B7280"
                    strokeWidth="0.8"
                  />
                </marker>
              </defs>
              
              {/* 虚线连接 */}
              <path
                d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
                stroke="#9CA3AF"
                strokeWidth="2"
                fill="none"
                markerEnd={`url(#dashed-arrow-${line.id})`}
                opacity="0.7"
                strokeDasharray="5,5"
              />
            </g>
          ))}

          {/* 节点 */}
          {nodeElements.map(({ id, node, position }) => {
            // 计算节点名称（最多两行）
            const wrapLabel = (text: string, maxPerLine: number, maxLines: number) => {
              if (text.length <= maxPerLine) return [text];
              const lines: string[] = [];
              let i = 0;
              while (i < text.length && lines.length < maxLines) {
                if (lines.length === maxLines - 1 && text.length - i > maxPerLine) {
                  lines.push(text.slice(i, i + Math.max(1, maxPerLine - 3)) + '...');
                  return lines;
                }
                lines.push(text.slice(i, i + maxPerLine));
                i += maxPerLine;
              }
              return lines;
            };
            const approxCharsPerLine = 16;
            const labelLines = wrapLabel(node.name, approxCharsPerLine, 2);
            
            return (
              <g 
                key={id} 
                transform={`translate(${position.x}, ${position.y})`}
                style={{ cursor: draggedNode === id ? 'grabbing' : 'grab' }}
                onMouseDown={(e) => handleMouseDown(e, id)}
                onClick={(e) => handleNodeClick(e, id)}
              >
                {/* 节点主体 */}
                <circle
                  r={nodeRadius}
                  fill={getNodeColor(node)}
                  stroke="#1F2937"
                  strokeWidth="2"
                />

                {/* 节点名称显示在节点下方，深色字体 */}
                {labelLines.map((line, index) => (
                  <text
                    key={index}
                    textAnchor="middle"
                    dominantBaseline="hanging"
                    x="0"
                    y={nodeRadius + 8 + index * (labelFontSize + 2)}
                    fill="#1F2937"
                    fontSize={labelFontSize}
                    fontWeight="600"
                    style={{ 
                      pointerEvents: 'none',
                      fontFamily: 'Arial, Helvetica, sans-serif'
                    }}
                  >
                    {line}
                  </text>
                ))}

                {/* 展开/折叠按钮 */}
                {node.children.size > 0 && (
                  <g>
                    {/* 按钮背景圆圈 */}
                    <circle
                      cx={nodeRadius + 8}
                      cy={-(nodeRadius + 8)}
                      r="8"
                      fill="rgba(30, 64, 175, 0.8)"
                      stroke="#1E40AF"
                      strokeWidth="1.5"
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('点击展开按钮:', id, '子节点数量:', node.children.size);
                        onNodeToggle(id);
                      }}
                    />
                    {/* 展开/折叠符号 */}
                    <text
                      x={nodeRadius + 8}
                      y={-(nodeRadius + 8)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="14px"
                      fontWeight="bold"
                      fill="white"
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('点击展开按钮:', id, '子节点数量:', node.children.size);
                        onNodeToggle(id);
                      }}
                    >
                      {node.expanded ? '−' : '+'}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

export default CallGraph;
