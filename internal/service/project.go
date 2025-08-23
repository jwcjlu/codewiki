package service

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"
	"codewiki/internal/biz/model"
	"context"
	"github.com/jinzhu/copier"
)

type ProjectService struct {
	v1.UnimplementedProjectServiceServer
	projectBiz    *biz.ProjectBiz
	repositoryBiz *biz.RepositoryBiz
}

func NewProjectService(projectBiz *biz.ProjectBiz, repositoryBiz *biz.RepositoryBiz) *ProjectService {
	return &ProjectService{projectBiz: projectBiz, repositoryBiz: repositoryBiz}
}
func (project *ProjectService) CreateProject(ctx context.Context, req *v1.CreateProjectReq) (*v1.CreateProjectResp, error) {
	result := new(v1.CreateProjectResp)
	var projectEntity model.ProjectEntity
	err := copier.Copy(&projectEntity, req)
	if err != nil {
		return result, err
	}
	err = project.projectBiz.CreateProject(ctx, &projectEntity)
	if err != nil {
		return result, err
	}
	return result, nil
}
func (project *ProjectService) ListProjects(ctx context.Context, req *v1.ListProjectReq) (*v1.ListProjectResp, error) {
	result := new(v1.ListProjectResp)
	projectEntities, err := project.projectBiz.ListProjects(ctx)
	if err != nil {
		return result, err
	}
	var projects []*v1.Project
	err = copier.Copy(&projects, projectEntities)
	if err != nil {
		return result, err
	}
	result.Body = &v1.ListProjectResp_Result{
		Project: projects,
	}
	return result, nil
}
func (project *ProjectService) GetProject(ctx context.Context, req *v1.GetProjectReq) (*v1.GetProjectResp, error) {
	result := new(v1.GetProjectResp)
	entity, err := project.projectBiz.GetProject(ctx, req.GetId())
	if err != nil {
		return result, err
	}
	var target v1.Project
	err = copier.Copy(&target, entity)
	if err != nil {
		return result, err
	}
	result.Body = &v1.GetProjectResp_Result{
		Project: &target,
	}
	return result, nil
}
func (project *ProjectService) DeleteProject(ctx context.Context, req *v1.DeleteProjectReq) (*v1.DeleteProjectResp, error) {
	result := new(v1.DeleteProjectResp)
	err := project.projectBiz.DeleteProject(ctx, req.GetId())
	if err != nil {
		return result, err
	}
	return result, nil
}
