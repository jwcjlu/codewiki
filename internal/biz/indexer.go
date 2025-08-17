package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/pkg/llm"
	"context"
)

type Indexer struct {
	llm  *llm.LLM
	repo IndexerRepo
}

type ReadSourceCode interface {
	SourceCode() (string, error)
}

func NewIndexer(llm *llm.LLM, repo IndexerRepo) *Indexer {
	return &Indexer{llm: llm, repo: repo}
}

type Scope string

const (
	ChunkFileScope     Scope = "file"
	ChunkFunctionScope Scope = "function"
	ChunkPkgScope      Scope = "pkg"
	ChunkProjectScope  Scope = "project"
)

type CodeChunk struct {
	Path        string `json:"path" `
	Content     string `json:"content" `
	codeVector  []float32
	logicVector []float32
	Document    string `json:"document"`
	Logic       string `json:"logic"`
	Scope       Scope  `json:"scope"`
	Id          string `json:"id"`
}

func (cc *CodeChunk) CodeVector() []float32 {
	return cc.codeVector
}
func (cc *CodeChunk) LogicVector() []float32 {
	return cc.logicVector
}

type SearchCodeChunksReq struct {
	Limit       int
	QueryVector []float32
	ProjectName string
	Partition   string
}

// Indexer 创建索引
func (idx *Indexer) Indexer(ctx context.Context, pkg *Package, repo *v1.Repo) error {
	var codeChunks []*CodeChunk
	for _, file := range pkg.Files {
		cc, err := idx.buildCodeChunk(ctx, file)
		if err != nil {
			return err
		}
		codeChunks = append(codeChunks, cc)
	}
	return idx.repo.SaveCodeChunk(ctx, repo.Name, repo.Id, codeChunks)
}

func (idx *Indexer) buildCodeChunk(ctx context.Context, file *File) (*CodeChunk, error) {
	rawCodeChunk := file.BuildRawCodeChunk()
	if !idx.llm.Enable() {
		return nil, v1.ErrorNotSupportLLM("buildCodeChunk failure ! not support llm")
	}
	resp, err := idx.llm.Embeddings(ctx, llm.EmbeddingRequest{
		Input: rawCodeChunk.Content,
		Model: GetEmbeddingModel(),
	})
	if err != nil {
		return nil, err
	}
	/*completions, err := idx.llm.Completions(ctx, llm.ChatRequest{
		Model: GetLLMModel(),
		Messages: []llm.Message{{Role: "system", Content: "你是一个专业的Go代码分析助手，能够准确理解代码结构和业务逻辑。"},
			{Role: "user", Content: llm.GetAnalysisCodePrompts(llm.BusinessLogic,
				"go", rawCodeChunk.Content)}},
		MaxTokens: 1000,
	})
	if err != nil {
		return nil, err
	}
	rawCodeChunk.Logic = completions.Choices[0].Message.Content*/
	rawCodeChunk.codeVector = resp.Data[0].Embedding
	return rawCodeChunk, nil
}

// SearchCode 搜索代码
func (idx *Indexer) SearchCode(ctx context.Context, repo *v1.Repo, query string) ([]*CodeChunk, error) {
	if !idx.llm.Enable() {
		return nil, v1.ErrorNotSupportLLM("SearchCode failure !not support llm")
	}
	// 使用LLM生成查询的向量表示
	resp, err := idx.llm.Embeddings(ctx, llm.EmbeddingRequest{
		Model: GetEmbeddingModel(),
		Input: query,
	})
	if err != nil {
		return nil, err
	}

	// 在向量数据库中搜索相似的代码块
	results, err := idx.repo.SearchCodeChunk(ctx, &SearchCodeChunksReq{
		Limit:       1,
		QueryVector: resp.Data[0].Embedding,
		ProjectName: repo.Name,
		Partition:   repo.Id,
	})
	return results, nil
}
