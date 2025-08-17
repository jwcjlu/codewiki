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
func (qa *QAEngine) HandleQuestion(ctx context.Context, req *v1.AnswerReq) (string, error) {
	repo, err := qa.repo.GetRepo(ctx, req.GetId())
	if err != nil {
		return "", fmt.Errorf("query repo err:%v", err)
	}
	// 搜索相似代码片段
	results, err := qa.indexer.SearchCode(ctx, repo, req.GetQuestion())
	if err != nil {
		return "", fmt.Errorf("indexer search code %s err:%v", req.GetQuestion(), err)
	}
	// 生成自然语言回答
	var contents []string
	for _, result := range results {
		contents = append(contents, result.Content)
	}
	answer, err := qa.generateAnswer(ctx, req.GetQuestion(), contents)
	if err != nil {
		return "", err
	}
	return answer, nil
}

func (qa *QAEngine) generateAnswer(ctx context.Context, question string, contexts []string) (string, error) {
	prompt := fmt.Sprintf(`基于以下代码片段回答问题：
%s

问题：%s
答案：`, strings.Join(contexts, "\n\n"), question)
	resp, err := qa.llm.Completions(ctx, llm.ChatRequest{
		Model: GetLLMModel(),
		Messages: []llm.Message{
			{Role: "user", Content: prompt},
		},
		MaxTokens: 0,
	})
	if err != nil {
		return "", err
	}
	return resp.Choices[0].Message.Content, nil
}
