package biz

import (
	"codewiki/internal/conf"
	"codewiki/internal/pkg/llm"
)

func NewConfig(data *conf.Data) *llm.Config {
	if data.Llm == nil {
		return &llm.Config{}
	}
	model = Model{
		llmModel:       data.Llm.LlmModelName,
		embeddingModel: data.Llm.LlmModelName,
	}
	return &llm.Config{
		ApiKey:  data.Llm.ApiKey,
		BaseURL: data.Llm.BaseURL,
	}

}

var model Model

type Model struct {
	llmModel       string
	embeddingModel string
}

func GetLLMModel() string {
	if model.llmModel == "" {
		return "deepseek-r1:32b"
	}
	return model.llmModel
}
func GetEmbeddingModel() string {
	if model.embeddingModel == "" {
		return "text-embedding-3-small"
	}
	return model.embeddingModel
}
