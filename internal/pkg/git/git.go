package git

import (
	"codewiki/internal/pkg/log"
	"context"
	"fmt"
	"github.com/go-git/go-git/v5/plumbing/format/diff"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

// CloneRepository 克隆远程Git仓库到本地
func CloneRepository(ctx context.Context, req *CloneRepositoryReq) (*CloneRepositoryResp, error) {
	log.Infof(ctx, "开始克隆仓库: %s", req.URL)

	// 创建本地目录
	localPath := filepath.Join(req.LocalBasePath, req.RepositoryName)
	if err := os.MkdirAll(localPath, 0755); err != nil {
		return nil, fmt.Errorf("创建本地目录失败: %w", err)
	}

	// 克隆选项
	cloneOptions := &git.CloneOptions{
		URL:      req.URL,
		Progress: os.Stdout,
	}

	// 如果提供了token，设置认证
	if req.Token != "" {
		cloneOptions.URL = strings.Replace(req.URL, "https://", fmt.Sprintf("https://%s@", req.Token), 1)
	}

	// 如果指定了分支，设置分支
	if req.Branch != "" {
		cloneOptions.ReferenceName = plumbing.NewBranchReferenceName(req.Branch)
	}

	// 执行克隆
	repo, err := git.PlainClone(localPath, false, cloneOptions)
	if err != nil {
		return nil, fmt.Errorf("克隆仓库失败: %w", err)
	}

	// 获取仓库信息
	ref, err := repo.Head()
	if err != nil {
		return nil, fmt.Errorf("获取HEAD引用失败: %w", err)
	}

	commit, err := repo.CommitObject(ref.Hash())
	if err != nil {
		return nil, fmt.Errorf("获取commit信息失败: %w", err)
	}

	log.Infof(ctx, "仓库克隆成功: %s, commit: %s", localPath, commit.Hash.String())

	return &CloneRepositoryResp{
		LocalPath:     localPath,
		CommitHash:    commit.Hash.String(),
		CommitMessage: commit.Message,
		Author:        commit.Author.Name,
		CommittedAt:   commit.Author.When.Unix(),
	}, nil
}

// CompareCommits 比较两个commit的差异，找出受影响的函数
func CompareCommits(ctx context.Context, req *CompareCommitsReq) (*CompareCommitsResp, error) {
	log.Infof(ctx, "开始比较commits: %s vs %s", req.FromCommit, req.ToCommit)
	// 打开本地仓库
	repo, err := git.PlainOpen(req.RepositoryPath)
	if err != nil {
		return nil, fmt.Errorf("打开仓库失败: %w", err)
	}

	// 获取两个commit对象
	fromCommit, err := repo.CommitObject(plumbing.NewHash(req.FromCommit))
	if err != nil {
		return nil, fmt.Errorf("获取from commit失败: %w", err)
	}

	toCommit, err := repo.CommitObject(plumbing.NewHash(req.ToCommit))
	if err != nil {
		return nil, fmt.Errorf("获取to commit失败: %w", err)
	}

	// 比较两个commit
	patch, err := fromCommit.Patch(toCommit)
	if err != nil {
		return nil, fmt.Errorf("生成patch失败: %w", err)
	}

	// 分析受影响的文件和函数
	affectedFiles := make(map[string]*AffectedFile)

	for _, filePatch := range patch.FilePatches() {
		fromFile, toFile := filePatch.Files()

		// 获取文件名
		var fileName string
		if fromFile != nil {
			fileName = fromFile.Path()
		} else if toFile != nil {
			fileName = toFile.Path()
		}

		if fileName == "" {
			continue
		}

		// 只分析代码文件
		if !isCodeFile(fileName) {
			continue
		}

		affectedFile := &AffectedFile{
			Path:         fileName,
			ChangeType:   getChangeType(fromFile, toFile),
			AddedLines:   0,
			DeletedLines: 0,
			Functions:    []*AffectedFunction{},
		}

		// 分析具体的变更
		for _, chunk := range filePatch.Chunks() {
			switch chunk.Type() {
			case 1: // Add
				affectedFile.AddedLines += len(strings.Split(chunk.Content(), "\n"))
			case 2: // Delete
				affectedFile.DeletedLines += len(strings.Split(chunk.Content(), "\n"))
			}
			parseChunk(chunk)
		}

		// 分析受影响的函数（这里需要更复杂的代码解析逻辑）
		affectedFiles[fileName] = affectedFile
	}

	// 转换为切片
	var affectedFilesList []*AffectedFile
	for _, file := range affectedFiles {
		affectedFilesList = append(affectedFilesList, file)
	}

	log.Infof(ctx, "commit比较完成，发现 %d 个受影响文件", len(affectedFilesList))

	return &CompareCommitsResp{
		FromCommit:    req.FromCommit,
		ToCommit:      req.ToCommit,
		AffectedFiles: affectedFilesList,
		TotalFiles:    len(affectedFilesList),
		TotalAdded:    calculateTotalAdded(affectedFilesList),
		TotalDeleted:  calculateTotalDeleted(affectedFilesList),
	}, nil
}
func parseChunk(chunk diff.Chunk) {
	// chunk 类型：Add, Delete, Equal
	chunkType := chunk.Type()
	content := chunk.Content()

	switch chunkType {
	case diff.Add:
		fmt.Printf("+++ 新增 %d 行:\n", strings.Count(content, "\n"))
		fmt.Print(greenColor(content))
	case diff.Delete:
		fmt.Printf("--- 删除 %d 行:\n", strings.Count(content, "\n"))
		fmt.Print(redColor(content))
	case diff.Equal:
		// 通常不显示上下文，除非需要
		if strings.Count(content, "\n") <= 5 { // 只显示短的上下文
			fmt.Printf("   上下文 %d 行:\n", strings.Count(content, "\n"))
			fmt.Print(content)
		}
	}
	fmt.Println()
}

// 简单的终端颜色输出（可选）
func greenColor(text string) string {
	return "\033[32m" + text + "\033[0m"
}

func redColor(text string) string {
	return "\033[31m" + text + "\033[0m"
}

// 更详细的 chunk 解析
func parseChunkWithPosition(chunk diff.Chunk, chunkIndex int) {
	// chunk 的元数据包含位置信息
	fmt.Printf("Chunk #%d:\n", chunkIndex)
	fmt.Printf("  类型: %s\n", chunkTypeToString(chunk.Type()))
	fmt.Printf("  内容行数: %d\n", strings.Count(chunk.Content(), "\n"))

	// 对于有位置信息的 chunk（需要从 patch 的上下文获取）
	fmt.Printf("  内容:\n%s", chunk.Content())
	fmt.Println("---")
}

func chunkTypeToString(t diff.Operation) string {
	switch t {
	case diff.Add:
		return "新增"
	case diff.Delete:
		return "删除"
	case diff.Equal:
		return "未修改"
	default:
		return "未知"
	}
}

// AnalyzeMergeRequest 分析Merge Request，找出差异和受影响的函数
func AnalyzeMergeRequest(ctx context.Context, mrInfo *MRInfo) (*AnalyzeMRResp, error) {
	// 2. 比较MR的源分支和目标分支
	compareResult, err := CompareCommits(ctx, &CompareCommitsReq{
		RepositoryPath: mrInfo.RepositoryPath,
		FromCommit:     mrInfo.SourceCommit,
		ToCommit:       mrInfo.TargetCommit,
	})
	if err != nil {
		return nil, fmt.Errorf("比较commits失败: %w", err)
	}

	return &AnalyzeMRResp{
		MRID:          mrInfo.MRID,
		Title:         mrInfo.Title,
		Description:   mrInfo.Description,
		SourceBranch:  mrInfo.SourceBranch,
		TargetBranch:  mrInfo.TargetBranch,
		SourceCommit:  mrInfo.SourceCommit,
		TargetCommit:  mrInfo.TargetCommit,
		AffectedFiles: compareResult.AffectedFiles,
		TotalChanges:  compareResult.TotalAdded + compareResult.TotalDeleted,
		Status:        mrInfo.Status,
	}, nil
}

// 辅助方法

// isCodeFile 判断是否为代码文件
func isCodeFile(fileName string) bool {
	ext := strings.ToLower(filepath.Ext(fileName))
	codeExtensions := map[string]bool{
		".go":   true,
		".java": true,
		".py":   true,
		".rs":   true,
		".js":   true,
		".ts":   true,
		".cpp":  true,
		".c":    true,
		".h":    true,
		".hpp":  true,
	}
	return codeExtensions[ext]
}

// getChangeType 获取文件变更类型
func getChangeType(fromFile, toFile interface{}) string {
	if fromFile == nil && toFile != nil {
		return "added"
	} else if fromFile != nil && toFile == nil {
		return "deleted"
	} else if fromFile != nil && toFile != nil {
		return "modified"
	}
	return "unknown"
}

// calculateTotalAdded 计算总添加行数
func calculateTotalAdded(files []*AffectedFile) int {
	total := 0
	for _, file := range files {
		total += file.AddedLines
	}
	return total
}

// calculateTotalDeleted 计算总删除行数
func calculateTotalDeleted(files []*AffectedFile) int {
	total := 0
	for _, file := range files {
		total += file.DeletedLines
	}
	return total
}

// 请求和响应结构体

type CloneRepositoryReq struct {
	URL            string
	LocalBasePath  string
	RepositoryName string
	Token          string
	Branch         string
}

type CloneRepositoryResp struct {
	LocalPath     string
	CommitHash    string
	CommitMessage string
	Author        string
	CommittedAt   int64
}

type CompareCommitsReq struct {
	RepositoryPath string
	FromCommit     string
	ToCommit       string
}

type CompareCommitsResp struct {
	FromCommit    string
	ToCommit      string
	AffectedFiles []*AffectedFile
	TotalFiles    int
	TotalAdded    int
	TotalDeleted  int
}

type AffectedFile struct {
	Path         string
	ChangeType   string
	AddedLines   int
	DeletedLines int
	Functions    []*AffectedFunction
}

type AffectedFunction struct {
	Name         string
	ChangeType   string
	AddedLines   int
	DeletedLines int
}

type AffectedEntity struct {
	Name          string
	Type          string
	ChangeType    string
	AffectedFiles []string
}

type AnalyzeMRReq struct {
	MRID           string
	RepositoryPath string
	Platform       string // github, gitlab等
	Token          string
}

type AnalyzeMRResp struct {
	MRID             string
	Title            string
	Description      string
	SourceBranch     string
	TargetBranch     string
	SourceCommit     string
	TargetCommit     string
	AffectedFiles    []*AffectedFile
	AffectedEntities []*AffectedEntity
	TotalChanges     int
	Status           string
}

type MRInfo struct {
	MRID           string
	Title          string
	Description    string
	SourceBranch   string
	TargetBranch   string
	SourceCommit   string
	TargetCommit   string
	Status         string
	RepositoryPath string
}
