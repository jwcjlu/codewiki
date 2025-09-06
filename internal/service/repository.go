package service

import (
	"codewiki/internal/biz/model"
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

func (service *RepositoryService) CreateRepo(ctx context.Context, req *v1.CreateRepoReq) (*v1.CreateRepoResp, error) {
	result := new(v1.CreateRepoResp)
	var codeRepo model.CodeRepository
	err := copier.Copy(&codeRepo, req)
	if err != nil {
		return result, err
	}
	if req.RepoType == v1.RepoType_Github {
		codeRepo.RemotePath = req.Path
	} else {
		codeRepo.LocalPath = req.Path
	}
	err = service.repositoryBiz.CreateRepository(ctx, &codeRepo)
	if err != nil {
		return result, err
	}
	return result, nil
}
func (service *RepositoryService) ListRepos(ctx context.Context, req *v1.ListRepoReq) (*v1.ListRepoResp, error) {
	result := new(v1.ListRepoResp)
	projectEntities, err := service.repositoryBiz.ListRepositories(ctx)
	if err != nil {
		return result, err
	}
	var projects []*v1.Repo
	err = copier.Copy(&projects, projectEntities)
	if err != nil {
		return result, err
	}
	result.Body = &v1.ListRepoResp_Result{
		Repo: projects,
	}
	return result, nil
}
func (service *RepositoryService) GetRepo(ctx context.Context, req *v1.GetRepoReq) (*v1.GetRepoResp, error) {
	result := new(v1.GetRepoResp)
	entity, err := service.repositoryBiz.GetRepository(ctx, req.GetId())
	if err != nil {
		return result, err
	}
	var target v1.Repo
	err = copier.Copy(&target, entity)
	if err != nil {
		return result, err
	}
	result.Body = &v1.GetRepoResp_Result{
		Repo: &target,
	}
	return result, nil
}
func (service *RepositoryService) DeleteRepo(ctx context.Context, req *v1.DeleteRepoReq) (*v1.DeleteRepoResp, error) {
	result := new(v1.DeleteRepoResp)
	err := service.repositoryBiz.DeleteRepository(ctx, req.GetId())
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
