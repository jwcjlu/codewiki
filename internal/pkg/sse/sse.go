package sse

import (
	"context"
	"fmt"
	"github.com/go-kratos/kratos/v2/transport/http/binding"
	"google.golang.org/protobuf/proto"
	"net/http"
	"net/url"
	"time"

	"github.com/gorilla/mux"
)

type Message interface {
	Complete() bool
	Data() []byte
	Error() string
}

// SSE配置常量
const (
	SSEReadTimeout  = 10 * time.Second
	SSEWriteTimeout = 10 * time.Second
)

type ServerSendEvent struct {
	w       http.ResponseWriter
	r       *http.Request
	message chan Message
}

func (sse *ServerSendEvent) ReceiveMessage() chan Message {
	return sse.message
}
func NewServerSendEvent(w http.ResponseWriter, r *http.Request) *ServerSendEvent {
	return &ServerSendEvent{w: w, r: r, message: make(chan Message)}
}

// SetSSEHeaders 设置SSE响应头
func (sse *ServerSendEvent) SetSSEHeaders() error {
	headers := map[string]string{
		"Content-Type":                 "text/event-stream",
		"Cache-Control":                "no-cache, no-store, must-revalidate",
		"Connection":                   "keep-alive",
		"Access-Control-Allow-Methods": "GET",
		"Access-Control-Allow-Headers": "Cache-Control",
	}

	for key, value := range headers {
		sse.w.Header().Set(key, value)
	}

	// 检查是否支持SSE
	if _, ok := sse.w.(http.Flusher); !ok {
		return fmt.Errorf("SSE not supported by this connection")
	}

	return nil
}

func (sse *ServerSendEvent) Bind(message proto.Message) error {
	query := sse.r.URL.Query()
	if binding.BindQuery(query, message) != nil {
		return fmt.Errorf("SSE binding failed")
	}
	raws := mux.Vars(sse.r)
	vars := make(url.Values, len(raws))
	for k, v := range raws {
		vars[k] = []string{v}
	}
	return binding.BindQuery(vars, message)
}

// HandleSSEResponse 处理SSE流式响应
func (sse *ServerSendEvent) HandleSSEResponse(ctx context.Context) (err error) {

	// 设置写入超时
	writeTimeout := time.NewTimer(SSEWriteTimeout)
	defer func() {
		writeTimeout.Stop()
		if err != nil {
			sse.w.WriteHeader(500)
		}
	}()
	flusher := sse.w.(http.Flusher)
	for {
		select {
		case <-ctx.Done():
			// 上下文取消（超时或客户端断开）
			err = ctx.Err()
			return

		case <-writeTimeout.C:
			// 写入超时
			err = fmt.Errorf("SSE write timeout")
			return

		case msg, ok := <-sse.message:
			if !ok {
				// 通道关闭，发送完成事件
				err = sse.sendSSEEvent("complete")
				if err != nil {
					return
				}
				flusher.Flush()
				return nil
			}
			// 处理响应数据
			if err = sse.processResponse(msg, flusher); err != nil {
				// 发送错误事件但继续处理
				return err

			}

			// 重置写入超时
			writeTimeout.Reset(SSEWriteTimeout)

		}
	}
}

// processResponse 处理单个响应
func (sse *ServerSendEvent) processResponse(msg Message, flusher http.Flusher) error {
	// 验证响应数据
	if msg == nil {
		return fmt.Errorf("nil response received")
	}

	// 检查错误
	if msg.Error() != "" {
		return fmt.Errorf(" response error: %s", msg.Error())
	}

	if err := sse.sendSSEEvent(string(msg.Data())); err != nil {
		return fmt.Errorf("failed to send data event: %w", err)
	}

	flusher.Flush()
	return nil
}

// sendSSEEvent 发送SSE事件
func (sse *ServerSendEvent) sendSSEEvent(data string) error {

	// 发送SSE格式数据
	_, err := fmt.Fprintf(sse.w, "data: %s\n\n", data)
	if err != nil {
		return fmt.Errorf("failed to write SSE data: %w", err)
	}
	if flusher, ok := sse.w.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}
