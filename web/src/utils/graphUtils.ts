import { CallRelation, Node, NodePosition } from '../types';

// 画布配置
export const CANVAS_WIDTH = 1000;
export const CANVAS_HEIGHT = 600;
export const VIEWBOX_PADDING = 100;

export const initializeNodes = (relationships: CallRelation[]): Map<string, Node> => {
  const nodes = new Map<string, Node>();
  
  relationships.forEach(rel => {
    if (!nodes.has(rel.callerId)) {
      nodes.set(rel.callerId, {
        id: rel.callerId,
        name: rel.callerName || rel.callerId,
        type: 'caller',
        level: 0,
        expanded: false,
        children: new Set(),
        parents: new Set(),
        fileId: rel.callerFileId,
        scope: rel.callerScope,
        entityId: rel.callerEntityId
      });
    }
    
    if (!nodes.has(rel.calleeId)) {
      nodes.set(rel.calleeId, {
        id: rel.calleeId,
        name: rel.calleeName || rel.calleeId,
        type: 'callee',
        level: 0,
        expanded: false,
        children: new Set(),
        parents: new Set(),
        fileId: rel.calleeFileId,
        scope: rel.calleeScope,
        entityId: rel.calleeEntityId
      });
    }
    
    const caller = nodes.get(rel.callerId)!;
    const callee = nodes.get(rel.calleeId)!;
    
    caller.children.add(rel.calleeId);
    callee.parents.add(rel.callerId);
  });
  
  return nodes;
};

export const calculateGraphLayout = (
  nodes: Map<string, Node>,
  visibleNodes: Set<string>,
  previousPositions?: Map<string, NodePosition>
): Map<string, NodePosition> => {
  // 先保留已有的手动位置（仅限当前可见节点）
  const nodePositions = new Map<string, NodePosition>();
  if (previousPositions) {
    visibleNodes.forEach(id => {
      const pos = previousPositions.get(id);
      if (pos) nodePositions.set(id, { x: pos.x, y: pos.y });
    });
  }
  
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
  
  // 使用固定的间距，不随节点数量变化
  const FIXED_GAP_X = 280;  // 水平间距固定为280
  const FIXED_GAP_Y = 120;  // 垂直间距固定为120
  
  // 根节点固定在左上角(0,0)，整体从左上角开始铺开
  const baseX = 0;
  const baseY = 0;
  
  console.log('布局计算 - 层级数量:', levels.size);
  console.log('布局计算 - 固定间距 X:', FIXED_GAP_X, 'Y:', FIXED_GAP_Y);
  
  // 从左到右（按层级）布局，每一列（层）垂直等间距排布
  // 根节点(level 0)在(0,0)，后续层级向右扩展
  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);
  
  // 第一遍：为每个层级确定X坐标，并记录已存在节点的Y坐标
  const levelXPositions = new Map<number, number>();
  const levelYPositions = new Map<number, Set<number>>();
  
  sortedLevels.forEach((level) => {
    const x = baseX + level * FIXED_GAP_X;
    levelXPositions.set(level, x);
    
    // 收集该层级已存在节点的Y坐标
    const existingYPositions = new Set<number>();
    const nodeIds = levels.get(level)!;
    nodeIds.forEach(id => {
      const pos = nodePositions.get(id);
      if (pos) {
        existingYPositions.add(pos.y);
      }
    });
    levelYPositions.set(level, existingYPositions);
  });
  
  // 第二遍：为每个节点分配位置
  sortedLevels.forEach((level) => {
    const nodeIds = levels.get(level)!;
    const x = levelXPositions.get(level)!;
    
    // 分离已存在位置的节点和需要新分配位置的节点
    const existingNodes: { id: string; y: number }[] = [];
    const newNodes: string[] = [];
    
    nodeIds.forEach(id => {
      const pos = nodePositions.get(id);
      if (pos) {
        existingNodes.push({ id, y: pos.y });
      } else {
        newNodes.push(id);
      }
    });
    
    // 已存在位置的节点保持原位置不变
    existingNodes.forEach(({ id, y }) => {
      nodePositions.set(id, { x, y });
    });
    
    // 为新节点分配位置，确保与已存在节点不重叠
    if (newNodes.length > 0) {
      const existingYPositions = levelYPositions.get(level)!;
      let nextY = baseY;
      
      newNodes.forEach((id) => {
        // 找到下一个可用的Y位置
        while (existingYPositions.has(nextY)) {
          nextY += FIXED_GAP_Y;
        }
        
        nodePositions.set(id, { x, y: nextY });
        existingYPositions.add(nextY);
        nextY += FIXED_GAP_Y;
        
        console.log(`新节点 ${id} 在层级 ${level}: 位置 (${x}, ${nextY - FIXED_GAP_Y})`);
      });
    }
  });
  
  return nodePositions;
};

export const getNodeColor = (node: Node): string => {
  // 叶子节点（没有子节点的节点）使用Neo4j风格的亮色
  if (node.children.size === 0) {
    return '#EF4444'; // 鲜艳的红色 - Neo4j风格
  }
  
  // 根据作用域着色 - 使用Neo4j风格的现代色调
  if (node.scope) {
    switch (node.scope) {
      case '1': // 私有
        return '#10B981'; // 明亮的绿色 - Neo4j风格
      case '2': // 包级
        return '#F59E0B'; // 明亮的橙色 - Neo4j风格
      case '3': // 公共
        return '#3B82F6'; // 明亮的蓝色 - Neo4j风格
      default:
        break;
    }
  }
  
  // 非叶子节点根据类型着色（Neo4j风格）
  switch (node.type) {
    case 'caller':
      return '#8B5CF6'; // 明亮的紫色 - Neo4j风格
    case 'callee':
      return '#06B6D4'; // 明亮的青色 - Neo4j风格
    default:
      return '#6B7280'; // 中性灰色
  }
};
