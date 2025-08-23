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

/*func (project *ProjectBiz) Analyze(ctx context.Context, rootPath string) error {
	root, err := p.ParseCode(ctx, rootPath)
	if err != nil {
		return v1.ErrorParseCodeError("parseCode failure ").WithCause(err)
	}
	p.pkgs[root.ID] = root
	root.ClassifyExtends(ctx)
	root.ClassifyMethod(ctx)
	p.Root = root
	if err = p.AnalyzeRelations(ctx); err != nil {
		return err
	}
	p.AnalyzeInterfaceImplRelations(ctx)
	for _, pkg := range p.pkgs {
		go p.indexer.Indexer(ctx, pkg, p.Project)
	}
	return projectRepo.SaveProject(ctx, p)
	return nil
}
*/
