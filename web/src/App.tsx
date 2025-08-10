import React from 'react';
import RepoManager from './components/RepoManager';

const App: React.FC = () => {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 20, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', background: 'white', padding: 20, borderRadius: 8, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ color: '#333', margin: 0 }}>代码仓库分析系统</h1>
        </div>
        <RepoManager />
      </div>
    </div>
  );
};

export default App;
