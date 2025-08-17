# CodeWiki - 智能代码仓库分析系统

[![Go Version](https://img.shields.io/badge/Go-1.24+-blue.svg)](https://golang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Kratos](https://img.shields.io/badge/Kratos-v2.7.3-blue.svg)](https://github.com/go-kratos/kratos)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org)

CodeWiki是一个基于Go语言和React的智能代码仓库分析系统，能够自动解析代码结构、分析函数调用关系，并提供可视化的代码探索体验。

## 🚀 快速开始

### 使用Docker快速体验
```bash
# 克隆项目
git clone https://github.com/your-username/codewiki.git
cd codewiki

# 启动服务
docker-compose up -d

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
make build && ./bin/codewiki -conf ./configs

# 5. 启动前端
cd web && npm install && npm start
```

## 🚀 主要特性

### 🔍 代码仓库管理
- **多语言支持**: 支持Go、Java、Python、Rust等多种编程语言
- **智能解析**: 自动分析代码结构、包依赖、文件关系
- **仓库类型**: 支持本地仓库和GitHub远程仓库
- **批量操作**: 支持批量导入和分析多个仓库

### 📊 代码结构分析
- **包结构可视化**: 树形展示包和文件的层次结构
- **依赖关系图**: 可视化展示模块间的依赖关系
- **代码导航**: 快速定位和浏览代码文件

### 🕸️ 函数调用图分析
- **调用链追踪**: 自动识别函数调用关系
- **交互式图表**: 支持拖拽、缩放、展开/折叠操作
- **实时分析**: 点击函数名即可查看调用关系图
- **节点详情**: 显示函数签名、调用次数等详细信息

### 🤖 AI智能问答
- **自然语言提问**: 支持用自然语言描述代码相关问题
- **智能回答**: 基于代码库内容的AI智能回答
- **多场景支持**: 代码逻辑解释、最佳实践建议、架构设计理解
- **实时交互**: 快速获得准确的代码相关答案

### 🎨 现代化Web界面
- **响应式设计**: 支持桌面和移动设备
- **语法高亮**: 支持多种编程语言的代码高亮
- **实时搜索**: 快速查找文件和函数
- **多标签页**: 同时查看多个仓库或分析结果

## 🤖 AI智能问答功能详解

### 功能概述
CodeWiki的AI问答功能是一个基于人工智能的代码理解助手，能够帮助开发者快速理解代码逻辑、架构设计和最佳实践。

### 核心特性
- **🎯 智能理解**: AI能够理解代码的语义和结构，提供准确的回答
- **💬 自然交互**: 支持自然语言提问，无需记忆复杂的查询语法
- **📚 知识丰富**: 基于整个代码库进行分析，提供全面的上下文信息
- **⚡ 实时响应**: 快速获得答案，支持连续对话和深入探讨

### 适用场景
1. **代码理解**: 快速理解函数作用、模块功能和架构设计
2. **最佳实践**: 获取代码优化建议和设计模式推荐
3. **问题诊断**: 分析代码问题，提供解决方案
4. **学习指导**: 帮助新手理解复杂代码结构和设计思路

### 提问技巧
- **具体描述**: 详细描述你的问题，如"如何实现用户登录验证？"
- **上下文提供**: 提及相关的函数名或模块名，帮助AI更准确理解
- **目标明确**: 说明你想要达到的目标，如"如何优化这个查询的性能？"
- **分步提问**: 复杂问题可以分解为多个简单问题逐步理解

## 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   HTTP Server   │    │   gRPC Server   │
│   (React/TS)    │◄──►│   (Kratos)      │◄──►│   (Kratos)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Business Logic │    │   Data Layer    │
                       │   (Biz Layer)   │    │  (MySQL+Neo4j)  │
                       └─────────────────┘    └─────────────────┘
```

### 技术栈

**后端 (Go)**
- **框架**: [Kratos v2](https://github.com/go-kratos/kratos) - 微服务框架
- **数据库**: MySQL (关系数据) + Neo4j (图数据)
- **API**: gRPC + HTTP RESTful
- **代码生成**: Protocol Buffers + Wire依赖注入
- **并发处理**: Ants协程池

**前端 (React)**
- **框架**: React 18 + TypeScript
- **构建工具**: Create React App
- **图表库**: 自定义SVG图形渲染
- **语法高亮**: Prism.js
- **状态管理**: React Hooks

## 📦 安装部署

### 环境要求

- **Go**: 1.24+
- **Node.js**: 16+
- **MySQL**: 8.0+
- **Neo4j**: 5.0+
- **Git**: 最新版本

### 1. 克隆项目

```bash
git clone https://github.com/your-username/codewiki.git
cd codewiki
```

### 2. 后端设置

#### 安装Go依赖和工具
```bash
make init
```

#### 配置数据库
编辑 `configs/config.yaml`:
```yaml
server:
  http:
    addr: 0.0.0.0:8000
    timeout: 1s
  grpc:
    addr: 0.0.0.0:9000
    timeout: 1s

data:
  neo4j:
    target: bolt://127.0.0.1:7687
    username: neo4j
    password: <your-password>
  database:
    driver: mysql
    source: root:123456@tcp(127.0.0.1:3306)/codewiki?parseTime=True
```

#### 生成代码和构建
```bash
# 生成所有代码
make all

# 构建二进制文件
make build

# 运行服务
./bin/codewiki -conf ./configs
```

### 3. 前端设置

```bash
cd web
npm install
npm start
```

前端将在 http://localhost:3000 启动

## 📚 使用指南

### 创建并分析代码仓库

1. **创建仓库**: 在Web界面中填写仓库信息（名称、路径、类型等）
2. **触发分析**: 点击"分析"按钮，系统将自动解析代码结构
3. **查看结果**: 分析完成后可查看包结构、文件树、函数调用关系

### 探索代码关系

1. **查看文件树**: 点击"查看树"按钮浏览仓库结构
2. **阅读代码**: 点击文件名查看代码内容，支持语法高亮
3. **分析调用链**: 点击函数名查看调用关系图
4. **交互式探索**: 在调用图中拖拽节点、展开/折叠、查看详情

### AI智能问答

1. **选择仓库**: 在左侧仓库列表中选择要提问的代码仓库
2. **切换到问答**: 点击"AI问答"标签页进入问答界面
3. **自然语言提问**: 用自然语言描述你的问题，例如：
   - "如何实现用户登录验证？"
   - "这个函数的作用是什么？"
   - "如何优化数据库查询性能？"
   - "这个模块的设计思路是什么？"
4. **获得答案**: AI会基于代码库内容提供准确的回答
5. **继续提问**: 可以继续提问其他相关问题，深入理解代码

### 调用图操作

- **拖拽节点**: 调整节点位置
- **点击节点**: 查看详细信息
- **展开/折叠**: 显示/隐藏子节点
- **缩放平移**: 使用鼠标滚轮和拖拽画布
- **重置视图**: 恢复默认布局

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
```

## 🐳 Docker部署

### 构建镜像
```bash
docker build -t codewiki:latest .
```

### 运行容器
```bash
docker run --rm -p 8000:8000 -p 9000:9000 \
  -v $(pwd)/configs:/data/conf codewiki:latest
```

## 📊 API接口

主要HTTP接口（完整文档见 `api/openapi.yaml`）:

- `GET /v1/api/repos` - 获取仓库列表
- `POST /v1/api/repos` - 创建新仓库
- `GET /v1/api/repos/{id}` - 获取仓库详情
- `DELETE /v1/api/repos/{id}` - 删除仓库
- `POST /v1/api/repos/{id}/analyze` - 触发代码分析
- `GET /v1/api/repos/{id}/tree` - 获取仓库结构树
- `GET /v1/api/functions/{name}/calls` - 查询函数调用链
- `GET /v1/api/project/{id}/answer` - AI智能问答

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
    "language": 1
  }'

# 分析仓库
curl -X POST http://localhost:8000/v1/api/repos/{id}/analyze

# 查询调用链
curl http://localhost:8000/v1/api/functions/main/calls

# AI问答
curl "http://localhost:8000/v1/api/project/{id}/answer?question=如何实现用户认证"
```

## 🗂️ 项目结构

```
codewiki/
├── api/                    # API定义和生成的代码
│   ├── codewiki/          # 主要API接口
│   └── openapi.yaml       # OpenAPI规范文档
├── cmd/                    # 应用程序入口
│   └── codewiki/          # 主程序
├── configs/                # 配置文件
├── internal/               # 内部包
│   ├── biz/               # 业务逻辑层
│   ├── conf/              # 配置结构
│   ├── data/              # 数据访问层
│   ├── pkg/               # 公共包
│   └── server/            # 服务器实现
├── web/                    # 前端React应用
│   ├── src/
│   │   ├── components/    # React组件
│   │   ├── services/      # API服务
│   │   └── types/         # TypeScript类型定义
│   └── package.json
├── third_party/            # 第三方依赖
├── Dockerfile              # Docker构建文件
├── Makefile                # 构建脚本
└── README.md               # 项目文档
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看以下指南：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Kratos](https://github.com/go-kratos/kratos) - Go微服务框架
- [Neo4j](https://neo4j.com/) - 图数据库
- [React](https://reactjs.org/) - 前端框架
- [Ants](https://github.com/panjf2000/ants) - Go协程池

## 📞 联系我们

- 项目主页: [GitHub Repository](https://github.com/your-username/codewiki)
- 问题反馈: [Issues](https://github.com/your-username/codewiki/issues)
- 讨论交流: [Discussions](https://github.com/your-username/codewiki/discussions)

---

⭐ 如果这个项目对你有帮助，请给我们一个星标！