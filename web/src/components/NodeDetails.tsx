import React, { useState, useEffect } from 'react';
import { Node, Entity, CallRelation } from '../types';
import { getImplement, fetchFunctionCalls } from '../services/api';

interface NodeDetailsProps {
  selectedNode: Node | null;
  onClose: () => void;
  onViewFileDetails?: (nodeId: string, fileId?: string) => void;
  onUpdateCallGraph?: (callRelations: CallRelation[], selectedNodeId?: string) => void;
}

const NodeDetails: React.FC<NodeDetailsProps> = ({ 
  selectedNode, 
  onClose,
  onViewFileDetails,
  onUpdateCallGraph
}) => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // 新增：实现信息相关状态
  const [implementEntities, setImplementEntities] = useState<Entity[]>([]);
  const [implementLoading, setImplementLoading] = useState(false);
  const [implementError, setImplementError] = useState<string | null>(null);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());
  
  // 新增：调用链相关状态
  const [selectedImplementation, setSelectedImplementation] = useState<string | null>(null);
  const [callChain, setCallChain] = useState<CallRelation[]>([]);
  const [callChainLoading, setCallChainLoading] = useState(false);
  const [callChainError, setCallChainError] = useState<string | null>(null);
  
  // 新增：接口实现选择相关状态
  const [interfaceImplementations, setInterfaceImplementations] = useState<Entity[]>([]);
  const [showImplementationSelector, setShowImplementationSelector] = useState(false);
  const [currentInterface, setCurrentInterface] = useState<{ id: string; name: string } | null>(null);

  // 新增：当节点变化时，如果是接口类型则获取实现信息
  useEffect(() => {
    if (selectedNode && selectedNode.scope === '3') {
      // 优先使用 entityId，如果没有则使用节点 id
      const entityId = selectedNode.entityId || selectedNode.id;
      fetchImplementEntities(entityId);
    } else {
      setImplementEntities([]);
      setImplementError(null);
    }
  }, [selectedNode]);

  // 新增：获取实现实体
  const fetchImplementEntities = async (entityId: string) => {
    console.log(`fetchImplementEntities called with entityId: ${entityId}`);
    setImplementLoading(true);
    setImplementError(null);
    try {
      const response = await getImplement(entityId);
      console.log(`getImplement response:`, response);
      console.log(`response.body.entities:`, response.body.entities);
      setImplementEntities(response.body.entities || []);
    } catch (error) {
      console.error(`Error in fetchImplementEntities:`, error);
      setImplementError(error instanceof Error ? error.message : '获取实现信息失败');
    } finally {
      setImplementLoading(false);
    }
  };

  // 新增：切换实体展开状态
  const toggleEntityExpansion = (entityId: string) => {
    const newExpanded = new Set(expandedEntities);
    if (newExpanded.has(entityId)) {
      newExpanded.delete(entityId);
    } else {
      newExpanded.add(entityId);
    }
    setExpandedEntities(newExpanded);
  };

  // 新增：选择实现并查询调用链
  const selectImplementation = async (entity: Entity) => {
    if (!entity) {
      console.error('selectImplementation called with undefined entity');
      setCallChainError('实体信息无效');
      return;
    }
    
    if (!selectedNode) {
      console.error('selectedNode is null');
      setCallChainError('节点信息丢失');
      return;
    }
    
    console.log(`selectImplementation called with entity: ${entity.name} (ID: ${entity.id}), selectedNode.name: ${selectedNode.name}`);
    setSelectedImplementation(entity.id);
    setCallChainLoading(true);
    setCallChainError(null);
    
    try {
      // 检查实体是否有函数列表
      if (!entity.functions || entity.functions.length === 0) {
        throw new Error(`实体 ${entity.name} 没有函数列表`);
      }
      
      // 遍历实体的函数，查找与 selectedNode.name 匹配的函数
      const targetFunction = entity.functions.find(f => f.name === selectedNode.name);
      
      if (!targetFunction) {
        throw new Error(`在实体 ${entity.name} 中找不到名为 ${selectedNode.name} 的函数`);
      }
      
      // 使用找到的函数ID查询调用链
      console.log(`Found matching function: ${targetFunction.name} (ID: ${targetFunction.id})`);
      console.log(`Fetching function calls for functionId: ${targetFunction.id}, functionName: ${targetFunction.name}`);
      
      const callRelations = await fetchFunctionCalls(targetFunction.id, targetFunction.name);
      console.log(`Received call relations:`, callRelations);
      setCallChain(callRelations);
      
      // 如果提供了更新回调，则更新主调用图
      if (onUpdateCallGraph) {
        console.log(`Updating main call graph with ${callRelations.length} relations`);
        onUpdateCallGraph(callRelations, selectedNode.id);
      }
    } catch (error) {
      console.error(`Error in selectImplementation:`, error);
      setCallChainError(error instanceof Error ? error.message : '获取调用链失败');
    } finally {
      setCallChainLoading(false);
    }
  };

  // 新增：取消选择实现
  const deselectImplementation = () => {
    setSelectedImplementation(null);
    setCallChain([]);
    setCallChainError(null);
  };

  // 新增：处理接口实现选择
  const handleInterfaceImplementation = async (interfaceId: string, interfaceName: string) => {
    try {
      // 查询该接口的实现
      const response = await getImplement(interfaceId);
      const implementations = response.body.entities || [];
      
      if (implementations.length === 0) {
        alert(`接口 ${interfaceName} 没有找到实现类`);
        return;
      }
      
             // 如果只有一个实现，直接选择
       if (implementations.length === 1) {
         const impl = implementations[0];
         console.log(`接口 ${interfaceName} 只有一个实现: ${impl.name}`);
         // 继续查询该实现的调用链
         await selectImplementation(impl);
         return;
       }
      
      // 如果有多个实现，显示选择界面
      setCurrentInterface({ id: interfaceId, name: interfaceName });
      setInterfaceImplementations(implementations);
      setShowImplementationSelector(true);
      
    } catch (error) {
      console.error('查询接口实现失败:', error);
      alert(`查询接口 ${interfaceName} 的实现失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

     // 新增：选择接口实现并继续查询调用链
   const selectInterfaceImplementation = async (implId: string, implName?: string) => {
     console.log(`selectInterfaceImplementation called with implId: ${implId}, implName: ${implName}`);
     setShowImplementationSelector(false);
     setCurrentInterface(null);
     setInterfaceImplementations([]);
     
     // 继续查询该实现的调用链
     if (currentInterface) {
       console.log(`Calling selectImplementation with implId: ${implId}`);
       // 需要先找到对应的实体对象
       const entity = interfaceImplementations.find(impl => impl.id === implId);
       if (entity) {
         await selectImplementation(entity);
       } else {
         console.error(`Cannot find entity with id: ${implId}`);
         setCallChainError('找不到对应的实现实体');
       }
     } else {
       console.error('currentInterface is null, cannot proceed');
       setCallChainError('接口信息丢失，无法继续查询');
     }
   };

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
      let processedFileId = selectedNode.fileId;
      
      // 当 scope 为 '3'（接口）或 '1'（实例方法）时，去掉最后一个 . 和之后的字符
      if (selectedNode.scope === '3' || selectedNode.scope === '1') {
        const lastDotIndex = processedFileId.lastIndexOf('.');
        if (lastDotIndex !== -1) {
          processedFileId = processedFileId.substring(0, lastDotIndex);
        }
      }
      
      // 如果选择了实现，使用实现的文件ID
      if (selectedImplementation && selectedNode.scope === '3') {
        const selectedEntity = implementEntities.find(entity => entity.id === selectedImplementation);
        if (selectedEntity && selectedEntity.fileId) {
          processedFileId = selectedEntity.fileId;
        }
      }
      
      console.log("processedFileId:" + processedFileId);
      onViewFileDetails(selectedNode.id, processedFileId);
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
            <strong style={{ color: '#333' }}>方法类型:</strong> 
            <span style={{ marginLeft: '8px', color: '#666' }}>
              {selectedNode.scope === '1' ? '实例方法' : selectedNode.scope === '2' ? '函数' : '接口方法'}
            </span>
          </div>
        )}
        
        {selectedNode.entityId && (
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: '#333' }}>实体ID:</strong> 
            <span style={{ marginLeft: '8px', color: '#666' }}>{selectedNode.entityId}</span>
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
        
                 {/* 新增：实现信息显示 */}
         {selectedNode.scope === '3' && (
           <div style={{ marginBottom: '16px' }}>
             <div style={{ 
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'space-between',
               marginBottom: '8px'
             }}>
               <strong style={{ color: '#333' }}>实现信息:</strong>
               {implementLoading && (
                 <span style={{ fontSize: '12px', color: '#666' }}>加载中...</span>
               )}
             </div>
             
             {implementError && (
               <div style={{ 
                 padding: '8px', 
                 backgroundColor: '#ffebee', 
                 color: '#c62828', 
                 borderRadius: '4px', 
                 fontSize: '12px',
                 marginBottom: '8px'
               }}>
                 {implementError}
               </div>
             )}
             
             {implementEntities.length > 0 ? (
               <div style={{ 
                 border: '1px solid #e0e0e0', 
                 borderRadius: '6px', 
                 maxHeight: '200px', 
                 overflowY: 'auto'
               }}>
                 {implementEntities.map((entity) => (
                   <div key={entity.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                     <div 
                       style={{ 
                         padding: '8px 12px', 
                         cursor: 'pointer',
                         backgroundColor: expandedEntities.has(entity.id) ? '#f5f5f5' : 'transparent',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'space-between'
                       }}
                       onClick={() => toggleEntityExpansion(entity.id)}
                     >
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <span style={{ fontWeight: '500', color: '#333' }}>
                           🔗 {entity.name}
                         </span>
                         {selectedImplementation === entity.id && (
                           <span style={{ 
                             fontSize: '10px', 
                             backgroundColor: '#4CAF50', 
                             color: 'white', 
                             padding: '2px 6px', 
                             borderRadius: '10px' 
                           }}>
                             已选择
                           </span>
                         )}
                       </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             if (!entity.id) {
                               console.error('Entity ID is undefined:', entity);
                               alert('实体ID无效，无法选择实现');
                               return;
                             }
                             if (selectedImplementation === entity.id) {
                               deselectImplementation();
                             } else {
                               selectImplementation(entity);
                             }
                           }}
                           style={{
                             fontSize: '10px',
                             padding: '4px 8px',
                             backgroundColor: selectedImplementation === entity.id ? '#f44336' : '#2196F3',
                             color: 'white',
                             border: 'none',
                             borderRadius: '4px',
                             cursor: 'pointer'
                           }}
                         >
                           {selectedImplementation === entity.id ? '取消选择' : '选择'}
                         </button>
                         <span style={{ 
                           fontSize: '12px', 
                           color: '#666',
                           transition: 'transform 0.2s ease',
                           transform: expandedEntities.has(entity.id) ? 'rotate(90deg)' : 'rotate(0deg)'
                         }}>
                           ▸
                         </span>
                       </div>
                     </div>
                     
                     {expandedEntities.has(entity.id) && (
                       <div style={{ 
                         padding: '8px 16px', 
                         backgroundColor: '#fafafa',
                         borderTop: '1px solid #f0f0f0'
                       }}>
                         <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                           文件: {entity.fileId}
                         </div>
                         {entity.functions && entity.functions.length > 0 && (
                           <div style={{ fontSize: '12px', color: '#666' }}>
                             函数: {entity.functions.map((f, index) => (
                               <span key={`${entity.id}-func-${index}`}>
                                 {f.name}
                                 {index < entity.functions.length - 1 ? ', ' : ''}
                               </span>
                             ))}
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             ) : !implementLoading && !implementError ? (
               <div style={{ 
                 padding: '8px', 
                 backgroundColor: '#f5f5f5', 
                 color: '#666', 
                 borderRadius: '4px', 
                 fontSize: '12px',
                 textAlign: 'center'
               }}>
                 暂无实现
               </div>
             ) : null}
           </div>
         )}
         
         {/* 新增：调试信息 - 移到外面，所有节点都能看到 */}
         <div style={{ 
           padding: '8px', 
           backgroundColor: '#e3f2fd', 
           border: '1px solid #2196f3',
           borderRadius: '4px', 
           fontSize: '11px',
           marginBottom: '8px',
           color: '#1976d2'
         }}>
           <strong>调试信息:</strong><br/>
           selectedImplementation: {selectedImplementation || 'null'}<br/>
           callChain.length: {callChain.length}<br/>
           callChainLoading: {callChainLoading ? 'true' : 'false'}<br/>
           callChainError: {callChainError || 'null'}
         </div>
         
         {/* 新增：调用链显示 */}
         {selectedImplementation && (
           <div style={{ marginTop: '16px' }}>
             <div style={{ 
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'space-between',
               marginBottom: '8px'
             }}>
               <strong style={{ color: '#333' }}>调用链:</strong>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 {callChainLoading && (
                   <span style={{ fontSize: '12px', color: '#666' }}>加载中...</span>
                 )}
                                       {callChain.length > 0 && onUpdateCallGraph && (
                        <button
                          onClick={() => onUpdateCallGraph(callChain, selectedNode.id)}
                          style={{
                            fontSize: '10px',
                            padding: '4px 8px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          添加到主图
                        </button>
                      )}
                 <button
                   onClick={deselectImplementation}
                   style={{
                     fontSize: '10px',
                     padding: '4px 8px',
                     backgroundColor: '#f44336',
                     color: 'white',
                     border: 'none',
                     borderRadius: '4px',
                     cursor: 'pointer'
                   }}
                 >
                   清除选择
                 </button>
               </div>
             </div>
             
             {callChainError && (
               <div style={{ 
                 padding: '8px', 
                 backgroundColor: '#ffebee', 
                 color: '#c62828', 
                 borderRadius: '4px', 
                 fontSize: '12px',
                 marginBottom: '8px'
               }}>
                 {callChainError}
               </div>
             )}
             
             {/* 调用链内容调试信息 */}
             <div style={{ 
               padding: '6px', 
               backgroundColor: '#fff3e0', 
               border: '1px solid #ff9800',
               borderRadius: '4px', 
               fontSize: '10px',
               marginBottom: '8px',
               color: '#e65100'
             }}>
               <strong>调用链内容调试:</strong><br/>
               callChain.length: {callChain.length}<br/>
               callChainLoading: {callChainLoading ? 'true' : 'false'}<br/>
               callChainError: {callChainError ? '有错误' : '无错误'}<br/>
               {callChain.length > 0 && (
                 <>
                   第一个调用关系: {callChain[0].callerName} → {callChain[0].calleeName}<br/>
                   调用关系详情: {JSON.stringify(callChain.slice(0, 2), null, 2)}
                 </>
               )}
             </div>
             
             {callChain.length > 0 ? (
                <div style={{ 
                  border: '1px solid #e0e0e0', 
                  borderRadius: '6px', 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  backgroundColor: '#f8f9fa'
                }}>
                  {callChain.map((relation, index) => (
                    <div key={`${relation.callerId}-${relation.calleeId}-${index}`} style={{ 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #e0e0e0',
                      fontSize: '12px'
                    }}>
                      <div style={{ color: '#333', fontWeight: '500', marginBottom: '4px' }}>
                        {relation.callerName} → {relation.calleeName}
                      </div>
                      <div style={{ color: '#666', fontSize: '11px' }}>
                        调用者: {relation.callerFileId} | 被调用者: {relation.calleeFileId}
                      </div>
                      
                      {/* 新增：当被调用者是接口时，显示实现选择 */}
                      {relation.calleeScope === '3' && (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '8px', 
                          backgroundColor: '#fff3cd', 
                          border: '1px solid #ffeaa7',
                          borderRadius: '4px'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            marginBottom: '8px'
                          }}>
                            <span style={{ fontSize: '11px', color: '#856404' }}>
                              🔗 {relation.calleeName} 是接口，需要选择实现类继续查看调用链
                            </span>
                            <button
                              onClick={() => handleInterfaceImplementation(relation.calleeId, relation.calleeName)}
                              style={{
                                fontSize: '10px',
                                padding: '4px 8px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              选择实现
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : !callChainLoading && !callChainError ? (
               <div style={{ 
                 padding: '8px', 
                 backgroundColor: '#f5f5f5', 
                 color: '#666', 
                 borderRadius: '4px', 
                 fontSize: '12px',
                 textAlign: 'center'
               }}>
                 暂无调用关系
               </div>
             ) : null}
           </div>
         )}
        
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
       
       {/* 新增：接口实现选择器 */}
       {showImplementationSelector && currentInterface && (
         <div style={{
           position: 'fixed',
           top: '50%',
           left: '50%',
           transform: 'translate(-50%, -50%)',
           zIndex: 2000,
           backgroundColor: 'white',
           border: '2px solid #ddd',
           borderRadius: '8px',
           boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
           minWidth: '400px',
           maxWidth: '600px',
           maxHeight: '80vh',
           overflow: 'hidden'
         }}>
           <div style={{
             padding: '16px 20px',
             backgroundColor: '#f8f9fa',
             borderBottom: '1px solid #ddd',
             display: 'flex',
             justifyContent: 'space-between',
             alignItems: 'center'
           }}>
             <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>
               🔗 选择接口实现
             </h3>
             <button
               onClick={() => setShowImplementationSelector(false)}
               style={{
                 background: 'none',
                 border: 'none',
                 fontSize: '18px',
                 cursor: 'pointer',
                 color: '#666',
                 padding: '4px'
               }}
             >
               ×
             </button>
           </div>
           
           <div style={{ padding: '20px' }}>
             <div style={{ marginBottom: '16px' }}>
               <strong style={{ color: '#333' }}>接口:</strong> 
               <span style={{ marginLeft: '8px', color: '#666' }}>{currentInterface.name}</span>
             </div>
             
             <div style={{ marginBottom: '16px' }}>
               <strong style={{ color: '#333' }}>实现类 ({interfaceImplementations.length}):</strong>
             </div>
             
             <div style={{
               border: '1px solid #e0e0e0',
               borderRadius: '6px',
               maxHeight: '300px',
               overflowY: 'auto'
             }}>
               {interfaceImplementations.map((impl, index) => (
                 <div key={impl.id} style={{
                   padding: '12px 16px',
                   borderBottom: '1px solid #f0f0f0',
                   cursor: 'pointer',
                   transition: 'background-color 0.2s'
                 }}
                 onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                 onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                   onClick={() => selectInterfaceImplementation(impl.id, impl.name)}
                 >
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <div>
                       <div style={{ fontWeight: '500', color: '#333', marginBottom: '4px' }}>
                         {index + 1}. {impl.name}
                       </div>
                       <div style={{ fontSize: '12px', color: '#666' }}>
                         文件: {impl.fileId}
                       </div>
                       {impl.functions && impl.functions.length > 0 && (
                         <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                           函数: {impl.functions.map(f => f.name).join(', ')}
                         </div>
                       )}
                     </div>
                     <span style={{ color: '#007bff', fontSize: '14px' }}>→</span>
                   </div>
                 </div>
               ))}
             </div>
             
             <div style={{
               marginTop: '20px',
               padding: '16px',
               backgroundColor: '#f8f9fa',
               borderRadius: '6px',
               fontSize: '13px',
               color: '#666'
             }}>
               💡 点击任意实现类继续查看其调用链
             </div>
           </div>
         </div>
       )}
     </div>
   );
 };

export default NodeDetails;
