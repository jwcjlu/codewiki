package service

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"
	"context"
	"github.com/jinzhu/copier"
)

type CodeAnalyzerService struct {
	v1.UnimplementedCodeAnalyzerServiceServer
	codeAnalyzer *biz.CodeAnalyzer
}

func NewCodeAnalyzerService(codeAnalyzer *biz.CodeAnalyzer) *CodeAnalyzerService {
	return &CodeAnalyzerService{codeAnalyzer: codeAnalyzer}
}
func (service *CodeAnalyzerService) AnalyzeRepo(ctx context.Context, req *v1.AnalyzeRepoReq) (*v1.AnalyzeResp, error) {
	result := new(v1.AnalyzeResp)
	err := service.codeAnalyzer.AnalyzeRepo(ctx, req.GetId(), req.GetForceUpdate())
	if err != nil {
		return result, err
	}
	return result, nil
}

func (service *CodeAnalyzerService) ViewFileContent(ctx context.Context, req *v1.ViewFileReq) (*v1.ViewFileResp, error) {
	result := new(v1.ViewFileResp)
	fc, err := service.codeAnalyzer.ViewFileContent(ctx, req.GetRepoId(), req.GetId())
	if err != nil {
		return result, err
	}
	result.Body = &v1.ViewFileResp_Result{}
	result.Body.Content = fc.Content
	result.Body.Language = fc.Language
	var funs []*v1.Function
	err = copier.Copy(&funs, fc.Functions)
	result.Body.Functions = funs
	return result, nil
}
func (service *CodeAnalyzerService) GetImplement(ctx context.Context, req *v1.GetImplementReq) (*v1.GetImplementResp, error) {
	result := new(v1.GetImplementResp)
	implements, err := service.codeAnalyzer.GetImplements(ctx, req.GetId())
	if err != nil {
		return result, err
	}
	var entities []*v1.Entity
	err = copier.Copy(&entities, implements)
	if err != nil {
		return result, err
	}
	result.Body = &v1.GetImplementResp_Result{}
	result.Body.Entities = entities

	return result, nil
}
func (service *CodeAnalyzerService) CallChain(ctx context.Context, req *v1.CallChainReq) (*v1.CallChainResp, error) {
	result := new(v1.CallChainResp)
	callChain, err := service.codeAnalyzer.QueryCallChain(ctx, req.GetId())
	if err != nil {
		return result, err
	}
	var targets []*v1.CallRelationship
	err = copier.Copy(&targets, callChain)
	if err != nil {
		return result, err
	}
	result.Body = &v1.CallChainResp_Result{}
	result.Body.CallRelations = targets
	return result, nil
}
