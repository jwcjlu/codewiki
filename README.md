# Kratos Project Template

## Install Kratos
```
go install github.com/go-kratos/kratos/cmd/kratos/v2@latest
```
## Create a service
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

