# Business Logic Layer (Biz)

## 概述

业务逻辑层是CodeWiki系统的核心，负责实现代码分析、仓库管理、关系分析等核心业务功能。

## 主要职责

- **代码仓库管理**: 创建、删除、查询代码仓库
- **代码结构分析**: 解析代码文件，提取包、类、函数等信息
- **关系分析**: 分析函数调用关系、依赖关系等
- **数据聚合**: 整合多个数据源的信息

## 核心组件

### 1. CodeRepository
- 管理代码仓库的生命周期
- 处理仓库的创建、更新、删除操作
- 协调代码分析流程

### 2. RelationAnalyzer
- 分析代码中的各种关系
- 构建函数调用图
- 识别依赖关系

### 3. CodeWiki
- 主要的业务逻辑协调器
- 整合各个业务组件
- 处理复杂的业务流程

## 设计原则

- **单一职责**: 每个组件只负责特定的业务功能
- **依赖注入**: 使用Wire框架管理依赖关系
- **接口隔离**: 定义清晰的接口边界
- **错误处理**: 统一的错误处理机制

## 使用示例

```go
// 创建代码仓库
repo := &entity.CodeRepository{
    Name: "my-project",
    Path: "/path/to/project",
    Language: entity.LanguageGo,
}

// 分析代码
analyzer := NewRelationAnalyzer()
result := analyzer.Analyze(repo)

// 获取调用关系
calls := analyzer.GetFunctionCalls("main")
```

## 测试

```bash
# 运行所有测试
go test ./...

# 运行特定测试
go test -v ./biz -run TestCodeRepository

# 生成测试覆盖率报告
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```
