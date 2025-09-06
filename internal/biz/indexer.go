package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz/model"
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

type SearchCodeChunksReq struct {
	Limit       int
	QueryVector []float32
	ProjectName string
	Partition   string
}

// Indexer 创建索引
func (idx *Indexer) Indexer(ctx context.Context, codeParse *model.CodeParse) error {
	var codeChunks []*model.CodeChunk
	for _, file := range codeParse.GetFiles() {
		for _, fun := range file.GetFunctions() {
			cc, err := idx.buildCodeChunk(ctx, fun)
			if err != nil {
				return err
			}
			codeChunks = append(codeChunks, cc)
		}
		for _, fun := range file.GetMethods() {
			cc, err := idx.buildCodeChunk(ctx, fun)
			if err != nil {
				return err
			}
			codeChunks = append(codeChunks, cc)
		}
	}
	return idx.repo.SaveCodeChunk(ctx, codeParse.Repo.Name, codeParse.Repo.ID, codeChunks)
}

func (idx *Indexer) buildCodeChunk(ctx context.Context, builder model.CodeChunkBuilder) (*model.CodeChunk, error) {
	rawCodeChunk := builder.BuildRawCodeChunk()
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
	rawCodeChunk.SetCodeVector(resp.Data[0].Embedding)
	return rawCodeChunk, nil
}

// SearchCode 搜索代码
func (idx *Indexer) SearchCode(ctx context.Context, repo *model.CodeRepository, query string) ([]*model.CodeChunk, error) {
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
		Partition:   repo.ID,
	})
	return results, nil
}
