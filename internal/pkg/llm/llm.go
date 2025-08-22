package llm

import (
	"bytes"
	"codewiki/internal/pkg/sse"
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

func (llm *LLM) Enable() bool {
	return llm.client != nil
}
func (llm *LLM) Completions(ctx context.Context, chatReq ChatRequest) (*ChatResponse, error) {
	// 调用API
	resp, err := llm.client.CreateChatCompletion(
		context.WithoutCancel(ctx),
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
func (llm *LLM) CompletionStream(ctx context.Context, chatReq ChatRequest, receive chan sse.Message) error {
	// 调用API
	stream, err := llm.client.CreateChatCompletionStream(
		context.WithoutCancel(ctx),
		chatReq.ChatRequest(),
	)
	if err != nil {
		close(receive)
		return err
	}

	defer func() {
		stream.Close()
		close(receive)
	}()

	index := 0
	for {
		select {
		case <-ctx.Done():
			// 上下文取消
			select {
			case receive <- &StreamMessage{
				messageType: "complete",
				data: map[string]interface{}{
					"chunk_index": index,
				},
				isComplete: true,
			}:
			default:
			}
			return ctx.Err()

		default:
			// 接收响应
			response, err := stream.Recv()
			if err == io.EOF {
				// 流结束
				select {
				case receive <- &StreamMessage{
					messageType: "complete",
					data: map[string]interface{}{
						"chunk_index": index,
					},
					isComplete: true,
				}:
				default:
				}
				return nil
			}

			if err != nil {
				// 接收错误
				select {
				case receive <- &StreamMessage{
					messageType: "error",
					data: map[string]interface{}{
						"chunk_index": index,
					},
					error:      err.Error(),
					isComplete: true,
				}:
				default:
				}
				return fmt.Errorf("stream receive error: %w", err)
			}

			// 检查响应是否有效
			if response.Choices == nil || len(response.Choices) == 0 {
				continue
			}

			// 发送数据块
			content := ""
			if response.Choices[0].Delta.Content != "" {
				content = response.Choices[0].Delta.Content
			}

			select {
			case receive <- &StreamMessage{
				messageType: "data",
				data: map[string]interface{}{
					"chunk":       content,
					"chunk_index": index,
				},
				isComplete: false,
			}:
				index++
			default:
				// 通道已满，跳过
			}
		}
	}
}

// StreamMessage 实现sse.Message接口
type StreamMessage struct {
	messageType string
	data        map[string]interface{}
	error       string
	isComplete  bool
}

func (sm *StreamMessage) Complete() bool {
	return sm.isComplete
}

func (sm *StreamMessage) Data() []byte {
	if sm.data == nil {
		return []byte("{}")
	}

	// 根据消息类型构建不同的数据结构
	var responseData map[string]interface{}

	switch sm.messageType {
	case "complete":
		responseData = map[string]interface{}{
			"is_complete": true,
			"chunk_index": sm.data["chunk_index"],
		}
	case "error":
		responseData = map[string]interface{}{
			"error":       sm.error,
			"chunk_index": sm.data["chunk_index"],
		}
	case "data":
		responseData = map[string]interface{}{
			"chunk":        sm.data["chunk"],
			"chunk_index":  sm.data["chunk_index"],
			"is_streaming": true,
			"is_complete":  false,
		}
	default:
		responseData = sm.data
	}

	jsonData, err := json.Marshal(responseData)
	if err != nil {
		return []byte("{}")
	}
	return jsonData
}

func (sm *StreamMessage) Error() string {
	return sm.error
}
func (llm *LLM) Embeddings(ctx context.Context, embeddingRequest EmbeddingRequest) (*EmbeddingResponse, error) {
	url := fmt.Sprintf("%s/embeddings", llm.BaseURL)

	jsonBody, _ := json.Marshal(embeddingRequest)

	// 创建HTTP请求
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+llm.ApiKey)

	resp, err := llm.httpClient.Do(req)
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
