import { CallRelation, Function, Entity } from '../types';

// Mermaid图表类型
export type MermaidChartType = 'flowchart' | 'sequence' | 'class' | 'er' | 'gantt';

// 图表配置接口
export interface MermaidChartConfig {
  type: MermaidChartType;
  title: string;
  description?: string;
  theme?: 'default' | 'forest' | 'dark' | 'neutral';
  direction?: 'TB' | 'TD' | 'BT' | 'RL' | 'LR';
}

// 函数调用关系图生成器
export class FunctionCallGraphGenerator {
  private config: MermaidChartConfig;

  constructor(config: MermaidChartConfig) {
    this.config = {
      direction: 'TB',
      theme: 'default',
      ...config
    };
  }

  // 生成函数调用流程图
  generateFlowchart(callRelations: CallRelation[]): string {
    if (!callRelations || callRelations.length === 0) {
      return this.generateEmptyChart();
    }

    const nodes = new Set<string>();
    const edges = new Set<string>();
    const nodeLabels = new Map<string, string>();

    // 收集所有节点和边
    callRelations.forEach(relation => {
      const callerId = relation.callerId || relation.callerName;
      const calleeId = relation.calleeId || relation.calleeName;
      
      if (callerId && calleeId) {
        nodes.add(callerId);
        nodes.add(calleeId);
        
        // 生成节点标签
        if (!nodeLabels.has(callerId)) {
          nodeLabels.set(callerId, this.formatNodeLabel(relation.callerName, relation.callerFileId));
        }
        if (!nodeLabels.has(calleeId)) {
          nodeLabels.set(calleeId, this.formatNodeLabel(relation.calleeName, relation.calleeFileId));
        }
        
        // 生成边
        edges.add(`${callerId} --> ${calleeId}`);
      }
    });

    // 构建Mermaid代码
    let mermaidCode = `flowchart ${this.config.direction}\n`;
    
    // 添加节点定义
    nodes.forEach(nodeId => {
      const label = nodeLabels.get(nodeId) || nodeId;
      mermaidCode += `    ${nodeId}["${label}"]\n`;
    });
    
    // 添加边定义
    edges.forEach(edge => {
      mermaidCode += `    ${edge}\n`;
    });

    return mermaidCode;
  }

  // 生成类图
  generateClassDiagram(entities: Entity[]): string {
    if (!entities || entities.length === 0) {
      return this.generateEmptyChart();
    }

    let mermaidCode = `classDiagram\n`;
    
    entities.forEach(entity => {
      mermaidCode += `    class ${entity.name} {\n`;
      
      // 添加字段 - 使用实际的Entity属性
      if (entity.id) {
        mermaidCode += `        +String id\n`;
      }
      if (entity.name) {
        mermaidCode += `        +String name\n`;
      }
      if (entity.fileId) {
        mermaidCode += `        +String fileId\n`;
      }
      
      // 添加方法 - 使用实际的Entity属性
      if (entity.functions && entity.functions.length > 0) {
        entity.functions.forEach(func => {
          mermaidCode += `        +${func.name}()\n`;
        });
      } else {
        // 默认方法
        mermaidCode += `        +create()\n`;
        mermaidCode += `        +update()\n`;
        mermaidCode += `        +delete()\n`;
      }
      
      mermaidCode += `    }\n`;
    });

    return mermaidCode;
  }

  // 生成实体关系图
  generateEntityRelationshipDiagram(entities: Entity[]): string {
    if (!entities || entities.length === 0) {
      return this.generateEmptyChart();
    }

    let mermaidCode = `erDiagram\n`;
    
    entities.forEach(entity => {
      mermaidCode += `    ${entity.name} {\n`;
      mermaidCode += `        string id\n`;
      mermaidCode += `        string name\n`;
      mermaidCode += `        string type\n`;
      mermaidCode += `    }\n`;
    });

    return mermaidCode;
  }

  // 生成序列图
  generateSequenceDiagram(callRelations: CallRelation[]): string {
    if (!callRelations || callRelations.length === 0) {
      return this.generateEmptyChart();
    }

    const participants = new Set<string>();
    const messages: string[] = [];

    // 收集参与者和消息
    callRelations.forEach((relation, index) => {
      const caller = relation.callerName || relation.callerId;
      const callee = relation.calleeName || relation.calleeId;
      
      if (caller && callee) {
        participants.add(caller);
        participants.add(callee);
        messages.push(`${caller}->>${callee}: ${relation.calleeName || '调用'}`);
      }
    });

    let mermaidCode = `sequenceDiagram\n`;
    
    // 添加参与者
    participants.forEach(participant => {
      mermaidCode += `    participant ${participant}\n`;
    });
    
    // 添加消息
    messages.forEach(message => {
      mermaidCode += `    ${message}\n`;
    });

    return mermaidCode;
  }

  // 生成甘特图（用于显示代码分析的时间线）
  generateGanttChart(analysisSteps: Array<{ task: string; start: string; duration: string }>): string {
    if (!analysisSteps || analysisSteps.length === 0) {
      return this.generateEmptyChart();
    }

    let mermaidCode = `gantt\n`;
    mermaidCode += `    title 代码分析时间线\n`;
    mermaidCode += `    dateFormat  YYYY-MM-DD\n`;
    mermaidCode += `    section 分析阶段\n`;
    
    analysisSteps.forEach(step => {
      mermaidCode += `    ${step.task} :${step.start}, ${step.duration}\n`;
    });

    return mermaidCode;
  }

