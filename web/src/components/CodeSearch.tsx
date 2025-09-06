import React, { useState, useCallback, useRef, useEffect } from 'react';
import { askQuestion } from '../services/api';
import { AnswerReq } from '../types';
import './CodeSearch.css';

interface CodeSearchProps {
  repoId: string;
  repoName: string;
}

const CodeSearch: React.FC<CodeSearchProps> = ({ repoId, repoName }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 主题切换
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }, [theme]);

  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // 组件挂载时设置标志
    isMountedRef.current = true;
    
    return () => {
      // 组件卸载时清理
      console.log('组件即将卸载，清理资源');
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 监控answer状态变化
  useEffect(() => {
    console.log('answer状态变化:', { answer, answerLength: answer.length, isStreaming });
  }, [answer, isStreaming]);

  // 监控组件挂载状态
  useEffect(() => {
    console.log('CodeSearch组件已挂载');
    return () => {
      console.log('CodeSearch组件即将卸载');
    };
  }, []);

  const handleAsk = useCallback(async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setError(null);
    setAnswer('');
    setIsStreaming(false); // 重置流式状态
    console.log('开始提问:', question.trim());

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await askQuestion(
        { id: repoId, question: question.trim() }, 
        abortControllerRef.current.signal,
        // 流式回调函数
        (chunk: string, isComplete: boolean) => {
          console.log('onChunk回调被调用:', { chunk, isComplete, chunkLength: chunk?.length, isMounted: isMountedRef.current });
          
          // 检查组件是否仍然挂载
          if (!isMountedRef.current) {
            console.log('组件已卸载，跳过更新');
            return;
          }
          
          try {
            if (isComplete) {
              // 完成时设置完整答案并立即隐藏思考效果
              if (chunk && chunk.trim()) {
                // 如果完成时的chunk有内容，直接设置为答案
                setAnswer(chunk);
                console.log('流式传输完成，设置完整答案，长度:', chunk.length);
              } else {
                // 否则保持当前累积的答案
                console.log('流式传输完成，保持累积答案，长度:', answer.length);
              }
              // 立即隐藏思考效果
              setIsStreaming(false);
              console.log('AI回答完成，隐藏思考效果');
            } else if (chunk && chunk.trim()) {
              // 流式更新，追加新的内容块
              setAnswer(prev => {
                const newAnswer = prev + chunk;
                console.log('收到chunk:', chunk, '当前答案长度:', newAnswer.length, '累积答案:', newAnswer);
                return newAnswer;
              });
              // 显示思考效果
              setIsStreaming(true);
            } else {
              console.log('收到空chunk，跳过:', chunk);
            }
          } catch (error) {
            console.error('处理chunk时出错:', error);
          }
        }
      );
      
      if (isMountedRef.current) {
        // 流式响应已经在回调中处理，这里不需要额外设置
        console.log('流式响应完成，response:', response);
      }
    } catch (err: any) {
      if (isMountedRef.current && err.name !== 'AbortError') {
        setError(err.message || '请求失败，请重试');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        // 确保在完成时隐藏思考效果
        setIsStreaming(false);
      }
    }
  }, [question, repoId, answer.length]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }, [handleAsk]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuestion(e.target.value);
  }, []);

  const handleButtonClick = useCallback(() => {
    handleAsk();
  }, [handleAsk]);

  const handleClear = useCallback(() => {
    setQuestion('');
    setAnswer('');
    setError(null);
    setIsStreaming(false);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // 可以添加一个临时的成功提示
      console.log('答案已复制到剪贴板');
    } catch (err) {
      console.error('复制失败:', err);
      // 降级方案：使用传统的复制方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('答案已复制到剪贴板（降级方案）');
      } catch (fallbackErr) {
        console.error('降级复制也失败:', fallbackErr);
      }
      textArea.remove();
    }
  }, []);

  const handleErrorClose = useCallback(() => {
    setError(null);
  }, []);

  const formatAnswer = useCallback((text: string) => {
    if (!text) return null;
    
    // 分割文本为段落
    const paragraphs = text.split('\n').filter(line => line.trim());
    
    return paragraphs.map((paragraph, index) => {
      // 检测深度思考标签
      if (paragraph.startsWith('<think>') && paragraph.endsWith('</think>')) {
        const thinkingContent = paragraph.slice(7, -8);
        return (
          <div key={index} className="thinking-container">
            <div className="thinking-header">
              深度思考过程
            </div>
            <div className="thinking-content">
              <div className="thinking-text">
                {formatAnswer(thinkingContent)}
              </div>
            </div>
          </div>
        );
      }
      
      // 检测代码块
      if (paragraph.startsWith('```') && paragraph.endsWith('```')) {
        const code = paragraph.slice(3, -3);
        return (
          <pre key={index} className="code-block">
            <code>{code}</code>
          </pre>
        );
      }
      
      // 检测行内代码
      if (paragraph.includes('`')) {
        const parts = paragraph.split('`');
        return (
          <p key={index}>
            {parts.map((part, partIndex) => 
              partIndex % 2 === 0 ? part : <code key={partIndex}>{part}</code>
            )}
          </p>
        );
      }
      
      // 检测标题
      if (paragraph.startsWith('#')) {
        const level = paragraph.match(/^#+/)?.[0].length || 1;
        const title = paragraph.replace(/^#+\s*/, '');
        const HeadingTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        return <HeadingTag key={index}>{title}</HeadingTag>;
      }
      
      // 检测列表项
      if (paragraph.match(/^[\s]*[-*+]\s/)) {
        const content = paragraph.replace(/^[\s]*[-*+]\s/, '');
        return <li key={index}>{content}</li>;
      }
      
      if (paragraph.match(/^[\s]*\d+\.\s/)) {
        const content = paragraph.replace(/^[\s]*\d+\.\s/, '');
        return <li key={index}>{content}</li>;
      }
      
      // 检测引用
      if (paragraph.startsWith('>')) {
        const content = paragraph.replace(/^>\s*/, '');
        return (
          <blockquote key={index}>
            {content}
          </blockquote>
        );
      }
      
      // 检测分割线
      if (paragraph.match(/^[-*_]{3,}$/)) {
        return <hr key={index} />;
      }
      
      // 检测高亮文本
      if (paragraph.includes('**') || paragraph.includes('__')) {
        const parts = paragraph.split(/(\*\*.*?\*\*|__.*?__)/);
        return (
          <p key={index}>
            {parts.map((part, partIndex) => {
              if (part.match(/^\*\*.*?\*\*$/) || part.match(/^__.*?__$/)) {
                const text = part.replace(/^\*\*|\*\*$/g, '').replace(/^__|__$/g, '');
                return <strong key={partIndex}>{text}</strong>;
              }
              return part;
            })}
          </p>
        );
      }
      
      // 检测斜体文本
      if (paragraph.includes('*') || paragraph.includes('_')) {
        const parts = paragraph.split(/(\*.*?\*|_.*?_)/);
        return (
          <p key={index}>
            {parts.map((part, partIndex) => {
              if (part.match(/^\*.*?\*$/) || part.match(/^_.*?_$/)) {
                const text = part.replace(/^\*|\*$/g, '').replace(/^_|_$/g, '');
                return <em key={partIndex}>{text}</em>;
              }
              return part;
            })}
          </p>
        );
      }
      
      // 检测链接
      if (paragraph.includes('[') && paragraph.includes('](') && paragraph.includes(')')) {
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        const elements = [];
        let match;
        
        while ((match = linkRegex.exec(paragraph)) !== null) {
          const [fullMatch, text, url] = match;
          elements.push(paragraph.slice(lastIndex, match.index));
          elements.push(
            <a key={`link-${match.index}`} href={url} target="_blank" rel="noopener noreferrer">
              {text}
            </a>
          );
          lastIndex = match.index + fullMatch.length;
        }
        
        if (lastIndex < paragraph.length) {
          elements.push(paragraph.slice(lastIndex));
        }
        
        return <p key={index}>{elements}</p>;
      }
      
      // 普通段落
      return <p key={index}>{paragraph}</p>;
    });
  }, []);

  const renderAnswer = useCallback((answer: string) => {
    return (
      <div className="answer-container">
        <h4>
          AI回答
          {isStreaming && (
            <span className="streaming-indicator">
              <span className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </span>
          )}
        </h4>
        <div className="answer-content">
          <div className={`answer-text ${isStreaming ? 'streaming' : ''}`}>
            {formatAnswer(answer)}
          </div>
          {isStreaming && (
            <div className="streaming-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="progress-info">
                <span className="progress-text">AI正在思考中...</span>
                <span className="char-count">已生成 {answer.length} 个字符</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [formatAnswer, isStreaming, answer.length]);

  return (
    <>
      {/* 主题切换按钮 */}
      <button className="theme-toggle" onClick={toggleTheme} title={`切换到${theme === 'light' ? '夜间' : '白天'}模式`}>
        <span className="sun-icon">☀️</span>
        <span className="moon-icon">🌙</span>
      </button>

      <div className="code-search">
        <div className="search-header">
          <h3>AI智能问答</h3>
          <p>向AI询问关于 <strong>{repoName}</strong> 代码库的问题</p>
        </div>

        <div className="search-input-container">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="请输入您的问题，例如：如何实现用户认证？"
              value={question}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            <button
              type="button"
              className="search-button"
              onClick={handleButtonClick}
              disabled={isLoading || !question.trim()}
            >
              {isLoading ? (
                isStreaming ? 'AI思考中...' : '处理中...'
              ) : '提问'}
            </button>
            <button
              type="button"
              className="clear-button"
              onClick={handleClear}
              title="清空"
            >
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span>❌ {error}</span>
            <button
              type="button"
              className="error-close-button"
              onClick={handleErrorClose}
              title="关闭错误"
            >
              ✕
            </button>
          </div>
        )}

        {answer && (
          <div className="answer-container">
            <div className="answer-header">
              <h4>🤖 AI回答</h4>
              <div className="answer-actions">
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => copyToClipboard(answer)}
                  title="复制答案"
                >
                  📋 复制
                </button>
                <button
                  type="button"
                  className="clear-button"
                  onClick={handleClear}
                  title="清空"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* 只在流式传输过程中显示进度条 */}
            {isStreaming && (
              <div className="streaming-progress">
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
                <div className="progress-info">
                  <span className="progress-text">AI正在思考中...</span>
                  <span className="char-count">已生成 {answer.length} 个字符</span>
                </div>
              </div>
            )}
            
            <div className="answer-content">
              <div className="answer-text">
                {renderAnswer(answer)}
              </div>
            </div>
          </div>
        )}

        {!answer && !error && !isLoading && (
          <div className="help-container">
            <h4>💡 使用提示</h4>
            <div className="help-content">
              <p>您可以询问以下类型的问题：</p>
              <ul>
                <li><em>代码功能</em>：某个函数或类的作用是什么？</li>
                <li><em>架构设计</em>：项目的整体架构是怎样的？</li>
                <li><em>最佳实践</em>：如何优化这段代码？</li>
                <li><em>问题排查</em>：遇到某个错误怎么解决？</li>
                <li><em>技术选型</em>：为什么选择这个技术栈？</li>
              </ul>
              <p><strong>提示</strong>：问题描述越具体，AI的回答越准确！</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CodeSearch;

