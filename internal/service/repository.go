package service

import (
	"context"

	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"

	"github.com/jinzhu/copier"
)

type RepositoryService struct {
	v1.UnimplementedRepoServiceServer
	repositoryBiz *biz.RepositoryBiz
}

func NewRepositoryService(repositoryBiz *biz.RepositoryBiz) *RepositoryService {
	return &RepositoryService{repositoryBiz: repositoryBiz}
}
func (service *RepositoryService) CallChain(ctx context.Context, req *v1.CallChainReq) (*v1.CallChainResp, error) {
	result := new(v1.CallChainResp)
	callChain, err := service.repositoryBiz.QueryCallChain(ctx, req.GetId())
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
func (service *RepositoryService) AnalyzeRepo(ctx context.Context, req *v1.AnalyzeRepoReq) (*v1.AnalyzeResp, error) {
	result := new(v1.AnalyzeResp)
	err := service.repositoryBiz.AnalyzeRepo(ctx, req.GetId())
	if err != nil {
		return result, err
	}
	return result, nil
}
func (service *RepositoryService) GetRepoTree(ctx context.Context, req *v1.GetRepoTreeReq) (*v1.GetRepoTreeResp, error) {
	result := new(v1.GetRepoTreeResp)
	pkgs, files, err := service.repositoryBiz.GetRepoTree(ctx, req.GetId())
	if err != nil {
		return result, err
	}
	result.Body = &v1.GetRepoTreeResp_Result{}
	for _, pkg := range pkgs {
		result.Body.Packages = append(result.Body.Packages, &v1.PackageNode{
			Id:       pkg.ID,
			Name:     pkg.Name,
			ParentId: pkg.ParentID,
		})
	}
	for _, file := range files {
		result.Body.Files = append(result.Body.Files, &v1.FileNode{
			Id:    file.ID,
			Name:  file.Name,
			PkgId: file.PkgID,
		})
	}
	return result, nil
}
func (service *RepositoryService) ViewFileContent(ctx context.Context, req *v1.ViewFileReq) (*v1.ViewFileResp, error) {
	result := new(v1.ViewFileResp)
	fc, err := service.repositoryBiz.ViewFileContent(ctx, req.GetRepoId(), req.GetId())
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
func (service *RepositoryService) GetImplement(ctx context.Context, req *v1.GetImplementReq) (*v1.GetImplementResp, error) {
	result := new(v1.GetImplementResp)
	implements, err := service.repositoryBiz.GetImplements(ctx, req.GetId())
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
