# 图表生成器组件

这是一个集成了文件函数选择器的完整图表生成解决方案，支持时序图和调用图，基于React和Mermaid构建。

## 🚀 功能特性

### 核心功能
- **智能文件搜索**: 支持文件名、函数名、路径的模糊搜索
- **多模式搜索**: 包含匹配、开头匹配、正则表达式
- **高级筛选**: 按文件类型、作用域、大小、复杂度等条件筛选
- **批量选择**: 支持全选/取消全选文件和函数
- **图表类型切换**: 支持时序图和调用图两种模式
- **自动生成**: 根据选择的组件自动生成对应类型的图表
- **多格式导出**: 支持SVG、PNG等格式导出

### 用户体验
- **搜索建议**: 智能提示，快速定位目标文件
- **响应式设计**: 完全适配移动端和桌面端
- **现代化UI**: Material Design风格，美观易用
- **实时反馈**: 即时显示选择状态和生成进度

## 📦 组件结构

```
SequenceDiagramGenerator/
├── SequenceDiagramGenerator.tsx    # 主组件
├── SequenceDiagramGenerator.css    # 样式文件
├── SequenceDiagramDemo.tsx         # 演示页面
├── SequenceDiagramDemo.css         # 演示页面样式
└── README.md                       # 说明文档
```

## 🛠️ 安装和配置

### 1. 安装依赖

```bash
npm install mermaid
# 或者
yarn add mermaid
```

### 2. 导入组件

```tsx
import SequenceDiagramGenerator from './components/SequenceDiagramGenerator';
```

### 3. 基本使用

```tsx
import React from 'react';
import SequenceDiagramGenerator from './SequenceDiagramGenerator';

const App: React.FC = () => {
  const handleGenerate = (config) => {
    console.log('生成的时序图配置:', config);
  };

  const handleExport = (format, data) => {
    console.log(`导出${format}格式:`, data);
  };

  return (
    <div>
      <h1>我的时序图生成器</h1>
      <SequenceDiagramGenerator
        onGenerate={handleGenerate}
        onExport={handleExport}
      />
    </div>
  );
};

export default App;
```

## 🔧 配置选项

### 接口定义

```tsx
interface SequenceDiagramGeneratorProps {
  onGenerate?: (config: SequenceDiagramConfig) => void;
  onExport?: (format: 'svg' | 'png' | 'pdf', data: string) => void;
}

interface SequenceDiagramConfig {
  title: string;
  description: string;
  participants: string[];
  messages: Array<{
    from: string;
    to: string;
    message: string;
    type?: 'request' | 'response' | 'note';
  }>;
}
```

### 回调函数

- **onGenerate**: 当时序图生成完成时调用
- **onExport**: 当图表导出时调用

## 📊 数据格式

### 文件信息

```tsx
interface FileInfo {
  id: string;                    // 唯一标识符
  name: string;                  // 文件名
  path: string;                  // 文件路径
  type: string;                  // 文件类型 (.go, .js等)
  scope: string;                 // 作用域 (controllers, models等)
  size?: number;                 // 文件大小 (KB)
  complexity?: 'low' | 'medium' | 'high';  // 复杂度
  lastModified?: string;         // 最后修改时间
  functions: string[];           // 函数列表
  description?: string;          // 描述信息
}
```

### 调用关系

```tsx
interface CallRelation {
  callerId: string;              // 调用者ID
  callerName: string;            // 调用者名称
  calleeId: string;              // 被调用者ID
  calleeName: string;            // 被调用者名称
  calleeFileId: string;          // 被调用者文件ID
  callerFileId: string;          // 调用者文件ID
  calleeScope: string;           // 被调用者作用域
  callerScope: string;           // 调用者作用域
  calleeEntityId: string;        // 被调用者实体ID
  callerEntityId: string;        // 调用者实体ID
}
```

## 🎯 使用场景

### 1. 时序图模式
- 分析函数调用时序
- 理解业务流程
- 制作API调用文档

### 2. 调用图模式
- 分析模块间的调用关系
- 理解系统架构设计
- 识别代码依赖关系

### 3. 文档生成
- 生成API调用流程图
- 创建系统架构文档
- 制作技术演示材料

