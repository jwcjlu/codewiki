package service

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"
	"codewiki/internal/pkg/llm"
	"codewiki/internal/pkg/sse"
	"context"
	"net/http"
)

type QAService struct {
	engine *biz.QAEngine
}

func NewQAService(engine *biz.QAEngine) *QAService {
	return &QAService{engine: engine}
}
func (ah *QAService) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	serverSendEvent := sse.NewServerSendEvent(w, r)
	if err := serverSendEvent.SetSSEHeaders(); err != nil {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}
	var req v1.AnswerReq
	if err := serverSendEvent.Bind(&req); err != nil {
		http.Error(w, "SSE bad request", http.StatusInternalServerError)
	}
	resp := make(chan *llm.StreamResponse)

	err := ah.engine.Answer(context.Background(), &req, serverSendEvent.ReceiveMessage())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	defer func() {
		close(resp)

	}()
	if err = serverSendEvent.HandleSSEResponse(context.Background()); err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}
