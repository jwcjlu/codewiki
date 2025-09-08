package service

import (
	"codewiki/internal/pkg/log"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	v1 "codewiki/api/codewiki/v1"

	mcp_golang "github.com/metoro-io/mcp-golang"

	"go.uber.org/zap"
)

// MCPService 提供 MCP (Model Context Protocol) 服务
type MCPService struct {
	codeAnalyzer *CodeAnalyzerService
	repository   *RepositoryService
	qa           *QAService
	logger       *zap.Logger
}

// NewMCPService 创建新的 MCP 服务器
func NewMCPService(
	codeAnalyzer *CodeAnalyzerService,
	repository *RepositoryService,
	qa *QAService,
) *MCPService {

	mcpServer := &MCPService{
		codeAnalyzer: codeAnalyzer,
		repository:   repository,
		qa:           qa,
	}

	return mcpServer
}

// RegisterTools 注册所有工具
func (m *MCPService) RegisterTools(server *mcp_golang.Server) error {
	// 1. 仓库管理工具
	err := server.RegisterTool("list_repositories", "列出所有代码仓库", m.listRepositories)
	if err != nil {
		return err
	}

	// 2. 代码分析工具
	err = server.RegisterTool("analyze_repository", "分析代码仓库", m.analyzeRepository)
	if err != nil {
		return err
	}
	err = server.RegisterTool("get_repository_tree", "获取仓库文件树结构", m.getRepositoryTree)
	if err != nil {
		return err
	}
	err = server.RegisterTool("view_file_content", "查看文件内容", m.viewFileContent)
	if err != nil {
		return err
	}
	err = server.RegisterTool("get_call_chain", "获取函数调用链", m.getCallChain)
	if err != nil {
		return err
	}
	err = server.RegisterTool("get_implementations", "获取接口实现", m.getImplementations)
	if err != nil {
		return err
	}

	// 3. 代码搜索工具
	err = server.RegisterTool("search_code", "搜索代码内容", m.searchCode)
	if err != nil {
		return err
	}
	err = server.RegisterTool("search_functions", "搜索函数定义", m.searchFunctions)
	if err != nil {
		return err
	}
	err = server.RegisterTool("search_classes", "搜索类定义", m.searchClasses)
	if err != nil {
		return err
	}

	// 4. AI 问答工具
	err = server.RegisterTool("ask_question", "向 AI 提问关于代码的问题", m.askQuestion)
	if err != nil {
		return err
	}
	return nil
}

// RegisterPrompts 注册所有提示
func (m *MCPService) RegisterPrompts(server *mcp_golang.Server) error {
	/*err := server.RegisterPrompt("code_review", "代码审查提示", m.codeReviewPrompt)
	if err != nil {
		return err
	}
	err = server.RegisterPrompt("architecture_analysis", "架构分析提示", m.architectureAnalysisPrompt)
	if err != nil {
		return err
	}
	err = server.RegisterPrompt("bug_detection", "Bug 检测提示", m.bugDetectionPrompt)
	if err != nil {
		return err
	}
	err = server.RegisterPrompt("performance_optimization", "性能优化提示", m.performanceOptimizationPrompt)
	if err != nil {
		return err
	}*/
	return nil
}

// RegisterResources 注册所有资源
func (m *MCPService) RegisterResources(server *mcp_golang.Server) error {
	err := server.RegisterResource("repositories", "repositories", "代码仓库列表", "application/json", m.getRepositoriesResource)
	if err != nil {
		return err
	}
	err = server.RegisterResource("repository_tree", "repository_tree", "仓库文件树", "application/json", m.getRepositoryTreeResource)
	if err != nil {
		return err
	}
	err = server.RegisterResource("call_graph", "call_graph", "函数调用图", "application/json", m.getCallGraphResource)
	if err != nil {
		return err
	}
	return nil
}

// 工具参数结构体定义

// ListRepositoriesArgs 列出仓库参数
type ListRepositoriesArgs struct {
	Limit  *int `json:"limit" jsonschema:"description=限制返回数量"`
	Offset *int `json:"offset" jsonschema:"description=偏移量"`
}

