import React, { useState } from 'react';
import RepoManager from './components/RepoManager';
import MermaidTest from './components/MermaidTest';
import './App.css';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'main' | 'mermaid'>('main');

  return (
    <div className="app">
      <div className="app-container">
        {/* 导航栏 */}
        <div className="app-header">
          <h1 className="app-title">代码仓库分析系统</h1>
          <nav className="app-nav">
            <button
              className={`nav-btn ${currentPage === 'main' ? 'active' : ''}`}
              onClick={() => setCurrentPage('main')}
            >
              🏠 主页面
            </button>
            <button
              className={`nav-btn ${currentPage === 'mermaid' ? 'active' : ''}`}
              onClick={() => setCurrentPage('mermaid')}
            >
              🎨 Mermaid图表
            </button>
          </nav>
        </div>

        {/* 页面内容 */}
        <div className="app-content">
          {currentPage === 'main' ? (
            <RepoManager />
          ) : (
            <MermaidTest />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
