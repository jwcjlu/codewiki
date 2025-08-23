package biz

import (
	"codewiki/internal/biz/model"
	"context"
)

type ProjectBiz struct {
	projectRepo ProjectRepo
}

func NewProjectBiz(projectRepo ProjectRepo) *ProjectBiz {
	return &ProjectBiz{projectRepo: projectRepo}
}
func (project *ProjectBiz) CreateProject(ctx context.Context, entity *model.ProjectEntity) error {
	return project.projectRepo.CreateProject(ctx, entity)
}
func (project *ProjectBiz) ListProjects(ctx context.Context) ([]*model.ProjectEntity, error) {
	return project.projectRepo.ListProjects(ctx)
}
func (project *ProjectBiz) GetProject(ctx context.Context, projectId string) (*model.ProjectEntity, error) {
	return project.projectRepo.GetProject(ctx, projectId)
}
func (project *ProjectBiz) DeleteProject(ctx context.Context, projectId string) error {
	return project.projectRepo.DeleteProject(ctx, projectId)
}
