# CodeWiki - 智能代码仓库分析系统

[![Go Version](https://img.shields.io/badge/Go-1.24+-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Kratos](https://img.shields.io/badge/Kratos-v2.7.3-blue.svg)](https://github.com/go-kratos/kratos)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org)
[![Milvus](https://img.shields.io/badge/Milvus-2.5.6-green.svg)](https://milvus.io)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.15-blue.svg)](https://neo4j.com)

CodeWiki是一个基于Go语言和React的智能代码仓库分析系统，能够自动解析代码结构、分析函数调用关系，并提供基于AI的智能代码问答功能。系统集成了向量数据库、图数据库和大型语言模型，为开发者提供全方位的代码理解体验。

## 🚀 核心特性

### 🔍 智能代码分析
- **多语言支持**: 支持Go、Java、Python、Rust等多种编程语言
- **AST解析**: 基于抽象语法树的深度代码结构分析
- **关系挖掘**: 自动识别函数调用、依赖关系、继承结构
- **向量化存储**: 使用Milvus向量数据库存储代码语义向量

### 🕸️ 可视化调用图
- **交互式图表**: 支持拖拽、缩放、展开/折叠操作
- **实时分析**: 点击函数名即可查看调用关系图
- **节点详情**: 显示函数签名、调用次数、文件位置等详细信息
- **多维度视图**: 支持树状布局、层次结构等多种展示方式

### 🤖 AI智能问答
- **自然语言交互**: 支持用自然语言描述代码相关问题
- **上下文理解**: 基于整个代码库的语义分析
- **流式响应**: 实时显示AI思考过程和答案生成
- **深度思考**: 模拟DeepSeek的深度思考过程，提供更准确的回答

### 📊 现代化Web界面
- **响应式设计**: 支持桌面和移动设备
- **主题切换**: 支持明暗主题模式切换
- **语法高亮**: 支持多种编程语言的代码高亮
- **实时搜索**: 快速查找文件和函数

## 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   HTTP Server   │    │   gRPC Server   │
│   (React/TS)    │◄──►│   (Kratos)      │◄──►│   (Kratos)      │
│                 │    │   Port: 8000    │    │   Port: 9000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Business Logic │    │   Data Layer    │
                       │   (Biz Layer)   │    │  (Multi-DB)     │
                       │                 │    │                 │
                       │ • Code Analysis │    │ • MySQL         │
                       │ • LLM Engine    │    │ • Neo4j         │
                       │ • Vector Search │    │ • Milvus        │
                       └─────────────────┘    └─────────────────┘
```

### 技术栈详解

**后端 (Go)**
- **框架**: [Kratos v2](https://github.com/go-kratos/kratos) - 微服务框架
- **数据库**: MySQL (关系数据) + Neo4j (图数据) + Milvus (向量数据)
- **AI集成**: OpenAI API + 自定义流式处理
- **API**: gRPC + HTTP RESTful + Server-Sent Events (SSE)
- **代码生成**: Protocol Buffers + Wire依赖注入
- **并发处理**: Ants协程池 + 异步流式处理

**前端 (React)**
- **框架**: React 18 + TypeScript + Hooks
- **构建工具**: Create React App
- **图表库**: 自定义SVG图形渲染 + Mermaid图表
- **语法高亮**: Prism.js
- **状态管理**: React Hooks + Context
- **流式通信**: EventSource (SSE) + Fetch API

**数据存储**
- **MySQL**: 代码仓库元数据、分析结果、用户配置
- **Neo4j**: 代码结构关系、函数调用图、依赖关系
- **Milvus**: 代码语义向量、相似性搜索、AI问答上下文

## 🚀 快速开始

### 使用Docker快速体验
```bash
# 克隆项目
git clone https://github.com/your-username/codewiki.git
cd codewiki

# 启动所有服务
docker-compose up -d

# 等待服务启动完成（约2-3分钟）
# 访问Web界面
open http://localhost:3000

# 体验AI问答功能
# 1. 创建或选择一个代码仓库
# 2. 点击"AI问答"标签页
# 3. 输入问题，如"如何实现用户认证？"
# 4. 获得AI智能回答
```

### 手动安装
```bash
# 1. 安装依赖
make init

# 2. 配置数据库
# 编辑 configs/config.yaml

# 3. 生成代码
make all

# 4. 启动后端
make build && ./bin/server -conf ./configs

# 5. 启动前端
cd web && npm install && npm start
```

## 📦 环境要求

- **Go**: 1.24+
- **Node.js**: 16+
- **MySQL**: 8.0+
- **Neo4j**: 5.15+
- **Milvus**: 2.5+
- **Git**: 最新版本

## 🔧 配置说明

### 后端配置
编辑 `configs/config.yaml`:
```yaml
server:
  http:
    addr: 0.0.0.0:8000
    timeout: 1s
    middleware:
      - recovery
      - cors
      - logging
      - metrics
  grpc:
    addr: 0.0.0.0:9000
    timeout: 1s

data:
  database:
    driver: mysql
    source: "root:123456@tcp(127.0.0.1:3306)/codewiki?parseTime=True&charset=utf8mb4"
    max_idle_conns: 10
    max_open_conns: 100
  
  neo4j:
    target: bolt://127.0.0.1:7687
    username: neo4j
    password: "123456"
  
  milvus:
    target: "127.0.0.1:19530"
    username: ""
    password: ""

llm:
  api_key: "your-openai-api-key"
  base_url: "https://api.openai.com/v1"
  model: "gpt-3.5-turbo"
```

### 前端配置
编辑 `web/.env`:
```bash
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_GRPC_BASE_URL=http://localhost:9000
```

## 📚 使用指南

### 1. 代码仓库管理
```bash
# 创建本地仓库
POST /v1/api/repos
{
  "name": "my-project",
  "repoType": 0,  // 0: 本地, 1: GitHub
  "path": "/path/to/project",
  "language": "Golang"
}

# 分析代码仓库
POST /v1/api/repos/{id}/analyze
```

### 2. 代码结构探索
- **包结构**: 树形展示包和文件的层次结构
- **文件内容**: 语法高亮的代码查看器
- **函数导航**: 快速定位和浏览代码函数

### 3. 调用图分析
- **交互式图表**: 拖拽、缩放、展开/折叠
- **实时分析**: 点击函数名查看调用关系
- **节点详情**: 函数签名、调用次数、文件位置

### 4. AI智能问答
```bash
# 流式问答接口
GET /v1/api/project/{id}/answer?question=如何实现用户认证

# 支持的问题类型：
# - 代码功能解释
# - 架构设计理解
# - 最佳实践建议
# - 问题诊断分析
# - 技术选型指导
```

## 🔍 核心功能详解

### AI智能问答系统

#### 技术架构
- **向量化存储**: 使用Milvus存储代码片段的语义向量
- **相似性搜索**: 基于向量相似度找到相关代码片段
- **上下文构建**: 将相关代码片段作为上下文提供给LLM
- **流式响应**: 使用SSE实现实时答案生成

#### 工作流程
1. **问题接收**: 接收用户的自然语言问题
2. **向量搜索**: 在Milvus中搜索相似的代码片段
3. **上下文构建**: 将相关代码片段组合成上下文
4. **LLM调用**: 调用OpenAI API生成答案
5. **流式返回**: 实时返回AI的思考过程和答案

#### 特色功能
- **深度思考**: 模拟DeepSeek的思考过程，提供更准确的回答
- **代码理解**: 基于AST分析的深度代码理解
- **多语言支持**: 支持Go、Java、Python、Rust等多种语言
- **实时交互**: 支持连续对话和深入探讨

### 代码分析引擎

#### AST解析
- **语法树构建**: 基于Go标准库的AST解析
- **语义提取**: 提取函数、类、接口、变量等语义信息
- **关系分析**: 分析调用关系、依赖关系、继承关系

#### 图数据库存储
- **Neo4j图模型**: 使用Cypher查询语言
- **关系建模**: 函数调用、文件依赖、包关系
- **查询优化**: 支持复杂的关系查询和路径分析

#### 向量化存储
- **Milvus集成**: 使用Milvus v2客户端
- **语义向量**: 代码片段的语义表示
- **相似性搜索**: 基于向量的快速相似性搜索

## 🐳 Docker部署

### 完整部署
```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f codewiki-backend
```

### 服务端口
- **前端**: http://localhost:3000
- **后端HTTP**: http://localhost:8000
- **后端gRPC**: localhost:9000
- **MySQL**: localhost:3306
- **Neo4j**: localhost:7474 (HTTP), localhost:7687 (Bolt)
- **Milvus**: localhost:19530

## 🔧 开发指南

### 代码生成
```bash
# 生成API代码
make api

# 生成内部配置
make config

# 生成依赖注入代码
(cd cmd/codewiki && wire)

# 一键生成所有
make all
```

### 添加新功能
1. **后端**: 在`internal/`目录下添加新的业务逻辑
2. **前端**: 在`web/src/components/`下创建新的React组件
3. **API**: 修改`api/`下的proto文件，重新生成代码

### 测试
```bash
# 后端测试
go test ./...

# 前端测试
cd web
npm test

# 集成测试
go test -tags=integration ./...
```

## 📊 API接口

### 主要HTTP接口
- `GET /v1/api/repos` - 获取仓库列表
- `POST /v1/api/repos` - 创建新仓库
- `GET /v1/api/repos/{id}` - 获取仓库详情
- `DELETE /v1/api/repos/{id}` - 删除仓库
- `POST /v1/api/repos/{id}/analyze` - 触发代码分析
- `GET /v1/api/repos/{id}/tree` - 获取仓库结构树
- `GET /v1/api/functions/{name}/calls` - 查询函数调用链
- `GET /v1/api/project/{id}/answer` - AI智能问答 (SSE流式)

### 示例请求
```bash
# 创建仓库
curl -X POST http://localhost:8000/v1/api/repos \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "my-project",
    "repoType": 0,
    "path": "/path/to/project",
    "description": "My Go project",
    "language": "Golang"
  }'

# AI问答 (SSE流式)
curl -N "http://localhost:8000/v1/api/project/{id}/answer?question=如何实现用户认证"
```

## 🗂️ 项目结构

```
codewiki/
├── api/                    # API定义和生成的代码
│   ├── codewiki/v1/       # 主要API接口
│   │   ├── codewiki.proto # 核心服务定义
│   │   └── *.pb.go        # 生成的Go代码
│   └── openapi.yaml       # OpenAPI规范文档
├── cmd/                    # 应用程序入口
│   └── codewiki/          # 主程序
├── configs/                # 配置文件
├── internal/               # 内部包
│   ├── biz/               # 业务逻辑层
│   │   ├── engine.go      # AI问答引擎
│   │   ├── indexer.go     # 代码索引器
│   │   └── relation_analyzer.go # 关系分析器
│   ├── conf/              # 配置结构
│   ├── data/              # 数据访问层
│   │   └── repo/          # 数据仓库实现
│   ├── pkg/               # 公共包
│   │   ├── llm/           # LLM集成
│   │   ├── pool/          # 协程池管理
│   │   └── localcache/    # 本地缓存
│   └── server/            # 服务器实现
│       ├── http.go        # HTTP服务器
│       └── grpc.go        # gRPC服务器
├── web/                    # 前端React应用
│   ├── src/
│   │   ├── components/    # React组件
│   │   │   ├── CodeSearch.tsx    # AI问答组件
│   │   │   ├── CallGraph.tsx     # 调用图组件
│   │   │   └── CodeViewer.tsx    # 代码查看器
│   │   ├── services/      # API服务
│   │   └── types/         # TypeScript类型定义
│   └── package.json
├── third_party/            # 第三方依赖
├── documents/              # 数据库初始化脚本
├── Dockerfile              # Docker构建文件
├── docker-compose.yml      # Docker编排文件
├── Makefile                # 构建脚本
└── README.md               # 项目文档
```

## 🚀 性能特性

### 后端性能
- **协程池**: 使用Ants协程池管理并发
- **连接池**: MySQL和Neo4j连接池优化
- **批量操作**: 支持大批量数据的导入和更新
- **异步处理**: 流式处理和异步响应

### 前端性能
- **虚拟滚动**: 大列表的性能优化
- **懒加载**: 按需加载组件和数据
- **缓存策略**: 智能缓存和状态管理
- **流式更新**: 实时数据更新和UI响应

## 🔒 安全特性

- **CORS配置**: 灵活的跨域访问控制
- **输入验证**: 基于protobuf的请求参数验证
- **错误处理**: 统一的错误响应格式
- **日志记录**: 完整的操作日志和审计追踪

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看以下指南：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发环境设置
```bash
# 安装开发工具
make init

# 设置数据库
docker-compose up -d mysql neo4j

# 运行测试
go test ./...
cd web && npm test
```

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Kratos](https://github.com/go-kratos/kratos) - Go微服务框架
- [Neo4j](https://neo4j.com/) - 图数据库
- [Milvus](https://milvus.io/) - 向量数据库
- [React](https://reactjs.org/) - 前端框架
- [OpenAI](https://openai.com/) - AI语言模型
- [Ants](https://github.com/panjf2000/ants) - Go协程池

## 📞 联系我们

- 项目主页: [GitHub Repository](https://github.com/your-username/codewiki)
- 问题反馈: [Issues](https://github.com/your-username/codewiki/issues)
- 讨论交流: [Discussions](https://github.com/your-username/codewiki/discussions)

## 🎯 路线图

### 近期计划
- [ ] 支持更多编程语言 (C++, JavaScript, TypeScript)
- [ ] 增强AI问答的上下文理解能力
- [ ] 添加代码质量分析和建议功能
- [ ] 支持团队协作和权限管理

### 长期愿景
- [ ] 构建代码知识图谱
- [ ] 集成更多AI模型和工具
- [ ] 支持大规模企业级部署
- [ ] 开发移动端应用

---

⭐ 如果这个项目对你有帮助，请给我们一个星标！

**CodeWiki - 让代码理解变得简单而智能** 🚀