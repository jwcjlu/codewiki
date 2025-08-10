# Data Access Layer (Data)

## 概述

数据访问层负责与各种数据存储系统交互，包括MySQL关系数据库和Neo4j图数据库，为业务逻辑层提供数据持久化和查询服务。

## 主要职责

- **数据持久化**: 将业务数据存储到数据库
- **数据查询**: 提供高效的数据检索接口
- **事务管理**: 确保数据操作的一致性
- **连接池管理**: 优化数据库连接性能

## 数据存储架构

### 1. MySQL (关系数据)
- **代码仓库信息**: 基本信息、配置、状态等
- **文件元数据**: 文件路径、大小、修改时间等
- **分析结果**: 代码分析的历史记录和统计信息

### 2. Neo4j (图数据)
- **代码结构关系**: 包、文件、函数之间的层次关系
- **函数调用图**: 函数间的调用关系和依赖链
- **依赖关系**: 模块间的导入和依赖关系

## 核心组件

### 1. Entity Repository
- 提供基础的CRUD操作
- 支持批量操作和事务处理
- 实现数据验证和错误处理

### 2. Batch Operations
- 支持大批量数据的导入和更新
- 优化性能，减少数据库往返次数
- 提供进度监控和错误恢复

### 3. Connection Management
- 管理数据库连接池
- 处理连接超时和重试
- 监控连接状态和性能

## 数据模型

### CodeRepository
```go
type CodeRepository struct {
    ID          int64     `gorm:"primaryKey"`
    Name        string    `gorm:"uniqueIndex"`
    Path        string    `gorm:"not null"`
    Language    Language  `gorm:"not null"`
    Status      Status    `gorm:"default:0"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

### Function Call Graph
```cypher
// Neo4j Cypher查询示例
MATCH (caller:Function)-[:CALLS]->(callee:Function)
WHERE caller.name = $functionName
RETURN caller, callee, type(r)
```

## 性能优化

- **索引优化**: 为常用查询字段创建索引
- **查询优化**: 使用适当的JOIN和WHERE条件
- **连接池**: 复用数据库连接，减少连接开销
- **批量操作**: 减少数据库往返次数

## 错误处理

- **连接错误**: 自动重试和故障转移
- **事务回滚**: 确保数据一致性
- **日志记录**: 详细记录错误信息和上下文
- **监控告警**: 及时发现和响应数据问题

## 测试

```bash
# 运行数据层测试
go test ./internal/data/...

# 运行集成测试（需要数据库）
go test -tags=integration ./internal/data/...

# 性能测试
go test -bench=. ./internal/data/...
```

## 配置示例

```yaml
data:
  database:
    driver: mysql
    source: "user:password@tcp(localhost:3306)/codewiki?parseTime=True&charset=utf8mb4"
    max_idle_conns: 10
    max_open_conns: 100
    conn_max_lifetime: "1h"
  
  neo4j:
    target: "bolt://localhost:7687"
    username: "neo4j"
    password: "password"
    max_conn_pool_size: 50
    connection_timeout: "30s"
```
