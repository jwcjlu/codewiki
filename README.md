# CodeWiki

一个基于 Go/AST 的代码关系分析服务。支持仓库管理、包/文件与实体关系抽取、函数调用链分析（包含链式调用，如 `GetRepo().Analyzer()` 以及 `a, err := GetRepo().Analyzer()`）并通过 HTTP API 对外提供查询能力。

## 功能特性

- 仓库管理：创建、查询、删除仓库，并触发分析
- 代码结构建模：实体（结构体/接口/变量/常量）、字段、方法与继承关系
- 调用链分析：解析函数调用关系，支持包级函数、方法调用、字段方法以及链式调用
- 包/文件树：按仓库输出包/文件树便于可视化
- OpenAPI/Swagger：自动生成 OpenAPI 文档

## 快速开始

### 环境要求

- Go 1.24+
- protoc 以及相关插件（参考下文 Makefile 指令）
- MySQL 8.0+（持久化 repo 元数据）
- Neo4j 5.x（持久化/查询关系图）

### 配置

修改或确认 `configs/config.yaml`：

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

> Windows 下默认启动参数中的 `-conf` 指向本地 `configs` 目录，可通过命令行覆盖。

### 初始化与构建

```bash
# 安装依赖、代码生成工具
make init

# 生成 API 代码（pb/http/grpc/validate/openapi）
make api

# 生成内部配置 pb
make config

# 其他生成动作（go generate / mod tidy）
make generate

# 编译
make build
```

### 运行

```bash
# 方式一：二进制
./bin/codewiki -conf ./configs

# 方式二：本地运行
go run ./cmd/codewiki -conf ./configs
```

## HTTP API（节选）

OpenAPI 文档见 `api/openapi.yaml`。主要接口如下：

- GET `/v1/api/repos`：仓库列表
- POST `/v1/api/repos`：创建仓库
- GET `/v1/api/repos/{id}`：仓库详情
- DELETE `/v1/api/repos/{id}`：删除仓库
- POST `/v1/api/repos/{id}/analyze`：按仓库触发分析
- GET `/v1/api/repos/{id}/tree`：仓库包/文件树
- GET `/v1/api/functions/{startFunctionName}/calls`：函数调用链分析

### 示例 curl

```bash
# 创建仓库
curl -X POST http://localhost:8000/v1/api/repos \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"demo",
    "repoType":1,
    "path":"D:/workspace/golang/demo",
    "description":"demo repo",
    "excludes":["**/vendor/**"],
    "language":1
  }'

# 触发分析
curl -X POST http://localhost:8000/v1/api/repos/<id>/analyze -H 'Content-Type: application/json' -d '{"id":"<id>"}'

# 查询调用链（从某个函数名出发）
curl http://localhost:8000/v1/api/functions/StartFunc/calls
```

## 架构与实现概览

- 框架：`kratos` 提供应用骨架与 HTTP 服务
- 配置：`internal/conf`（`conf.proto` -> pb）+ `configs/config.yaml`
- 数据层：MySQL（仓库等元数据）、Neo4j（关系图）
- 业务层：`internal/biz` 使用 `go/ast` 解析代码结构与关系
  - `RelationAnalyzer` 抽取类型、字段、方法、继承与调用关系
  - 支持链式调用的解析（如 `GetRepo().Analyzer()`、`a, err := GetRepo().Analyzer()`）

## 开发指南

```bash
# 重新生成 API 代码
make api

# 重新生成内部配置 pb
make config

# 生成 wire（如有依赖注入改动）
(cd cmd/codewiki && wire)

# 一键生成
make all
```

## Docker

```bash
# 构建镜像
docker build -t codewiki:latest .

# 运行（将本地配置目录挂载到容器内 /data/conf）
docker run --rm -p 8000:8000 -p 9000:9000 \
  -v $(pwd)/configs:/data/conf codewiki:latest
```

## 目录结构（简要）

- `api/`：proto 与生成的 http/grpc/openapi
- `cmd/codewiki/`：应用入口、依赖注入（wire）
- `configs/`：配置文件
- `internal/`：业务实现（conf、biz、data、server、service 等）
- `documents/`：图数据库等相关脚本

## 许可

本项目遵循 `LICENSE` 中所述的许可协议。

—

基于 Kratos 构建，感谢开源社区。