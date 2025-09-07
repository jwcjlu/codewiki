import React, { useState, useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import './MermaidExporter.css';

export interface ChartConfig {
  title: string;
  description: string;
  mermaidCode: string;
}

export interface PNGExportOptions {
  scale: number;        // 分辨率倍数 (1, 2, 3, 4)
  quality: number;      // 质量 (0.1 - 1.0)
  backgroundColor: string; // 背景色
  format: 'png' | 'jpeg';
}

export type ExportFormat = 'svg' | 'png' | 'pdf';

interface MermaidExporterProps {
  chartConfig: ChartConfig;
  onExport?: (format: ExportFormat, data: string) => void;
}

const MermaidExporter: React.FC<MermaidExporterProps> = ({ 
  chartConfig, 
  onExport 
}) => {
  const [svgElement, setSvgElement] = useState<SVGElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPNGOptions, setShowPNGOptions] = useState(false);
  const [pngOptions, setPngOptions] = useState<PNGExportOptions>({
    scale: 3,
    quality: 1.0,
    backgroundColor: '#ffffff',
    format: 'png'
  });
  const chartRef = useRef<HTMLDivElement>(null);
  const renderTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // 初始化Mermaid - 增加文本大小限制
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      flowchart: {
        useMaxWidth: false,
        htmlLabels: true,
        curve: 'basis',
        nodeSpacing: 80,
        rankSpacing: 120
      },
      // 增加文本大小限制
      maxTextSize: 100000
    });
  }, []);

  useEffect(() => {
    // 清除之前的定时器
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    
    // 防抖渲染
    if (chartConfig.mermaidCode && chartRef.current) {
      renderTimeoutRef.current = setTimeout(() => {
        renderChart();
      }, 300);
    }
    
    // 清理函数
    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
      // 不在这里清理DOM，让React处理
    };
  }, [chartConfig.mermaidCode]);

  const renderChart = async () => {
    if (!chartRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      // 更安全的清空容器方式 - 使用React兼容的方法
      const container = chartRef.current;
      if (container) {
        // 使用 textContent 清空容器，避免DOM操作冲突
        container.textContent = '';
        
        // 创建包含Mermaid代码的元素
        const mermaidElement = document.createElement('div');
        mermaidElement.className = 'mermaid';
        mermaidElement.textContent = chartConfig.mermaidCode;
        
        // 添加唯一ID避免冲突
        const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        mermaidElement.id = uniqueId;
        
        container.appendChild(mermaidElement);
        
        // 渲染图表
        await mermaid.run({
          nodes: [mermaidElement]
        });
        
        // 获取渲染后的SVG元素
        const svgElement = container.querySelector('svg');
        if (svgElement) {
          setSvgElement(svgElement as SVGElement);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '渲染图表失败');
      // 清理失败的内容 - 使用更安全的方法
      if (chartRef.current) {
        chartRef.current.textContent = '';
      }
    } finally {
      setIsLoading(false);
    }
  };

  const exportSVG = () => {
    if (!svgElement) return;
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chartConfig.title}.svg`;
    link.click();
    
    URL.revokeObjectURL(url);
    onExport?.('svg', svgData);
  };

  const exportPNG = () => {
    if (!svgElement) return;
    
    setIsLoading(true);
    
    // 获取SVG的尺寸
    const svgRect = svgElement.getBoundingClientRect();
    const svgWidth = svgRect.width;
    const svgHeight = svgRect.height;
    
    // 使用用户配置的分辨率倍数
    const scale = pngOptions.scale;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setIsLoading(false);
      return;
    }
    
    // 设置画布尺寸为SVG尺寸的倍数
    canvas.width = svgWidth * scale;
    canvas.height = svgHeight * scale;
    
    // 设置画布样式尺寸
    canvas.style.width = `${svgWidth}px`;
    canvas.style.height = `${svgHeight}px`;
    
    // 设置高分辨率渲染上下文
    ctx.scale(scale, scale);
    
    // 设置背景色
    ctx.fillStyle = pngOptions.backgroundColor;
    ctx.fillRect(0, 0, svgWidth, svgHeight);
    
    // 将SVG转换为图像
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const img = new Image();
    img.onload = () => {
      // 绘制图像到画布
      ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
      
      // 根据格式导出
      if (pngOptions.format === 'png') {
        // 导出PNG
        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${chartConfig.title}.png`;
            link.click();
            URL.revokeObjectURL(downloadUrl);
            onExport?.('png', canvas.toDataURL('image/png', 1.0));
          }
          setIsLoading(false);
          URL.revokeObjectURL(url);
        }, 'image/png', 1.0);
      } else {
        // 导出JPEG
        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${chartConfig.title}.jpg`;
            link.click();
            URL.revokeObjectURL(downloadUrl);
            onExport?.('png', canvas.toDataURL('image/jpeg', pngOptions.quality));
          }
          setIsLoading(false);
          URL.revokeObjectURL(url);
        }, 'image/jpeg', pngOptions.quality);
      }
    };
    
    img.onerror = () => {
      setIsLoading(false);
      URL.revokeObjectURL(url);
      alert('图像导出失败，请重试');
    };
    
    img.src = url;
  };

  const exportPDF = () => {
    // PDF导出需要额外的库支持，这里提供占位符
    alert('PDF导出功能需要额外的库支持，请使用SVG或PNG格式');
    onExport?.('pdf', 'PDF export not implemented');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(chartConfig.mermaidCode).then(() => {
      alert('Mermaid代码已复制到剪贴板');
    }).catch(() => {
      alert('复制失败，请手动复制');
    });
  };

  return (
    <div className="mermaid-exporter">
      <div className="mermaid-exporter-header">
        <h3>{chartConfig.title}</h3>
        <p>{chartConfig.description}</p>
      </div>

      <div className="mermaid-exporter-controls">
        <button 
          onClick={exportSVG} 
          disabled={!svgElement || isLoading}
          className="export-btn svg-btn"
        >
          导出SVG
        </button>
        <div className="png-export-group">
          <button 
            onClick={exportPNG} 
            disabled={!svgElement || isLoading}
            className="export-btn png-btn"
          >
            导出PNG
          </button>
          <button 
            onClick={() => setShowPNGOptions(!showPNGOptions)}
            className="export-btn options-btn"
            title="PNG导出选项"
          >
            ⚙️
          </button>
        </div>
        <button 
          onClick={exportPDF} 
          disabled={!svgElement || isLoading}
          className="export-btn pdf-btn"
        >
          导出PDF
        </button>
        <button 
          onClick={copyCode} 
          className="export-btn copy-btn"
        >
          复制代码
        </button>
      </div>

      {/* PNG导出选项面板 */}
      {showPNGOptions && (
        <div className="png-options-panel">
          <h4>PNG导出选项</h4>
          <div className="options-grid">
            <div className="option-item">
              <label>分辨率倍数:</label>
              <select 
                value={pngOptions.scale} 
                onChange={(e) => setPngOptions({...pngOptions, scale: Number(e.target.value)})}
              >
                <option value={1}>1x (标准)</option>
                <option value={2}>2x (高清)</option>
                <option value={3}>3x (超清)</option>
                <option value={4}>4x (极清)</option>
              </select>
            </div>
            <div className="option-item">
              <label>导出格式:</label>
              <select 
                value={pngOptions.format} 
                onChange={(e) => setPngOptions({...pngOptions, format: e.target.value as 'png' | 'jpeg'})}
              >
                <option value="png">PNG (无损)</option>
                <option value="jpeg">JPEG (有损)</option>
              </select>
            </div>
            {pngOptions.format === 'jpeg' && (
              <div className="option-item">
                <label>JPEG质量:</label>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1.0" 
                  step="0.1"
                  value={pngOptions.quality}
                  onChange={(e) => setPngOptions({...pngOptions, quality: Number(e.target.value)})}
                />
                <span>{Math.round(pngOptions.quality * 100)}%</span>
              </div>
            )}
            <div className="option-item">
              <label>背景色:</label>
              <input 
                type="color" 
                value={pngOptions.backgroundColor}
                onChange={(e) => setPngOptions({...pngOptions, backgroundColor: e.target.value})}
              />
            </div>
          </div>
          <div className="options-info">
            <p><strong>分辨率说明:</strong></p>
            <ul>
              <li>1x: 标准分辨率，适合屏幕显示</li>
              <li>2x: 高清分辨率，适合一般打印</li>
              <li>3x: 超清分辨率，适合高质量打印</li>
              <li>4x: 极清分辨率，适合专业印刷</li>
            </ul>
          </div>
        </div>
      )}

      <div className="mermaid-exporter-chart">
        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>渲染中...</span>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <span>❌ {error}</span>
          </div>
        )}
        
        <div 
          ref={chartRef} 
          className="mermaid-chart"
          data-mermaid={chartConfig.mermaidCode}
        />
      </div>

      <div className="mermaid-exporter-code">
        <h4>Mermaid代码</h4>
        <pre>
          <code>{chartConfig.mermaidCode}</code>
        </pre>
      </div>
    </div>
  );
};

export default MermaidExporter;
