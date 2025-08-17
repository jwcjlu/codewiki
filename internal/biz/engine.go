package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
	"fmt"
	"strings"

	"codewiki/internal/pkg/llm"
)

type QAEngine struct {
	llm     *llm.LLM
	indexer *Indexer
	repo    ProjectRepo
}

func NewQAEngine(llm *llm.LLM, indexer *Indexer, repo ProjectRepo) *QAEngine {
	return &QAEngine{llm: llm, indexer: indexer, repo: repo}
}
func (qa *QAEngine) Answer(ctx context.Context, req *v1.AnswerReq, resp chan *v1.AnswerResp) error {
	repo, err := qa.repo.GetRepo(ctx, req.GetId())
	if err != nil {
		return fmt.Errorf("query repo err:%v", err)
	}
	// 搜索相似代码片段
	results, err := qa.indexer.SearchCode(ctx, repo, req.GetQuestion())
	if err != nil {
		return fmt.Errorf("indexer search code %s err:%v", req.GetQuestion(), err)
	}
	// 生成自然语言回答
	var contents []string
	for _, result := range results {
		contents = append(contents, result.Content)
	}
	return qa.generateAnswer(ctx, req.GetQuestion(), contents, resp)

}

func (qa *QAEngine) generateAnswer(ctx context.Context,
	question string,
	contexts []string,
	resp chan *v1.AnswerResp) error {
	prompt := fmt.Sprintf(`基于以下代码片段回答问题：%s问题：%s答案：`, strings.Join(contexts, "\n\n"), question)
	receive := llm.NewChatResponseStreamReceive()
	go func() {
		defer close(resp)
		for {
			select {
			case v, isClose := <-receive.Chunk:
				if !isClose {
					break
				}
				resp <- &v1.AnswerResp{
					IsStreaming: true,
					IsComplete:  v.IsComplete,
					Chunk:       v.Content,
					ChunkIndex:  v.ChunkIndex,
					Error:       v.Error,
				}

			}
		}
	}()
	go qa.llm.CompletionStream(ctx, llm.ChatRequest{
		Model: GetLLMModel(),
		Messages: []llm.Message{
			{Role: "user", Content: prompt},
		},
	}, receive)
	return nil
}