// CreateRepositoryArgs 创建仓库参数
type CreateRepositoryArgs struct {
	Name   string `json:"name" jsonschema:"required,description=仓库名称"`
	Target string `json:"target" jsonschema:"required,description=仓库地址或本地路径"`
	Token  string `json:"token" jsonschema:"description=GitHub Token"`
	//Language int    `json:"language" jsonschema:"required,description=编程语言 (1=Golang, 2=Python, 3=Java, 4=JavaScript, 5=TypeScript, 6=C++, 7=C#, 8=Rust, 9=PHP, 10=Ruby)"`
	Excludes string `json:"excludes" jsonschema:"description=排除的文件模式，用逗号分隔"`
}

// DeleteRepositoryArgs 删除仓库参数
type DeleteRepositoryArgs struct {
	ID string `json:"id" jsonschema:"required,description=仓库ID"`
}

// GetRepositoryArgs 获取仓库参数
type GetRepositoryArgs struct {
	ID string `json:"id" jsonschema:"required,description=仓库ID"`
}

// AnalyzeRepositoryArgs 分析仓库参数
type AnalyzeRepositoryArgs struct {
	ID string `json:"id" jsonschema:"required,description=仓库ID"`
	//ForceUpdate bool   `json:"force_update" jsonschema:"description=是否强制更新"`
}

// GetRepositoryTreeArgs 获取仓库树参数
type GetRepositoryTreeArgs struct {
	RepoID string `json:"repo_id" jsonschema:"required,description=仓库ID"`
}

// ViewFileContentArgs 查看文件内容参数
type ViewFileContentArgs struct {
	RepoID string `json:"repo_id" jsonschema:"required,description=仓库ID"`
	FileID string `json:"file_id" jsonschema:"required,description=文件ID"`
}

// GetCallChainArgs 获取调用链参数
type GetCallChainArgs struct {
	FunctionID string `json:"function_id" jsonschema:"required,description=函数ID"`
}

// GetImplementationsArgs 获取实现参数
type GetImplementationsArgs struct {
	InterfaceID string `json:"interface_id" jsonschema:"required,description=接口ID"`
}

// SearchCodeArgs 搜索代码参数
type SearchCodeArgs struct {
	RepoID     string `json:"repo_id" jsonschema:"required,description=仓库ID"`
	Query      string `json:"query" jsonschema:"required,description=搜索查询"`
	FileType   string `json:"file_type" jsonschema:"description=文件类型过滤"`
	MaxResults int    `json:"max_results" jsonschema:"description=最大结果数量"`
}

// AskQuestionArgs 提问参数
type AskQuestionArgs struct {
	RepoID   string `json:"repo_id" jsonschema:"required,description=仓库ID"`
	Question string `json:"question" jsonschema:"required,description=问题内容"`
}

// 工具实现函数

func (m *MCPService) listRepositories(args ListRepositoriesArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	// 调用仓库服务获取仓库列表
	resp, err := m.repository.ListRepos(ctx, &v1.ListRepoReq{})
	if err != nil {
		log.Errorf(ctx, "Failed to list repositories", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	// 格式化输出
	var result strings.Builder
	result.WriteString("## 代码仓库列表\n\n")

	for i, repo := range resp.Body.Repo {
		if args.Limit != nil && i >= *args.Limit {
			break
		}
		if args.Offset != nil && i < *args.Offset {
			continue
		}

		result.WriteString(fmt.Sprintf("### %s\n", repo.Name))
		result.WriteString(fmt.Sprintf("- **ID**: %s\n", repo.Id))
		result.WriteString(fmt.Sprintf("- **路径**: %s\n", repo.Path))
		result.WriteString(fmt.Sprintf("- **语言**: %s\n", getLanguageName(repo.Language)))
		result.WriteString(fmt.Sprintf("- **类型**: %s\n", getRepoTypeName(repo.RepoType)))
		result.WriteString("\n")
	}

	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result.String())), nil
}

