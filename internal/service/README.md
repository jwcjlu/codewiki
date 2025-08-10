# Service Layer

## 概述

服务层是CodeWiki系统的API接口层，负责处理HTTP和gRPC请求，将外部请求转换为内部业务逻辑调用，并提供统一的错误处理和响应格式。

## 主要职责

- **请求处理**: 接收和验证HTTP/gRPC请求
- **参数转换**: 将请求参数转换为内部数据结构
- **业务调用**: 调用业务逻辑层处理具体业务
- **响应封装**: 统一格式化响应数据和错误信息
- **中间件集成**: 集成认证、日志、监控等中间件

## 架构设计

```
HTTP/gRPC Request → Service Layer → Business Logic → Data Layer
                ↓
        Response/Error Handling
```

## 核心服务

### 1. CodeWikiService
- **仓库管理**: 创建、查询、更新、删除代码仓库
- **代码分析**: 触发代码结构分析和关系分析
- **结果查询**: 获取分析结果和统计数据

### 2. HTTP服务
- **RESTful API**: 提供标准的HTTP接口
- **参数验证**: 使用protobuf验证器验证请求参数
- **错误处理**: 统一的HTTP错误响应格式

### 3. gRPC服务
- **高性能通信**: 支持流式传输和双向通信
- **类型安全**: 基于protobuf的类型安全接口
- **服务发现**: 支持服务注册和发现

## API接口

### 仓库管理
```protobuf
service CodeWikiService {
  // 创建代码仓库
  rpc CreateCodeRepository(CreateCodeRepositoryRequest) returns (CreateCodeRepositoryReply);
  
  // 获取仓库列表
  rpc ListCodeRepository(ListCodeRepositoryRequest) returns (ListCodeRepositoryReply);
  
  // 获取仓库详情
  rpc GetCodeRepository(GetCodeRepositoryRequest) returns (GetCodeRepositoryReply);
  
  // 删除仓库
  rpc DeleteCodeRepository(DeleteCodeRepositoryRequest) returns (DeleteCodeRepositoryReply);
}
```

### 代码分析
```protobuf
service CodeWikiService {
  // 分析代码仓库
  rpc AnalyzeCodeRepository(AnalyzeCodeRepositoryRequest) returns (AnalyzeCodeRepositoryReply);
  
  // 获取分析结果
  rpc GetAnalysisResult(GetAnalysisResultRequest) returns (GetAnalysisResultReply);
  
  // 获取函数调用关系
  rpc GetFunctionCalls(GetFunctionCallsRequest) returns (GetFunctionCallsReply);
}
```

## 中间件集成

### 1. 认证中间件
- JWT token验证
- API密钥认证
- 角色权限控制

### 2. 日志中间件
- 请求日志记录
- 性能监控
- 错误追踪

### 3. 监控中间件
- Prometheus指标收集
- 健康检查
- 性能分析

## 错误处理

### HTTP错误响应
```json
{
  "error": {
    "code": 400,
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      }
    ]
  }
}
```

### gRPC错误处理
```go
import "google.golang.org/grpc/status"
import "google.golang.org/grpc/codes"

func (s *CodeWikiService) CreateCodeRepository(ctx context.Context, req *CreateCodeRepositoryRequest) (*CreateCodeRepositoryReply, error) {
    if req.Name == "" {
        return nil, status.Error(codes.InvalidArgument, "name is required")
    }
    // ... 业务逻辑
}
```

## 配置管理

### 服务配置
```yaml
server:
  http:
    addr: 0.0.0.0:8000
    timeout: 1s
    middleware:
      - recovery
      - logging
      - metrics
      - cors
  grpc:
    addr: 0.0.0.0:9000
    timeout: 1s
    middleware:
      - recovery
      - logging
      - metrics
```

## 测试

### 单元测试
```bash
# 运行服务层测试
go test ./internal/service/...

# 运行特定测试
go test -v ./internal/service -run TestCodeWikiService
```

### 集成测试
```bash
# 运行HTTP服务测试
go test -tags=integration ./internal/service/...

# 运行gRPC服务测试
go test -tags=grpc ./internal/service/...
```

### 性能测试
```bash
# 使用wrk进行HTTP性能测试
wrk -t12 -c400 -d30s http://localhost:8000/v1/api/repos

# 使用ghz进行gRPC性能测试
ghz --insecure --proto=api/codewiki/codewiki.proto \
    --call=codewiki.CodeWikiService.ListCodeRepository \
    localhost:9000
```

## 部署和监控

### 健康检查
```bash
# HTTP健康检查
curl http://localhost:8000/health

# gRPC健康检查
grpc_health_probe -addr=localhost:9000
```

### 指标监控
```bash
# Prometheus指标
curl http://localhost:8000/metrics

# 自定义指标
curl http://localhost:8000/debug/vars
```

## 最佳实践

1. **接口设计**: 遵循RESTful设计原则
2. **错误处理**: 提供清晰的错误信息和错误码
3. **参数验证**: 在服务层进行严格的参数验证
4. **性能优化**: 使用适当的缓存和异步处理
5. **安全考虑**: 实现适当的认证和授权机制
