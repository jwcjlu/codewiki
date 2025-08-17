package service

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/gorilla/mux"
)

// CodeWikiService is a DeepWiki service.
type CodeWikiService struct {
	v1.UnimplementedCodeWikiServiceServer
	codeWiki *biz.CodeWiki
	qa       *biz.QAEngine
}

// NewCodeWikiService new a CodeWiki service.
func NewCodeWikiService(codeWiki *biz.CodeWiki, qa *biz.QAEngine) *CodeWikiService {
	return &CodeWikiService{codeWiki: codeWiki, qa: qa}
}

func (s *CodeWikiService) CallChain(ctx context.Context, req *v1.CallChainReq) (*v1.CallChainResp, error) {
	resp := new(v1.CallChainResp)
	callRelations, err := s.codeWiki.QueryCallChain(ctx, req.Id)
	if err != nil {
		resp.Code = 1000
		resp.Msg = err.Error()
		return resp, err
	}
	resp.CallRelations = callRelations
	return resp, nil
}

func (s *CodeWikiService) CreateRepo(ctx context.Context, req *v1.CreateRepoReq) (*v1.CreateRepoResp, error) {
	id, err := s.codeWiki.CreateRepo(ctx, req)
	if err != nil {
		return &v1.CreateRepoResp{}, err
	}
	return &v1.CreateRepoResp{Id: id}, nil
}

func (s *CodeWikiService) ListRepos(ctx context.Context, req *v1.ListReposReq) (*v1.ListReposResp, error) {
	repos, err := s.codeWiki.ListRepos(ctx)
	if err != nil {
		return &v1.ListReposResp{}, err
	}
	return &v1.ListReposResp{Repos: repos}, nil
}

func (s *CodeWikiService) GetRepo(ctx context.Context, req *v1.GetRepoReq) (*v1.GetRepoResp, error) {
	repo, err := s.codeWiki.GetRepo(ctx, req.Id)
	if err != nil {
		return &v1.GetRepoResp{}, err
	}
	return &v1.GetRepoResp{Repo: repo}, nil
}

func (s *CodeWikiService) DeleteRepo(ctx context.Context, req *v1.DeleteRepoReq) (*v1.DeleteRepoResp, error) {
	if err := s.codeWiki.DeleteRepo(ctx, req.Id); err != nil {
		return &v1.DeleteRepoResp{}, err
	}
	return &v1.DeleteRepoResp{}, nil
}

func (s *CodeWikiService) AnalyzeRepo(ctx context.Context, req *v1.AnalyzeRepoReq) (*v1.AnalyzeResp, error) {
	resp := new(v1.AnalyzeResp)
	err := s.codeWiki.AnalyzeRepo(ctx, req.Id)
	if err != nil {
		resp.Code = 1000
		resp.Msg = err.Error()
		return resp, err
	}
	return resp, nil
}

func (s *CodeWikiService) GetRepoTree(ctx context.Context, req *v1.GetRepoTreeReq) (*v1.GetRepoTreeResp, error) {
	pkgs, files, err := s.codeWiki.GetRepoTree(ctx, req.Id)
	if err != nil {
		return &v1.GetRepoTreeResp{}, err
	}
	return &v1.GetRepoTreeResp{Packages: pkgs, Files: files}, nil
}
func (s *CodeWikiService) ViewFileContent(ctx context.Context, req *v1.ViewFileReq) (*v1.ViewFileResp, error) {
	fileContent, err := s.codeWiki.ViewFileContent(ctx, req)
	if err != nil {
		return &v1.ViewFileResp{}, err
	}
	return &v1.ViewFileResp{
		Content:   fileContent.Content,
		Language:  fileContent.Language,
		Functions: fileContent.Functions,
	}, err
}

func (s *CodeWikiService) GetImplement(ctx context.Context, req *v1.GetImplementReq) (*v1.GetImplementResp, error) {
	resp := new(v1.GetImplementResp)
	entities, err := s.codeWiki.GetImplements(ctx, req.GetId())
	if err != nil {
		return resp, err
	}
	resp.Entities = entities
	return resp, nil
}

type AnswerHandler struct {
	s *CodeWikiService
}

func NewAnswerHandler(s *CodeWikiService) *AnswerHandler {
	return &AnswerHandler{s: s}
}
func (ah *AnswerHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}
	raws := mux.Vars(r)
	vars := make(url.Values, len(raws))
	for k, v := range raws {
		vars[k] = []string{v}
	}
	values := r.URL.Query()
	question := values.Get("question")
	id := raws["id"]
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	resp := make(chan *v1.AnswerResp)

	err := ah.s.qa.Answer(context.Background(), &v1.AnswerReq{
		Id:       id,
		Question: question,
	}, resp)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	defer func() {
		close(resp)

	}()
	for {
		// 使用SSE格式发送数据
		select {
		case v, isClose := <-resp:
			if !isClose {
				return
			}
			data, err := json.Marshal(v)
			if err != nil {
				continue
			}
			fmt.Println(string(data))
			// 关键修复：使用正确的SSE格式 "data: {json}\n\n"
			_, err = fmt.Fprintf(w, "data: %s\n\n", string(data))
			if err != nil {
				fmt.Println(err)
			}
			flusher.Flush()
			if v.IsComplete {
				return
			}
		}

	}
}
