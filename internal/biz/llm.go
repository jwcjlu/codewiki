package biz

import (
	"codewiki/internal/conf"
	"codewiki/internal/pkg/llm"
)

func NewConfig(data *conf.Data) *llm.Config {
	if data.Llm == nil {
		return &llm.Config{}
	}
	llmModel = LLMModel{
		llmModel:       data.Llm.LlmModelName,
		embeddingModel: data.Llm.LlmModelName,
	}
	return &llm.Config{
		ApiKey:  data.Llm.ApiKey,
		BaseURL: data.Llm.BaseURL,
	}

}

var llmModel LLMModel

type LLMModel struct {
	llmModel       string
	embeddingModel string
}

func GetLLMModel() string {
	if llmModel.llmModel == "" {
		return "deepseek-r1:32b"
	}
	return llmModel.llmModel
}
func GetEmbeddingModel() string {
	if llmModel.embeddingModel == "" {
		return "text-embedding-3-small"
	}
	return llmModel.embeddingModel
}