  // 生成空图表
  private generateEmptyChart(): string {
    return `flowchart TD
    A["暂无数据"] --> B["请先进行代码分析"]
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px`;
  }

  // 格式化节点标签
  private formatNodeLabel(name: string, fileId?: string): string {
    if (fileId) {
      const fileName = fileId.split('/').pop() || fileId;
      return `${name}\\n(${fileName})`;
    }
    return name;
  }
}

// 预定义的图表配置
export const CHART_CONFIGS = {
  FUNCTION_CALL: {
    type: 'flowchart' as MermaidChartType,
    title: '函数调用关系图',
    description: '展示函数之间的调用关系',
    theme: 'default' as const,
    direction: 'TB' as const
  },
  CLASS_DIAGRAM: {
    type: 'class' as MermaidChartType,
    title: '类结构图',
    description: '展示代码中的类、接口和结构体',
    theme: 'default' as const
  },
  ENTITY_RELATIONSHIP: {
    type: 'er' as MermaidChartType,
    title: '实体关系图',
    description: '展示代码实体之间的关系',
    theme: 'default' as const
  },
  SEQUENCE: {
    type: 'sequence' as MermaidChartType,
    title: '调用序列图',
    description: '展示函数调用的时序关系',
    theme: 'default' as const
  },
  ANALYSIS_TIMELINE: {
    type: 'gantt' as MermaidChartType,
    title: '分析时间线',
    description: '展示代码分析各阶段的时间',
    theme: 'default' as const
  }
};

// 工具函数：将调用关系转换为Mermaid图表
export function convertCallRelationsToMermaid(
  callRelations: CallRelation[],
  chartType: MermaidChartType = 'flowchart'
): string {
  const generator = new FunctionCallGraphGenerator({
    type: chartType,
    title: '函数调用关系图',
    description: '基于代码分析生成的函数调用关系'
  });

  switch (chartType) {
    case 'flowchart':
      return generator.generateFlowchart(callRelations);
    case 'sequence':
      return generator.generateSequenceDiagram(callRelations);
    case 'class':
      return generator.generateClassDiagram([]); // 需要实体数据
    case 'er':
      return generator.generateEntityRelationshipDiagram([]); // 需要实体数据
    case 'gantt':
      return generator.generateGanttChart([
        { task: '代码解析', start: '2024-01-01', duration: '1d' },
        { task: '关系分析', start: '2024-01-02', duration: '1d' },
        { task: '图表生成', start: '2024-01-03', duration: '1d' }
      ]);
    default:
      return generator.generateFlowchart(callRelations);
  }
}

// 工具函数：生成代码架构图
export function generateArchitectureDiagram(
  packages: Array<{ name: string; files: string[] }>,
  dependencies: Array<{ from: string; to: string }>
): string {
  let mermaidCode = `flowchart TD\n`;
  
  // 添加包节点
  packages.forEach(pkg => {
    mermaidCode += `    subgraph ${pkg.name}\n`;
    pkg.files.forEach(file => {
      const fileName = file.split('/').pop() || file;
      mermaidCode += `        ${fileName.replace(/[^a-zA-Z0-9]/g, '_')}["${fileName}"]\n`;
    });
    mermaidCode += `    end\n`;
  });
  
  // 添加依赖关系
  dependencies.forEach(dep => {
    mermaidCode += `    ${dep.from} --> ${dep.to}\n`;
  });

  return mermaidCode;
}

// 工具函数：生成代码质量分析图
export function generateQualityAnalysisChart(
  metrics: Array<{ name: string; value: number; max: number }>
): string {
  let mermaidCode = `pie title 代码质量指标\n`;
  
  metrics.forEach(metric => {
    const percentage = Math.round((metric.value / metric.max) * 100);
    mermaidCode += `    "${metric.name}: ${percentage}%" : ${percentage}\n`;
  });

  return mermaidCode;
}

// 工具函数：验证Mermaid语法
export function validateMermaidSyntax(mermaidCode: string): { isValid: boolean; error?: string } {
  try {
    // 这里可以添加更复杂的语法验证逻辑
    if (!mermaidCode.trim()) {
      return { isValid: false, error: 'Mermaid代码不能为空' };
    }
    
    // 检查基本的图表类型
    const validTypes = ['flowchart', 'sequenceDiagram', 'classDiagram', 'erDiagram', 'gantt', 'pie', 'gitgraph', 'journey', 'stateDiagram', 'userJourney'];
    const hasValidType = validTypes.some(type => mermaidCode.includes(type));
    
    if (!hasValidType) {
      return { isValid: false, error: '未找到有效的图表类型声明' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: error instanceof Error ? error.message : '未知错误' };
  }
}

// 工具函数：清理Mermaid代码
export function cleanMermaidCode(mermaidCode: string): string {
  return mermaidCode
    .trim()
    .replace(/\n\s*\n/g, '\n') // 移除多余的空行
    .replace(/\s+$/gm, ''); // 移除行尾空格
}

// 导出所有工具
export default {
  FunctionCallGraphGenerator,
  convertCallRelationsToMermaid,
  generateArchitectureDiagram,
  generateQualityAnalysisChart,
  validateMermaidSyntax,
  cleanMermaidCode,
  CHART_CONFIGS
};
