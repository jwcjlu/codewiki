# CodeWiki - 智能代码关系分析平台

CodeWiki 是一个基于 Go/AST 的智能代码关系分析平台，提供代码仓库管理、函数调用链分析、代码结构可视化等功能。该平台采用前后端分离架构，后端使用 Go 语言构建，前端使用 React + TypeScript 实现。

## 🚀 核心功能

### 后端服务 (Go)
- **代码仓库管理**: 支持本地和GitHub仓库的创建、删除、分析
- **AST代码解析**: 基于Go标准库`go/ast`进行代码结构分析
- **关系图构建**: 自动构建函数调用链、类型继承关系等
- **多语言支持**: 支持Golang、Java、Python、Rust等编程语言
- **图数据库存储**: 使用Neo4j存储代码关系图，MySQL存储元数据

### 前端应用 (React)
- **仓库管理界面**: 直观的仓库CRUD操作
- **代码树视图**: 层次化的包/文件结构展示
- **代码查看器**: 语法高亮、函数识别
- **调用链可视化**: 交互式函数调用关系图
- **节点详情面板**: 显示函数、类型、文件等详细信息

## 🏗️ 技术架构

### 后端技术栈
- **框架**: [Kratos](https://github.com/go-kratos/kratos) - Go微服务框架
- **数据库**: MySQL 8.0+ (元数据), Neo4j 5.x (关系图)
- **代码解析**: Go标准库 `go/ast`
- **API**: gRPC + HTTP (RESTful)
- **配置管理**: Protocol Buffers + YAML
- **依赖注入**: Google Wire

### 前端技术栈
- **框架**: React 18 + TypeScript
- **图形渲染**: SVG + Canvas
- **状态管理**: React Hooks
- **样式**: CSS-in-JS
- **构建工具**: Create React App

## 📦 项目结构

```
codewiki/
├── api/                    # API定义和生成的代码
│   ├── codewiki/          # 主要API接口
│   └── openapi.yaml       # OpenAPI文档
├── cmd/codewiki/          # 应用入口点
├── configs/               # 配置文件
├── internal/              # 内部实现
│   ├── biz/              # 业务逻辑层
│   ├── data/             # 数据访问层
│   ├── server/           # 服务层
│   └── service/          # 服务接口层
├── web/                  # 前端React应用
│   ├── src/
│   │   ├── components/   # React组件
│   │   ├── services/     # API服务
│   │   ├── types/        # TypeScript类型定义
│   │   └── utils/        # 工具函数
│   └── package.json
├── third_party/          # 第三方依赖
├── go.mod               # Go模块定义
└── Makefile             # 构建脚本
```

## 🚀 快速开始

### 环境要求

- **Go**: 1.24+
- **Node.js**: 16+
- **MySQL**: 8.0+
- **Neo4j**: 5.x
- **protoc**: Protocol Buffers编译器

### 1. 克隆项目

```bash
git clone <repository-url>
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
    source: root:123456@tcp(127.0.0.1:33060)/codewiki?parseTime=True
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
```

## 🔍 核心特性详解

### 代码关系分析

- **函数调用**: 解析函数间的调用关系，支持链式调用
- **类型关系**: 分析结构体、接口的继承和实现关系
- **包依赖**: 追踪包之间的导入和依赖关系
- **作用域分析**: 识别私有、包级、公共等不同作用域

### 可视化引擎

- **SVG渲染**: 使用SVG实现高质量的图形渲染
- **交互式操作**: 支持拖拽、缩放、点击等交互
- **自适应布局**: 智能计算节点位置，保持层级间距一致
- **实时更新**: 动态响应数据变化，实时更新视图

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目遵循 `LICENSE` 中所述的许可协议。

## 🙏 致谢

- [Kratos](https://github.com/go-kratos/kratos) - Go微服务框架
- [Neo4j](https://neo4j.com/) - 图数据库
- [React](https://reactjs.org/) - 前端框架
- 开源社区的支持和贡献

---

**CodeWiki** - 让代码关系分析变得简单直观 🚀