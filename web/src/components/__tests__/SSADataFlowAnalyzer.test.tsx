import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SSADataFlowAnalyzer from '../SSADataFlowAnalyzer';
import { RepositoryNode, CallChainInfo } from '../RepositoryIntegration';

// Mock数据
const mockSelectedNodes: RepositoryNode[] = [
  {
    id: 'func1',
    name: 'getUserInfo',
    type: 'function',
    path: '/src/components/UserManager.tsx',
    metadata: {
      language: 'typescript',
      lines: 25,
      complexity: 3
    }
  },
  {
    id: 'func2',
    name: 'validateUser',
    type: 'function',
    path: '/src/utils/validation.ts',
    metadata: {
      language: 'typescript',
      lines: 15,
      complexity: 2
    }
  }
];

const mockSelectedCallChains: CallChainInfo[] = [
  {
    caller: {
      id: 'func1',
      name: 'getUserInfo',
      file: '/src/components/UserManager.tsx',
      line: 10,
      type: 'function'
    },
    callee: {
      id: 'func2',
      name: 'validateUser',
      file: '/src/utils/validation.ts',
      line: 5,
      type: 'function'
    },
    callType: 'direct',
    context: '验证用户信息',
    parameters: ['userData'],
    returnType: 'boolean'
  }
];

// Mock回调函数
const mockOnAnalysisComplete = jest.fn();

describe('SSADataFlowAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('应该正确渲染组件', () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    expect(screen.getByText('🔍 SSA数据流分析')).toBeInTheDocument();
    expect(screen.getByText('使用静态单赋值技术分析代码的数据流和控制流')).toBeInTheDocument();
    expect(screen.getByText('分析类型：')).toBeInTheDocument();
    expect(screen.getByText('开始SSA分析')).toBeInTheDocument();
  });

  test('应该显示分析类型选择器', () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('basic');

    // 检查选项
    expect(select).toHaveDisplayValue('基础分析');
  });

  test('当没有选择节点时应该禁用分析按钮', () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={[]}
        selectedCallChains={[]}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const analyzeButton = screen.getByText('开始SSA分析');
    expect(analyzeButton).toBeDisabled();
  });

  test('当有选择节点时应该启用分析按钮', () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const analyzeButton = screen.getByText('开始SSA分析');
    expect(analyzeButton).not.toBeDisabled();
  });

  test('点击分析按钮应该开始分析过程', async () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const analyzeButton = screen.getByText('开始SSA分析');
    fireEvent.click(analyzeButton);

    // 应该显示进度条
    expect(screen.getByText('分析中...')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();

    // 等待分析完成
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    }, { timeout: 3000 });

    // 应该调用回调函数
    expect(mockOnAnalysisComplete).toHaveBeenCalledTimes(1);
    expect(mockOnAnalysisComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.any(Map),
        basicBlocks: expect.any(Map),
        controlFlow: expect.any(Array),
        dataFlow: expect.any(Array),
        phiNodes: expect.any(Array)
      }),
      expect.objectContaining({
        reachingDefinitions: expect.any(Map),
        liveVariables: expect.any(Map),
        availableExpressions: expect.any(Map),
        constantPropagation: expect.any(Map),
        copyPropagation: expect.any(Map)
      })
    );
  });

  test('分析完成后应该显示结果', async () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const analyzeButton = screen.getByText('开始SSA分析');
    fireEvent.click(analyzeButton);

    // 等待分析完成
    await waitFor(() => {
      expect(screen.getByText('分析结果')).toBeInTheDocument();
    }, { timeout: 3000 });

    // 应该显示各个结果部分
    expect(screen.getByText('变量信息')).toBeInTheDocument();
    expect(screen.getByText('基本块')).toBeInTheDocument();
    expect(screen.getByText('数据流分析')).toBeInTheDocument();
    expect(screen.getByText('优化建议')).toBeInTheDocument();
    expect(screen.getByText('数据流图')).toBeInTheDocument();
  });

  test('应该显示SSA技术说明', () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    expect(screen.getByText('SSA技术说明')).toBeInTheDocument();
    expect(screen.getByText(/静态单赋值 \(SSA\)/)).toBeInTheDocument();
    expect(screen.getByText(/到达定义分析/)).toBeInTheDocument();
    expect(screen.getByText(/活跃变量分析/)).toBeInTheDocument();
    expect(screen.getByText(/可用表达式分析/)).toBeInTheDocument();
    expect(screen.getByText(/常量传播/)).toBeInTheDocument();
    expect(screen.getByText(/复制传播/)).toBeInTheDocument();
  });

  test('应该支持复制Mermaid代码', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn()
      }
    });

    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const analyzeButton = screen.getByText('开始SSA分析');
    fireEvent.click(analyzeButton);

    // 等待分析完成
    await waitFor(() => {
      expect(screen.getByText('复制Mermaid代码')).toBeInTheDocument();
    }, { timeout: 3000 });

    const copyButton = screen.getByText('复制Mermaid代码');
    fireEvent.click(copyButton);

    // 应该调用clipboard API
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  test('应该显示错误信息当分析失败时', async () => {
    // Mock一个会失败的函数
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = jest.fn((callback) => {
      callback();
      return 1 as any;
    });

    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const analyzeButton = screen.getByText('开始SSA分析');
    fireEvent.click(analyzeButton);

    // 等待错误显示
    await waitFor(() => {
      expect(screen.getByText(/SSA分析失败/)).toBeInTheDocument();
    }, { timeout: 1000 });

    // 恢复原始setTimeout
    global.setTimeout = originalSetTimeout;
  });

  test('应该支持不同的分析类型', () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const select = screen.getByRole('combobox');
    
    // 选择高级分析
    fireEvent.change(select, { target: { value: 'advanced' } });
    expect(select).toHaveValue('advanced');

    // 选择完整分析
    fireEvent.change(select, { target: { value: 'full' } });
    expect(select).toHaveValue('full');
  });

  test('应该显示进度条和进度文本', async () => {
    render(
      <SSADataFlowAnalyzer
        selectedNodes={mockSelectedNodes}
        selectedCallChains={mockSelectedCallChains}
        onAnalysisComplete={mockOnAnalysisComplete}
      />
    );

    const analyzeButton = screen.getByText('开始SSA分析');
    fireEvent.click(analyzeButton);

    // 应该显示进度条
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();

    // 等待进度更新
    await waitFor(() => {
      expect(screen.getByText('10%')).toBeInTheDocument();
    }, { timeout: 1000 });

    await waitFor(() => {
      expect(screen.getByText('20%')).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});



