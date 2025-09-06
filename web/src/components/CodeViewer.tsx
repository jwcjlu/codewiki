import React, { useEffect, useRef, useMemo, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import { Function, Language } from '../types';

interface CodeViewerProps {
  content: string;
  language: string | Language;
  fileName: string;
  functions: Function[];
  onClose: () => void;
  onFunctionClick?: (func: Function) => void;
  highlightFunction?: string; // 新增：要高亮显示的函数名
}

const CodeViewer: React.FC<CodeViewerProps> = ({ content, language, fileName, functions, onClose, onFunctionClick, highlightFunction }) => {
  const codeRef = useRef<HTMLElement>(null);
  
  // 新增：左右导航相关状态
  const [currentFunctionIndex, setCurrentFunctionIndex] = useState<number>(-1);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isEnterPressed, setIsEnterPressed] = useState(false);

  useEffect(() => {
    if (codeRef.current) {
      // 先进行语法高亮
      Prism.highlightElement(codeRef.current);
      
      // 延迟进行函数替换，确保语法高亮完成
      setTimeout(() => {
        if (codeRef.current && functions && functions.length > 0) {
          console.log('Applying function replacements after syntax highlighting...');
          applyFunctionReplacements();
          
          // 如果有指定要高亮的函数，进行定位和高亮
          if (highlightFunction) {
            setTimeout(() => {
              scrollToAndHighlightFunction(highlightFunction);
            }, 100);
          } else {
            // 如果没有指定高亮函数，自动选择第一个函数作为导航起始点
            setTimeout(() => {
              setCurrentFunctionIndex(0);
            }, 200);
          }
        }
      }, 50);
    }
  }, [content, language, functions, highlightFunction]);

  // 在DOM中直接应用函数替换
  const applyFunctionReplacements = () => {
    const codeElement = codeRef.current;
    if (!codeElement) return;

    console.log('Starting function replacements in DOM...');
    
    // 按函数名长度降序排列
    const sortedFunctions = [...functions].sort((a, b) => b.name.length - a.name.length);
    
    sortedFunctions.forEach(func => {
      const funcName = func.name;
      console.log(`Processing function: ${funcName} (ID: ${func.id})`);
      
      // 查找所有包含该函数名的token元素
      const tokenElements = codeElement.querySelectorAll('.token.function, .token.identifier');
      console.log(`Found ${tokenElements.length} token elements to check`);
      
      let replacedCount = 0;
      tokenElements.forEach(tokenElement => {
        const text = tokenElement.textContent || '';
        if (text === funcName) {
          console.log(`Found matching token element for ${funcName}`);
          
          // 检查下一个兄弟元素是否是左括号
          const nextSibling = tokenElement.nextSibling;
          if (nextSibling && nextSibling.textContent === '(') {
            console.log(`Found opening parenthesis after ${funcName}`);
            
            // 创建新的可点击元素
            const clickableSpan = document.createElement('span');
            clickableSpan.className = 'clickable-function';
            clickableSpan.setAttribute('data-function-id', func.id);
            clickableSpan.style.cssText = 'color:rgb(12, 97, 201); cursor: pointer; text-decoration: underline; border-bottom: 1px dotted #60a5fa;';
            clickableSpan.title = `点击查看 ${funcName} 的调用链`;
            clickableSpan.textContent = funcName;
            
            // 替换原始token元素
            tokenElement.parentNode?.replaceChild(clickableSpan, tokenElement);
            replacedCount++;
            
            console.log(`Successfully replaced ${funcName} token element`);
          }
        }
      });
      
      console.log(`Replaced ${replacedCount} occurrences of ${funcName}`);
    });
    
    // 检查最终结果
    const clickableElements = codeElement.querySelectorAll('.clickable-function');
    console.log(`Final result: found ${clickableElements.length} clickable function elements`);
  };

  // 新增：滚动到指定函数位置并高亮
  const scrollToAndHighlightFunction = (functionName: string) => {
    const codeElement = codeRef.current;
    if (!codeElement) return;

    // 查找包含该函数名的元素
    const functionElements = codeElement.querySelectorAll('.clickable-function');
    
    for (let i = 0; i < functionElements.length; i++) {
      const element = functionElements[i] as HTMLElement;
      if (element.textContent === functionName) {
        // 滚动到元素位置
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // 根据导航状态选择高亮样式
        if (isNavigating) {
          element.classList.add('navigating-function');
          // 导航状态的高亮持续时间较短
          setTimeout(() => {
            element.classList.remove('navigating-function');
          }, 2000);
        } else {
          element.classList.add('highlighted-function');
          // 普通高亮持续时间较长
          setTimeout(() => {
            element.classList.remove('highlighted-function');
          }, 3000);
        }
        
        console.log(`Scrolled to and highlighted function: ${functionName}`);
        return;
      }
    }
    
    console.log(`Function ${functionName} not found in code`);
  };

  // 新增：左右导航函数
  const navigateToFunction = (direction: 'left' | 'right') => {
    if (!functions || functions.length === 0) return;
    
    let newIndex: number;
    if (direction === 'left') {
      newIndex = currentFunctionIndex <= 0 ? functions.length - 1 : currentFunctionIndex - 1;
    } else {
      newIndex = currentFunctionIndex >= functions.length - 1 ? 0 : currentFunctionIndex + 1;
    }
    
    setCurrentFunctionIndex(newIndex);
    setIsNavigating(true);
    
    // 高亮并滚动到目标函数
    const targetFunction = functions[newIndex];
    if (targetFunction) {
      scrollToAndHighlightFunction(targetFunction.name);
      
      // 2秒后取消导航状态
      setTimeout(() => {
        setIsNavigating(false);
      }, 2000);
    }
  };

  // 新增：处理键盘事件
  const handleKeyDown = (event: KeyboardEvent) => {
    // 只在有函数且没有其他输入焦点时响应
    if (!functions || functions.length === 0) return;
    
    // 检查是否在输入框中
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }
    
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        navigateToFunction('left');
        break;
      case 'ArrowRight':
        event.preventDefault();
        navigateToFunction('right');
        break;
      case 'Enter':
        event.preventDefault();
        let targetFunction: Function | null = null;
        
        // 如果有当前选中的函数，使用它
        if (currentFunctionIndex >= 0 && currentFunctionIndex < functions.length) {
          targetFunction = functions[currentFunctionIndex];
        } else if (functions.length > 0) {
          // 如果没有选中的函数，自动选择第一个
          targetFunction = functions[0];
          setCurrentFunctionIndex(0);
        }
        
        if (targetFunction) {
          console.log(`Enter key pressed, viewing call chain for: ${targetFunction.name}`);
          
          // 设置 Enter 键按下状态，提供视觉反馈
          setIsEnterPressed(true);
          
          // 自动高亮并滚动到目标函数
          scrollToAndHighlightFunction(targetFunction.name);
          
          // 短暂显示反馈后恢复
          setTimeout(() => {
            setIsEnterPressed(false);
          }, 500);
          
          // 调用函数点击处理
          handleFunctionClick(targetFunction);
        }
        break;
      case 'Escape':
        event.preventDefault();
        setCurrentFunctionIndex(-1);
        setIsNavigating(false);
        // 移除所有高亮
        const codeElement = codeRef.current;
        if (codeElement) {
          const highlightedElements = codeElement.querySelectorAll('.highlighted-function');
          highlightedElements.forEach(el => el.classList.remove('highlighted-function'));
        }
        break;
    }
  };

  const getPrismLanguage = (lang: string | Language): string => {
    // 如果是 Language 枚举，转换为字符串
    const langStr = typeof lang === 'number' ? Language[lang] : lang;
    
    switch (langStr?.toLowerCase()) {
      case 'golang':
      case 'go':
        return 'go';
      case 'java':
        return 'java';
      case 'python':
      case 'py':
        return 'python';
      case 'rust':
      case 'rs':
        return 'rust';
      default:
        return 'go'; // 默认使用 Go
    }
  };

  const handleFunctionClick = (func: Function) => {
    if (onFunctionClick) {
      onFunctionClick(func);
    } else {
      // Fallback: just log for now
      console.log('Function clicked:', func);
    }
  };

  const prismLanguage = getPrismLanguage(language);

  // 处理代码点击事件
  useEffect(() => {
    const codeElement = codeRef.current;
    if (!codeElement) {
      console.log('Code element ref is null');
      return;
    }

    // 延迟绑定事件监听器，确保DOM内容已经渲染完成
    const timer = setTimeout(() => {
      console.log('Adding click event listener to code element');
      
      const handleCodeClick = (event: MouseEvent) => {
        console.log('Code clicked, target:', event.target);
        console.log('Target element:', event.target);
        console.log('Target classList:', (event.target as HTMLElement).classList);
        
        let target = event.target as HTMLElement;
        
        // 如果点击的是文本节点，向上查找父元素
        if (target.nodeType === Node.TEXT_NODE) {
          target = target.parentElement as HTMLElement;
          console.log('Found parent element:', target);
        }
        
        // 检查目标元素或其父元素是否包含 clickable-function 类
        let clickableElement = target;
        while (clickableElement && !clickableElement.classList.contains('clickable-function')) {
          clickableElement = clickableElement.parentElement as HTMLElement;
          console.log('Checking parent:', clickableElement);
        }
        
        if (clickableElement && clickableElement.classList.contains('clickable-function')) {
          console.log('Clickable function clicked:', clickableElement);
          const functionId = clickableElement.getAttribute('data-function-id');
          console.log('Function ID:', functionId);
          
          if (functionId) {
            const func = functions.find(f => f.id === functionId);
            console.log('Found function:', func);
            if (func) {
              handleFunctionClick(func);
            }
          }
        } else {
          console.log('No clickable function element found');
        }
      };

      codeElement.addEventListener('click', handleCodeClick);
      
      // 测试：检查是否有可点击的函数元素
      const clickableElements = codeElement.querySelectorAll('.clickable-function');
      console.log('Found clickable function elements:', clickableElements.length);
      
      // 打印每个可点击元素的详细信息
      clickableElements.forEach((el, index) => {
        console.log(`Clickable element ${index}:`, el);
        console.log(`Element classes:`, el.classList);
        console.log(`Element data-function-id:`, el.getAttribute('data-function-id'));
      });
      
      // 返回清理函数
      return () => {
        console.log('Removing click event listener from code element');
        codeElement.removeEventListener('click', handleCodeClick);
      };
    }, 100); // 延迟100ms确保DOM渲染完成

    // 清理定时器
    return () => {
      clearTimeout(timer);
    };
  }, [functions]); // 只依赖 functions，不依赖 renderCodeWithClickableFunctions

  // 新增：键盘事件监听器
  useEffect(() => {
    // 添加全局键盘事件监听器
    document.addEventListener('keydown', handleKeyDown);
    
    // 清理函数
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [functions, currentFunctionIndex]); // 依赖 functions 和 currentFunctionIndex

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        width: '90%',
        height: '90%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📄</span>
            <h3 style={{ margin: 0, fontSize: 16 }}>{fileName}</h3>
            <span style={{ 
              fontSize: 12, 
              padding: '2px 8px', 
              background: '#e5e7eb', 
              borderRadius: 12,
              color: '#374151'
            }}>
              {language}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="关闭"
          >
            ✕
          </button>
        </div>

        {/* 函数说明提示 */}
        {functions && functions.length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid #eee',
            background: '#f0f9ff',
            fontSize: 13,
            color: '#0369a1'
          }}>
            💡 提示：代码中的 <span style={{ color: '#60a5fa', textDecoration: 'underline', borderBottom: '1px dotted #60a5fa' }}>蓝色下划线函数名</span> 可以直接点击查看调用链
          </div>
        )}

                {/* 新增：左右导航提示 */}
        {functions && functions.length > 0 && (
          <div 
            className={`${isNavigating ? 'navigation-active' : ''} ${isEnterPressed ? 'enter-pressed' : ''}`}
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid #eee',
              background: isEnterPressed ? '#10b981' : '#fef3c7',
              fontSize: 13,
              color: isEnterPressed ? '#ffffff' : '#92400e',
              transition: 'all 0.3s ease'
            }}
          >
            ⌨️ 快捷键：<span style={{ fontWeight: 'bold' }}>← →</span> 左右导航函数 | <span style={{ fontWeight: 'bold' }}>Enter</span> 查看调用链 | <span style={{ fontWeight: 'bold' }}>ESC</span> 取消导航
            {currentFunctionIndex >= 0 && (
              <span style={{ marginLeft: '16px', fontWeight: 'bold', color: isEnterPressed ? '#ffffff' : '#dc2626' }}>
                当前: {currentFunctionIndex + 1}/{functions.length} - {functions[currentFunctionIndex]?.name}
              </span>
            )}
            {isEnterPressed && (
              <span style={{ marginLeft: '16px', fontWeight: 'bold', color: '#ffffff' }}>
                🚀 正在查看 {functions[currentFunctionIndex]?.name || functions[0]?.name} 的调用链...
              </span>
            )}
          </div>
        )}

        <div style={{
          flex: 1,
          overflow: 'auto',
          background: '#1e1e1e'
        }}>
          <pre style={{ 
            margin: 0, 
            padding: '20px',
            background: 'transparent'
          }}>
            <code
              ref={codeRef}
              className={`language-${prismLanguage}`}
              style={{
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: 14,
                lineHeight: 1.5,
                color: '#d4d4d4'
              }}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </pre>
        </div>
      </div>
      
      <style>{`
        @keyframes spin { 
          0% { transform: rotate(0deg); } 
          100% { transform: rotate(360deg); } 
        }
        
        .highlighted-function {
          background-color: #ffeb3b !important;
          color: #000 !important;
          padding: 2px 4px !important;
          border-radius: 4px !important;
          box-shadow: 0 0 10px rgba(255, 235, 59, 0.8) !important;
          animation: pulse 1s ease-in-out infinite alternate !important;
        }
        
        @keyframes pulse {
          from { box-shadow: 0 0 10px rgba(255, 235, 59, 0.8); }
          to { box-shadow: 0 0 20px rgba(255, 235, 59, 1); }
        }

        /* 新增：导航状态样式 */
        .navigating-function {
          background-color: #3b82f6 !important;
          color: #ffffff !important;
          padding: 2px 4px !important;
          border-radius: 4px !important;
          box-shadow: 0 0 15px rgba(59, 130, 246, 0.8) !important;
          animation: navigate-pulse 0.8s ease-in-out infinite alternate !important;
        }
        
        @keyframes navigate-pulse {
          from { 
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.8);
            transform: scale(1.05);
          }
          to { 
            box-shadow: 0 0 25px rgba(59, 130, 246, 1);
            transform: scale(1.1);
          }
        }

        /* 导航提示高亮 */
        .navigation-active {
          background-color: #fef3c7 !important;
          border-left: 4px solid #f59e0b !important;
          animation: navigation-highlight 2s ease-in-out;
        }
        
        @keyframes navigation-highlight {
          0%, 100% { background-color: #fef3c7; }
          50% { background-color: #fde68a; }
        }

        /* Enter 键按下效果 */
        .enter-pressed {
          background-color: #10b981 !important;
          color: #ffffff !important;
          border-left: 4px solid #059669 !important;
          animation: enter-press 0.5s ease-in-out;
        }
        
        @keyframes enter-press {
          0% { 
            background-color: #fef3c7;
            transform: scale(1);
          }
          50% { 
            background-color: #10b981;
            transform: scale(1.02);
          }
          100% { 
            background-color: #10b981;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default CodeViewer;
