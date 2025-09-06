import React, { useState } from 'react';
import SequenceDiagramGenerator, { 
  SequenceDiagramConfig,
  CallGraphConfig
} from './SequenceDiagramGenerator';
import './SequenceDiagramDemo.css';

const SequenceDiagramDemo: React.FC = () => {
  const [generatedConfigs, setGeneratedConfigs] = useState<Array<SequenceDiagramConfig | CallGraphConfig>>([]);
  const [exportHistory, setExportHistory] = useState<Array<{
    format: string;
    timestamp: string;
    title: string;
    type: string;
  }>>([]);

  // 处理图表生成
  const handleGenerate = (config: SequenceDiagramConfig | CallGraphConfig) => {
    console.log('生成的图表配置:', config);
    setGeneratedConfigs(prev => [config, ...prev]);
  };

  // 处理图表导出
  const handleExport = (format: 'svg' | 'png' | 'pdf', data: string) => {
    console.log(`导出${format}格式:`, data);
    
    // 记录导出历史
    const exportRecord = {
      format,
      timestamp: new Date().toLocaleString(),
      title: `图表_${Date.now()}`,
      type: 'sequence' // 这里可以根据实际导出的图表类型来设置
    };
    setExportHistory(prev => [exportRecord, ...prev]);

    // 实际导出逻辑
    if (format === 'svg') {
      // 创建下载链接
      const blob = new Blob([data], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sequence_diagram_${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="sequence-diagram-demo">
             <div className="demo-header">
         <h1>🚀 图表生成器演示</h1>
         <p>集成文件函数选择器的完整图表生成解决方案，支持时序图和调用图</p>
       </div>

      <div className="demo-content">
        {/* 主要组件 */}
        <SequenceDiagramGenerator
          onGenerate={handleGenerate}
          onExport={handleExport}
        />

        {/* 生成历史 */}
        {generatedConfigs.length > 0 && (
          <div className="generation-history">
            <h3>📚 生成历史</h3>
            <div className="history-grid">
              {generatedConfigs.map((config, index) => (
                <div key={index} className="history-item">
                  <div className="history-header">
                    <h4>{config.title}</h4>
                    <span className="timestamp">
                      {new Date().toLocaleString()}
                    </span>
                  </div>
                                   <div className="history-content">
                   <p><strong>描述:</strong> {config.description}</p>
                   {'participants' in config ? (
                     <>
                       <p><strong>参与者:</strong> {config.participants.length} 个</p>
                       <p><strong>消息:</strong> {config.messages.length} 条</p>
                     </>
                   ) : (
                     <>
                       <p><strong>节点:</strong> {config.nodes.length} 个</p>
                       <p><strong>边:</strong> {config.edges.length} 条</p>
                     </>
                   )}
                 </div>
                  <div className="history-actions">
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const mermaidCode = generateMermaidCode(config);
                        navigator.clipboard.writeText(mermaidCode);
                        alert('Mermaid代码已复制到剪贴板！');
                      }}
                    >
                      📋 复制代码
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 导出历史 */}
        {exportHistory.length > 0 && (
          <div className="export-history">
            <h3>📤 导出历史</h3>
            <div className="export-list">
              {exportHistory.map((record, index) => (
                <div key={index} className="export-item">
                  <div className="export-info">
                                         <span className="export-format">{record.format.toUpperCase()}</span>
                     <span className="export-title">{record.title}</span>
                     <span className="export-type">{record.type}</span>
                     <span className="export-time">{record.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className="usage-guide">
          <h3>📖 使用说明</h3>
          <div className="guide-content">
            <div className="guide-section">
              <h4>🔍 搜索和选择</h4>
              <ul>
                <li>在搜索框中输入文件名、函数名或路径</li>
                <li>使用筛选器按文件类型、作用域等条件过滤</li>
                <li>点击文件或函数进行选择/取消选择</li>
                <li>使用全选/取消全选按钮批量操作</li>
              </ul>
            </div>
            
                         <div className="guide-section">
               <h4>🚀 生成图表</h4>
               <ul>
                 <li>选择完成后点击"生成图表"按钮</li>
                 <li>系统会根据当前选择的图表类型自动生成对应图表</li>
                 <li>时序图：显示函数调用的时间顺序和交互流程</li>
                 <li>调用图：显示模块间的调用关系和依赖结构</li>
                 <li>生成的图表支持SVG、PNG等格式导出</li>
                 <li>可以复制Mermaid代码用于其他工具</li>
               </ul>
             </div>
            
                         <div className="guide-section">
               <h4>⚙️ 高级功能</h4>
               <ul>
                 <li>支持多种搜索模式：包含匹配、开头匹配、正则表达式</li>
                 <li>可按文件大小、复杂度、修改时间等条件筛选</li>
                 <li>智能搜索建议，快速定位目标文件</li>
                 <li>图表类型切换：支持时序图和调用图两种模式</li>
                 <li>响应式设计，支持移动端和桌面端</li>
               </ul>
             </div>
          </div>
        </div>

        {/* 技术特性 */}
        <div className="tech-features">
          <h3>🛠️ 技术特性</h3>
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <h4>高性能</h4>
              <p>使用React Hooks和状态管理，确保流畅的用户体验</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🎨</div>
              <h4>现代化UI</h4>
              <p>采用Material Design风格，支持深色/浅色主题</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📱</div>
              <h4>响应式设计</h4>
              <p>完全响应式布局，适配各种屏幕尺寸</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🔧</div>
              <h4>可扩展</h4>
              <p>模块化设计，易于集成和扩展功能</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 生成Mermaid代码的辅助函数
const generateMermaidCode = (config: SequenceDiagramConfig | CallGraphConfig): string => {
  if ('participants' in config) {
    // 时序图
    let code = 'sequenceDiagram\n';
    
    // 添加参与者
    config.participants.forEach(participant => {
      code += `    participant ${participant}\n`;
    });
    
    code += '\n';
    
    // 添加消息
    config.messages.forEach(message => {
      if (message.type === 'response') {
        code += `    ${message.to}-->>${message.from}: ${message.message}\n`;
      } else {
        code += `    ${message.from}->>${message.to}: ${message.message}\n`;
      }
    });
    
    return code;
  } else {
    // 调用图
    let code = 'graph TD\n';
    
    // 添加节点
    config.nodes.forEach(node => {
      const nodeStyle = getNodeStyle(node.scope);
      code += `    ${node.id.replace(/[^a-zA-Z0-9]/g, '_')}["${node.name}<br/>${node.scope}"]${nodeStyle}\n`;
    });
    
    code += '\n';
    
    // 添加边
    config.edges.forEach(edge => {
      const fromId = edge.from.replace(/[^a-zA-Z0-9]/g, '_');
      const toId = edge.to.replace(/[^a-zA-Z0-9]/g, '_');
      code += `    ${fromId} -->|${edge.label}| ${toId}\n`;
    });
    
    return code;
  }
};

// 获取节点样式的辅助函数
const getNodeStyle = (scope: string): string => {
  switch (scope) {
    case 'controllers':
      return ':::controller';
    case 'models':
      return ':::model';
    case 'services':
      return ':::service';
    case 'dao':
      return ':::dao';
    default:
      return ':::default';
  }
};

export default SequenceDiagramDemo;
