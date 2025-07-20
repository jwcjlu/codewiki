package service

import (
	"context"

	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"
)

// CodeWikiService is a DeepWiki service.
type CodeWikiService struct {
	v1.UnimplementedCodeWikiServiceServer
	codeWiki *biz.CodeWiki
}

// NewCodeWikiService new a CodeWiki service.
func NewCodeWikiService(codeWiki *biz.CodeWiki) *CodeWikiService {
	return &CodeWikiService{codeWiki: codeWiki}
}

// Analyze implements codewiki.DeepWikiServiceServer.
func (s *CodeWikiService) Analyze(ctx context.Context, in *v1.AnalyzeReq) (*v1.AnalyzeResp, error) {
	resp := new(v1.AnalyzeResp)
	err := s.codeWiki.Analyze(ctx, in)
	if err != nil {
		resp.Code = 1000
		resp.Msg = err.Error()
		return resp, err
	}
	return resp, nil
}