func (m *MCPService) deleteRepository(args DeleteRepositoryArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	req := &v1.DeleteRepoReq{Id: args.ID}
	_, err := m.repository.DeleteRepo(ctx, req)
	if err != nil {
		log.Errorf(ctx, "Failed to delete repository", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	result := fmt.Sprintf("✅ 仓库删除成功!\n\n**删除的仓库ID**: %s", args.ID)
	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

func (m *MCPService) getRepository(args GetRepositoryArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	req := &v1.GetRepoReq{Id: args.ID}
	resp, err := m.repository.GetRepo(ctx, req)
	if err != nil {
		log.Errorf(ctx, "Failed to get repository", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	repo := resp.Body.Repo
	result := fmt.Sprintf("## 仓库详细信息\n\n**基本信息:**\n- **ID**: %s\n- **名称**: %s\n- **路径**: %s\n- **语言**: %s\n- **类型**: %s\n- **排除模式**: %s",
		repo.Id, repo.Name, repo.Path, getLanguageName(repo.Language), getRepoTypeName(repo.RepoType), repo.Excludes)

	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

func (m *MCPService) analyzeRepository(args AnalyzeRepositoryArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	req := &v1.AnalyzeRepoReq{
		Id: args.ID,
	}

	_, err := m.codeAnalyzer.AnalyzeRepo(ctx, req)
	if err != nil {
		log.Errorf(ctx, "Failed to analyze repository", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	result := fmt.Sprintf("✅ 仓库分析完成!\n\n**分析结果:**\n- **仓库ID**: %s\n- **状态**: 分析成功", args.ID)
	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

func (m *MCPService) getRepositoryTree(args GetRepositoryTreeArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	req := &v1.GetRepoTreeReq{Id: args.RepoID}
	resp, err := m.repository.GetRepoTree(ctx, req)
	if err != nil {
		log.Errorf(ctx, "Failed to get repository tree", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	// 格式化树结构
	var result strings.Builder
	result.WriteString("## 仓库文件树结构\n\n")
	m.formatTree(&result, resp.Body.Packages, 0)

	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result.String())), nil
}

func (m *MCPService) viewFileContent(args ViewFileContentArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	req := &v1.ViewFileReq{
		RepoId: args.RepoID,
		Id:     args.FileID,
	}

	resp, err := m.codeAnalyzer.ViewFileContent(ctx, req)
	if err != nil {
		log.Errorf(ctx, "Failed to view file content", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	result := fmt.Sprintf("## 文件内容\n\n**文件ID**: %s\n**语言**: %s\n\n```%s\n%s\n```",
		args.FileID, getLanguageName(resp.Body.Language), getLanguageName(resp.Body.Language), resp.Body.Content)

	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

func (m *MCPService) getCallChain(args GetCallChainArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	req := &v1.CallChainReq{Id: args.FunctionID}
	resp, err := m.codeAnalyzer.CallChain(ctx, req)
	if err != nil {
		log.Errorf(ctx, "Failed to get call chain", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	var result strings.Builder
	result.WriteString("## 函数调用链\n\n")

	for _, relation := range resp.Body.CallRelations {
		result.WriteString(fmt.Sprintf("### %s -> %s\n", relation.CallerName, relation.CalleeName))
		result.WriteString(fmt.Sprintf("- **调用者ID**: %s\n", relation.CallerId))
		result.WriteString(fmt.Sprintf("- **被调用者ID**: %s\n", relation.CalleeId))
		result.WriteString(fmt.Sprintf("- **调用者文件ID**: %s\n", relation.CallerFileId))
		result.WriteString(fmt.Sprintf("- **被调用者文件ID**: %s\n", relation.CalleeFileId))
		result.WriteString(fmt.Sprintf("- **调用者作用域**: %d\n", relation.CallerScope))
		result.WriteString(fmt.Sprintf("- **被调用者作用域**: %d\n", relation.CalleeScope))
		result.WriteString("\n")
	}

	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result.String())), nil
}

func (m *MCPService) getImplementations(args GetImplementationsArgs) (*mcp_golang.ToolResponse, error) {
	ctx := context.Background()

	req := &v1.GetImplementReq{Id: args.InterfaceID}
	resp, err := m.codeAnalyzer.GetImplement(ctx, req)
	if err != nil {
		log.Errorf(ctx, "Failed to get implementations", zap.Error(err))
		return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(fmt.Sprintf("Error: %v", err))), nil
	}

	var result strings.Builder
	result.WriteString("## 接口实现\n\n")

	for _, entity := range resp.Body.Entities {
		result.WriteString(fmt.Sprintf("### %s\n", entity.Name))
		result.WriteString(fmt.Sprintf("- **ID**: %s\n", entity.Id))
		result.WriteString(fmt.Sprintf("- **文件ID**: %s\n", entity.FileId))
		result.WriteString(fmt.Sprintf("- **函数数量**: %d\n", len(entity.Functions)))
		result.WriteString("\n")
	}

	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result.String())), nil
}

func (m *MCPService) searchCode(args SearchCodeArgs) (*mcp_golang.ToolResponse, error) {
	// 这里需要实现代码搜索逻辑
	// 暂时返回模拟数据
	result := fmt.Sprintf("## 代码搜索结果\n\n**查询**: %s\n**仓库ID**: %s\n\n搜索结果将在这里显示...", args.Query, args.RepoID)
	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

func (m *MCPService) searchFunctions(args SearchCodeArgs) (*mcp_golang.ToolResponse, error) {
	// 这里需要实现函数搜索逻辑
	result := fmt.Sprintf("## 函数搜索结果\n\n**查询**: %s\n**仓库ID**: %s\n\n函数搜索结果将在这里显示...", args.Query, args.RepoID)
	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

func (m *MCPService) searchClasses(args SearchCodeArgs) (*mcp_golang.ToolResponse, error) {
	// 这里需要实现类搜索逻辑
	result := fmt.Sprintf("## 类搜索结果\n\n**查询**: %s\n**仓库ID**: %s\n\n类搜索结果将在这里显示...", args.Query, args.RepoID)
	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

func (m *MCPService) askQuestion(args AskQuestionArgs) (*mcp_golang.ToolResponse, error) {
	// 由于 QA 服务通过 HTTP SSE 处理，这里返回一个提示信息
	result := fmt.Sprintf("## AI 问答\n\n**问题**: %s\n\n**仓库ID**: %s\n\n**注意**: 问答功能需要通过 HTTP SSE 接口使用，请使用前端界面或直接调用 /v1/api/repo/%s/answer 接口。",
		args.Question, args.RepoID, args.RepoID)
	return mcp_golang.NewToolResponse(mcp_golang.NewTextContent(result)), nil
}

// 提示实现函数
/*
func (m *MCPService) codeReviewPrompt(args CreateRepositoryArgs) (*mcp_golang.PromptResponse, error) {
	prompt := fmt.Sprintf(`请对以下代码仓库进行代码审查：

**仓库信息:**
- 名称: %s
- 路径: %s
- 语言: %s

请从以下方面进行审查：
1. 代码质量和规范性
2. 性能优化建议
3. 安全性问题
4. 可维护性
5. 最佳实践建议

请提供详细的审查报告和改进建议。`, args.Name, args.Target, getLanguageName(v1.Language(args.Language)))

	return mcp_golang.NewPromptResponse("code_review", mcp_golang.NewPromptMessage(mcp_golang.NewTextContent(prompt), mcp_golang.RoleUser)), nil
}*/
/*
func (m *MCPService) architectureAnalysisPrompt(args CreateRepositoryArgs) (*mcp_golang.PromptResponse, error) {
	prompt := fmt.Sprintf(`请分析以下代码仓库的架构：

**仓库信息:**
- 名称: %s
- 路径: %s
- 语言: %s

请分析：
1. 整体架构模式
2. 模块划分和依赖关系
3. 设计模式使用情况
4. 架构优缺点
5. 改进建议

请生成架构图和详细分析报告。`, args.Name, args.Target, getLanguageName(v1.Language(args.Language)))

	return mcp_golang.NewPromptResponse("architecture_analysis", mcp_golang.NewPromptMessage(mcp_golang.NewTextContent(prompt), mcp_golang.RoleUser)), nil
}

func (m *MCPService) bugDetectionPrompt(args CreateRepositoryArgs) (*mcp_golang.PromptResponse, error) {
	prompt := fmt.Sprintf(`请检测以下代码仓库中的潜在 Bug：

**仓库信息:**
- 名称: %s
- 路径: %s
- 语言: %s

请重点检查：
1. 空指针引用
2. 数组越界
3. 内存泄漏
4. 并发安全问题
5. 逻辑错误
6. 异常处理不当

请提供详细的 Bug 报告和修复建议。`, args.Name, args.Target, getLanguageName(v1.Language(args.Language)))

	return mcp_golang.NewPromptResponse("bug_detection", mcp_golang.NewPromptMessage(mcp_golang.NewTextContent(prompt), mcp_golang.RoleUser)), nil
}

func (m *MCPService) performanceOptimizationPrompt(args CreateRepositoryArgs) (*mcp_golang.PromptResponse, error) {
	prompt := fmt.Sprintf(`请优化以下代码仓库的性能：

**仓库信息:**
- 名称: %s
- 路径: %s
- 语言: %s

请分析：
1. 性能瓶颈识别
2. 算法复杂度优化
3. 内存使用优化
4. 并发性能优化
5. 数据库查询优化
6. 缓存策略建议

请提供具体的优化方案和性能提升预期。`, args.Name, args.Target, getLanguageName(v1.Language(args.Language)))

	return mcp_golang.NewPromptResponse("performance_optimization", mcp_golang.NewPromptMessage(mcp_golang.NewTextContent(prompt), mcp_golang.RoleUser)), nil
}
*/
// 资源实现函数

func (m *MCPService) getRepositoriesResource() (*mcp_golang.ResourceResponse, error) {
	ctx := context.Background()
	resp, err := m.repository.ListRepos(ctx, &v1.ListRepoReq{})
	if err != nil {
		return nil, err
	}

	data, err := json.MarshalIndent(resp.Body.Repo, "", "  ")
	if err != nil {
		return nil, err
	}

	return mcp_golang.NewResourceResponse(mcp_golang.NewTextEmbeddedResource("repositories", string(data), "application/json")), nil
}

func (m *MCPService) getRepositoryTreeResource() (*mcp_golang.ResourceResponse, error) {
	// 这里需要实现获取仓库树的逻辑
	data := `{"message": "Repository tree resource - implementation needed"}`
	return mcp_golang.NewResourceResponse(mcp_golang.NewTextEmbeddedResource("repository_tree", data, "application/json")), nil
}

func (m *MCPService) getCallGraphResource() (*mcp_golang.ResourceResponse, error) {
	// 这里需要实现获取调用图的逻辑
	data := `{"message": "Call graph resource - implementation needed"}`
	return mcp_golang.NewResourceResponse(mcp_golang.NewTextEmbeddedResource("call_graph", data, "application/json")), nil
}

// 辅助函数

func (m *MCPService) formatTree(result *strings.Builder, packages []*v1.PackageNode, depth int) {
	indent := strings.Repeat("  ", depth)

	for _, pkg := range packages {
		result.WriteString(fmt.Sprintf("%s📁 %s (ID: %s)\n", indent, pkg.Name, pkg.Id))

		// 注意：PackageNode 没有子包字段，这里简化处理
		// 如果需要显示子包，需要修改 proto 定义或使用其他方式
	}
}

func getLanguageName(lang v1.Language) string {
	switch lang {
	case v1.Language_Golang:
		return "Golang"
	case v1.Language_Java:
		return "Java"
	case v1.Language_Python:
		return "Python"
	case v1.Language_Rust:
		return "Rust"
	default:
		return "Unknown"
	}
}

func getRepoTypeName(repoType v1.RepoType) string {
	switch repoType {
	case v1.RepoType_Local:
		return "本地"
	case v1.RepoType_Github:
		return "GitHub"
	default:
		return "Unknown"
	}
}
