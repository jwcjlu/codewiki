package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/pkg/sse"
	"context"
	"fmt"
	"strings"
	"text/template"

	"codewiki/internal/pkg/llm"
)

type QAEngine struct {
	llm            *llm.LLM
	indexer        *Indexer
	repo           CodeRepo
	repositoryRepo RepositoryRepo
}

func NewQAEngine(llm *llm.LLM, indexer *Indexer, repo CodeRepo, repositoryRepo RepositoryRepo) *QAEngine {
	return &QAEngine{llm: llm, indexer: indexer, repo: repo, repositoryRepo: repositoryRepo}
}
func (qa *QAEngine) Answer(ctx context.Context, req *v1.AnswerReq, resp chan sse.Message) error {
	repo, err := qa.repositoryRepo.GetRepository(ctx, req.GetId())
	if err != nil {
		return fmt.Errorf("query repo err:%v", err)
	}
	// 搜索相似代码片段
	results, err := qa.indexer.SearchCode(ctx, repo, req.GetQuestion())
	if err != nil {
		return fmt.Errorf("indexer search code %s err:%v", req.GetQuestion(), err)
	}

	chains, err := qa.repo.QueryCallRelations(ctx, results[0].Id, 4)
	if err != nil {
		return fmt.Errorf("query call chain err:%v", err)
	}
	var ids []string
	for _, chain := range chains {
		ids = append(ids, chain.CalleeId)
	}
	results, err = qa.indexer.repo.SearchCodeChunkByIds(ctx, repo.Name, ids, 200)
	if err != nil {
		return fmt.Errorf("search code chunk err:%v", err)
	}
	// 生成自然语言回答
	var contents []string
	for _, result := range results {
		contents = append(contents, result.Content)
	}
	return qa.generateAnswer(ctx, req.GetQuestion(), contents, resp)

}

const tmplPrompt = `
你是一个资深的代码助手。请严格根据以下来自代码库的上下文信息来回答问题。
如果你不知道答案，就说不知道，不要编造信息。

上下文代码片段：
{{range .Items}}
'''
 {{.}}
'''
{{end}}

用户问题：{{.UserQuestion}}

请根据上述上下文给出准确的回答：
`

func (qa *QAEngine) generateAnswer(ctx context.Context,
	question string,
	contexts []string,
	receive chan sse.Message) error {

	data := struct {
		Items        []string
		UserQuestion string
	}{
		Items:        contexts,
		UserQuestion: question,
	}
	var sb strings.Builder
	tmpl := template.Must(template.New("prompt").Parse(tmplPrompt))

	err := tmpl.Execute(&sb, data)
	if err != nil {
		return err
	}
	prompt := sb.String()
	go func() {
		qa.llm.CompletionStream(ctx, llm.ChatRequest{
			Model: GetLLMModel(),
			Messages: []llm.Message{
				{Role: "user", Content: prompt},
			},
		}, receive)
	}()

	return nil
}