### 3. 团队协作
- 新成员快速理解系统
- 代码审查和讨论
- 技术方案设计

### 4. 系统维护
- 影响分析
- 重构规划
- 性能优化

## 🔍 搜索和筛选

### 搜索模式

1. **包含匹配**: 搜索包含指定关键词的文件
2. **开头匹配**: 搜索以指定关键词开头的文件
3. **正则表达式**: 使用正则表达式进行高级搜索

### 筛选条件

- **文件类型**: .go, .js, .ts, .py, .java等
- **作用域**: controllers, models, services, dao等
- **文件大小**: 按KB范围筛选
- **复杂度**: low, medium, high
- **修改时间**: 最近1天、7天、30天、90天

## 🎨 自定义样式

### CSS变量

```css
:root {
  --primary-color: #4facfe;
  --secondary-color: #00f2fe;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --danger-color: #dc3545;
  --light-bg: #f8f9fa;
  --dark-text: #333;
  --border-radius: 15px;
}
```

### 主题定制

组件支持主题定制，可以通过CSS变量或覆盖样式类来实现：

```css
.sequence-diagram-generator {
  --primary-color: #your-color;
  --border-radius: 20px;
}
```

## 📱 响应式设计

### 断点设置

- **桌面端**: > 1200px
- **平板端**: 768px - 1200px
- **手机端**: < 768px

### 布局适配

- 网格布局自动调整列数
- 搜索框在小屏幕上垂直排列
- 按钮在小屏幕上全宽显示

## 🚀 性能优化

### 渲染优化

- 使用React.memo避免不必要的重渲染
- 防抖搜索，减少API调用
- 虚拟滚动支持大量数据

### 内存管理

- 及时清理事件监听器
- 优化状态更新逻辑
- 合理使用useCallback和useMemo

## 🔧 扩展开发

### 添加新的搜索模式

```tsx
// 在performSearch函数中添加新的搜索逻辑
case 'fuzzy':
  matchesSearch = fuzzySearch(file.name, searchTerm) || 
                  fuzzySearch(file.path, searchTerm);
  break;
```

### 添加新的筛选条件

```tsx
// 在筛选逻辑中添加新条件
const matchesCustom = !customFilter || file.customProperty === customFilter;
return matchesSearch && matchesType && matchesScope && matchesCustom;
```

### 自定义导出格式

```tsx
// 在exportDiagram函数中添加新格式支持
case 'pdf':
  const pdfData = await generatePDF(mermaidCode);
  if (onExport) {
    onExport('pdf', pdfData);
  }
  break;
```

## 🐛 故障排除

### 常见问题

1. **Mermaid图表不显示**
   - 检查mermaid库是否正确安装
   - 确认mermaid.initialize()已调用
   - 检查控制台是否有错误信息

2. **搜索无结果**
   - 检查搜索关键词是否正确
   - 确认筛选条件是否过于严格
   - 验证数据源是否正常

3. **样式显示异常**
   - 检查CSS文件是否正确导入
   - 确认没有样式冲突
   - 验证浏览器兼容性

### 调试模式

启用调试模式获取更多信息：

```tsx
// 在组件中添加调试信息
console.log('搜索条件:', { searchTerm, fileTypeFilter, scopeFilter });
console.log('筛选结果:', filteredFiles);
console.log('选择状态:', { selectedFiles, selectedFunctions });
```

## 📚 相关资源

- [Mermaid官方文档](https://mermaid-js.github.io/mermaid/)
- [React官方文档](https://reactjs.org/)
- [TypeScript官方文档](https://www.typescriptlang.org/)

## 🤝 贡献指南

欢迎提交Issue和Pull Request来改进这个组件！

### 开发环境设置

```bash
git clone <repository-url>
cd sequence-diagram-generator
npm install
npm start
```

### 代码规范

- 使用TypeScript进行类型检查
- 遵循ESLint规则
- 编写单元测试
- 保持代码注释完整

## 📄 许可证

MIT License - 详见LICENSE文件

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交GitHub Issue
- 发送邮件至: [your-email@example.com]
- 加入讨论群: [群号或链接]

---

**注意**: 这是一个演示版本，实际使用时需要根据具体需求进行定制和优化。
