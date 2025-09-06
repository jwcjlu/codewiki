package llm

import (
	"codewiki/internal/pkg/sse"
	"context"
	"fmt"
	"github.com/sashabaranov/go-openai"
	"io"
	"time"
)

// StreamRecv 定义流式接收接口
type StreamReceive[T any] interface {
	Recv() (response T, err error)
	Close() error
}

// StreamDataHandler 处理流式数据
type StreamDataHandler[T any] struct {
	streamReceive StreamReceive[T]
	receive       chan sse.Message
}

// NewStreamDataHandler 创建新的流式数据处理器
func NewStreamDataHandler[T openai.ChatCompletionStreamResponse](stream StreamReceive[T], receive chan sse.Message) *StreamDataHandler[T] {
	return &StreamDataHandler[T]{
		streamReceive: stream,
		receive:       receive,
	}
}

// HandleStreamData 处理流式数据
func (handler *StreamDataHandler[T]) HandleStreamData(ctx context.Context) (err error) {
	index := 0
	// 设置写入超时
	readerTimeout := time.NewTimer(sse.SSEReadTimeout)
	defer func() {
		readerTimeout.Stop()

	}()
	for {
		select {
		case <-ctx.Done():
			// 上下文取消
			handler.receive <- &StreamResponse{
				IsComplete:  true,
				IsStreaming: true,
				Err:         ctx.Err().Error(),
			}
			return ctx.Err()
		case <-readerTimeout.C:
			// 写入超时
			handler.receive <- &StreamResponse{
				IsComplete:  true,
				IsStreaming: true,
				Err:         "read timeout",
			}
			err = fmt.Errorf(" read timeout")
			return
		default:
			response, err := handler.streamReceive.Recv()
			if err == io.EOF {
				// 流结束
				handler.receive <- &StreamResponse{
					IsComplete:  true,
					IsStreaming: true,
				}
				return nil
			}
			if err != nil {
				// 发生错误
				handler.receive <- &StreamResponse{
					IsComplete:  false,
					IsStreaming: true,
					Err:         err.Error(),
				}
				return err
			}

			// 类型断言获取内容
			var content string
			switch v := any(response).(type) {
			case openai.ChatCompletionStreamResponse:
				content = v.Choices[0].Delta.Content
			default:
				// 处理其他类型或返回错误
				handler.receive <- &StreamResponse{
					IsComplete:  true,
					IsStreaming: true,
					Err:         "unsupported response type",
				}
				return nil
			}

			// 发送数据块
			handler.receive <- &StreamResponse{
				IsComplete:  false,
				Chunk:       content,
				ChunkIndex:  int32(index),
				IsStreaming: true,
			}
			readerTimeout.Reset(sse.SSEReadTimeout)
			index++
		}
	}
}

// Close 关闭处理器
func (handler *StreamDataHandler[T]) Close() {
	if handler.receive != nil {
		close(handler.receive)
	}
	if handler.streamReceive != nil {
		_ = handler.streamReceive.Close()
	}
}
