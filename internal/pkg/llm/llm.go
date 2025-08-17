package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/sashabaranov/go-openai"
	"io"
	"net/http"
)

type LLM struct {
	client *openai.Client
	*Config
	httpClient *http.Client
}

type Config struct {
	ApiKey  string
	BaseURL string
}

func (config *Config) Enable() bool {
	return len(config.ApiKey) > 0 && len(config.BaseURL) > 0
}
func NewLLM(llmConfig *Config) *LLM {
	if llmConfig == nil || !llmConfig.Enable() {
		return &LLM{}
	}
	config := openai.DefaultConfig(llmConfig.ApiKey)
	config.BaseURL = llmConfig.BaseURL
	return &LLM{client: openai.NewClientWithConfig(config), httpClient: http.DefaultClient, Config: llmConfig}
}

func (client *LLM) Enable() bool {
	return client.client != nil
}
func (client *LLM) Completions(ctx context.Context, chatReq ChatRequest) (*ChatResponse, error) {
	// 调用API
	resp, err := client.client.CreateChatCompletion(
		context.Background(),
		chatReq.ChatRequest(),
	)
	if err != nil {
		return nil, err
	}
	if resp.Choices == nil {
		return nil, nil
	}
	response := &ChatResponse{}
	for _, choice := range resp.Choices {
		response.Choices = append(response.Choices, Choice{Message: Message{
			Role:    choice.Message.Role,
			Content: choice.Message.Content,
		}})
	}
	return response, nil
}

func (client *LLM) Embeddings(ctx context.Context, embeddingRequest EmbeddingRequest) (*EmbeddingResponse, error) {
	url := fmt.Sprintf("%s/embeddings", client.BaseURL)

	jsonBody, _ := json.Marshal(embeddingRequest)

	// 创建HTTP请求
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+client.ApiKey)

	resp, err := client.httpClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("embedding failure err:%v", string(body))
	}
	// 解析响应
	var embeddingResp EmbeddingResponse
	err = json.Unmarshal(body, &embeddingResp)
	if err != nil {
		return nil, err
	}
	return &embeddingResp, nil

}
