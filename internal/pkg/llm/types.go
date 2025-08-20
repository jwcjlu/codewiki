package llm

import (
	"encoding/json"
	"github.com/sashabaranov/go-openai"
)

// EmbeddingRequest 嵌入请求
type EmbeddingRequest struct {
	Model string `json:"model"`
	Input string `json:"input"`
}

// EmbeddingResponse 嵌入响应
type EmbeddingResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
}

// Message 聊天消息
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse 聊天响应

// Choice 聊天选项
type Choice struct {
	Message Message `json:"message"`
}

// ImageRequest 图像生成请求
type ImageRequest struct {
	Prompt string `json:"prompt"`
	N      int    `json:"n"`
	Size   string `json:"size"`
	Model  string `json:"model"`
}

// ImageResponse 图像生成响应
type ImageResponse struct {
	Data []ImageData `json:"data"`
}

// ImageData 图像数据
type ImageData struct {
	URL string `json:"url"`
}

// FunctionAnalysis 函数分析结果
type FunctionAnalysis struct {
	Description string    `json:"description"`
	Inputs      []string  `json:"inputs"`
	Outputs     []string  `json:"outputs"`
	Logic       string    `json:"logic"`
	Embedding   []float64 `json:"embedding"`
	ImageURL    string    `json:"image_url,omitempty"`
}
type CommentRequest struct {
	Code        string `json:"code"`
	Language    string `json:"language"`     // 如 "go", "python"
	Style       string `json:"style"`        // 如 "google", "doxygen"
	DetailLevel string `json:"detail_level"` // 如 "minimal", "high"
}

type CommentResponse struct {
	Comments string `json:"comments"`
	Error    string `json:"error,omitempty"`
}

// DeepSeekRequest 定义发送到DeepSeek API的请求结构
type DeepSeekRequest struct {
	Code     string `json:"code"`
	Language string `json:"language"`
	Task     string `json:"task"` // "summarize", "explain", "analyze"等
}

// DeepSeekResponse 定义从DeepSeek API返回的响应结构
type DeepSeekResponse struct {
	Analysis string `json:"analysis"`
	Summary  string `json:"summary"`
	Error    string `json:"error,omitempty"`
}
type ChatRequest struct {
	Model     string    `json:"model"`
	Messages  []Message `json:"messages"`
	MaxTokens int       `json:"max_tokens,omitempty"`
}

func (cr *ChatRequest) ChatRequest() openai.ChatCompletionRequest {
	return openai.ChatCompletionRequest{
		Model: cr.Model, // 指定模型
		Messages: func(msgs []Message) []openai.ChatCompletionMessage {
			var completions []openai.ChatCompletionMessage
			for _, msg := range msgs {
				completions = append(completions, openai.ChatCompletionMessage{
					Role:    msg.Role,
					Content: msg.Content,
				})
			}
			return completions
		}(cr.Messages),
		Temperature: 0.3, // 降低随机性
	}

}

type ChatResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

type ChatResponseStreamReceive struct {
	Chunk    chan StreamResponse
	isClosed bool
}

func (cr *ChatResponseStreamReceive) IsClose() bool {
	return cr.isClosed
}
func (cr *ChatResponseStreamReceive) Close() {
	cr.isClosed = true
}
func NewChatResponseStreamReceive() *ChatResponseStreamReceive {
	return &ChatResponseStreamReceive{Chunk: make(chan StreamResponse)}
}

type StreamResponse struct {
	IsStreaming bool   `json:"is_streaming"`
	Chunk       string `json:"chunk"`
	Err         string `json:"error,omitempty"`
	IsComplete  bool   `json:"is_complete"`
	ChunkIndex  int32  `json:"chunk_index"`
}

func (sr *StreamResponse) Complete() bool {
	return sr.IsComplete
}
func (sr *StreamResponse) Data() []byte {
	data, _ := json.Marshal(sr)
	return data
}
func (sr *StreamResponse) Error() string {
	return sr.Err
}
