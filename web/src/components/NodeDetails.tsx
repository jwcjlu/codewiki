import React, { useState } from 'react';
import { Node } from '../types';

interface NodeDetailsProps {
  selectedNode: Node | null;
  onClose: () => void;
  onViewFileDetails?: (nodeId: string, fileId?: string) => void;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ 
  selectedNode, 
  onClose,
  onViewFileDetails
}) => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  if (!selectedNode) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // 只有点击标题栏才能拖动
    const target = e.target as HTMLElement;
    const draggableElement = target.closest('[data-draggable="true"]');
    if (draggableElement && draggableElement === e.currentTarget.querySelector('[data-draggable="true"]')) {
      e.preventDefault();
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleViewFileDetails = () => {
    if (onViewFileDetails && selectedNode.fileId) {
      onViewFileDetails(selectedNode.id, selectedNode.fileId);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        backgroundColor: 'white',
        border: '2px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '300px',
        maxWidth: '400px',
        transform: 'scale(1)', // 确保不受父元素缩放影响
        transformOrigin: 'top left'
      }}
    >
      {/* 标题栏 */}
      <div 
        data-draggable="true"
        style={{
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #ddd',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none' // 防止文本被选中
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <h3 style={{ 
          margin: 0, 
          color: '#333',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          节点详情
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#666',
            padding: '0',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>
      </div>

      {/* 内容区域 */}
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: '#333' }}>ID:</strong> 
          <span style={{ marginLeft: '8px', color: '#666' }}>{selectedNode.id}</span>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: '#333' }}>名称:</strong> 
          <span style={{ marginLeft: '8px', color: '#666' }}>{selectedNode.name}</span>
        </div>
        
        {selectedNode.scope && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#333' }}>作用域:</strong> 
            <span style={{ marginLeft: '8px', color: '#666' }}>
              {selectedNode.scope === '1' ? '私有' : selectedNode.scope === '2' ? '包级' : '公共'}
            </span>
          </div>
        )}
        
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: '#333' }}>类型:</strong> 
          <span style={{ marginLeft: '8px', color: '#666' }}>
            {selectedNode.type === 'caller' ? '调用者' : '被调用者'}
          </span>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: '#333' }}>层级:</strong> 
          <span style={{ marginLeft: '8px', color: '#666' }}>{selectedNode.level}</span>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: '#333' }}>子节点数量:</strong> 
          <span style={{ marginLeft: '8px', color: '#666' }}>{selectedNode.children.size}</span>
        </div>
        
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: '#333' }}>父节点数量:</strong> 
          <span style={{ marginLeft: '8px', color: '#666' }}>{selectedNode.parents.size}</span>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <strong style={{ color: '#333' }}>节点类型:</strong> 
          <span style={{ 
            marginLeft: '8px', 
            color: selectedNode.children.size === 0 ? '#FF9800' : '#4CAF50',
            fontWeight: 'bold'
          }}>
            {selectedNode.children.size === 0 ? '叶子节点' : '内部节点'}
          </span>
        </div>
        

        
        {/* 查看详情按钮 */}
        {selectedNode.fileId && onViewFileDetails && (
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={handleViewFileDetails}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#9C27B0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold'
              }}
            >
              📄 查看文件详情
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeDetails;
