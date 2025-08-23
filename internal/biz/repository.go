package biz

import (
	"codewiki/internal/biz/model"
	"context"
)

type RepositoryBiz struct {
	indexer     IndexerRepo
	codeRepo    CodeRepo
	entityRepo  EntityRepo
	projectRepo ProjectRepo
}

func NewRepositoryBiz(indexer IndexerRepo, codeRepo CodeRepo, entityRepo EntityRepo, projectRepo ProjectRepo) *RepositoryBiz {
	return &RepositoryBiz{indexer: indexer, codeRepo: codeRepo, entityRepo: entityRepo, projectRepo: projectRepo}
}
func (c *RepositoryBiz) QueryCallChain(ctx context.Context, id string) ([]*model.CallRelation, error) {
	return c.codeRepo.QueryCallRelations(ctx, id, 0)

}

func (c *RepositoryBiz) GetRepoTree(ctx context.Context, id string) (packages []model.Package, files []model.File, err error) {
	return c.entityRepo.QueryPkgAndFileByProjectId(ctx, id)
}

func (c *RepositoryBiz) ViewFileContent(ctx context.Context, projectId, id string) (*model.FileContent, error) {
	project, err := c.projectRepo.GetProject(ctx, projectId)
	if err != nil {
		return nil, err
	}
	cr := model.CodeRepository{ProjectEntity: project}
	content, err := cr.ReadFile(id)
	if err != nil {
		return nil, err
	}
	functions, err := c.codeRepo.GetFunctionByFileId(ctx, id)
	if err != nil {
		return nil, err
	}
	return &model.FileContent{Content: content, Functions: functions}, nil
}
func (c *RepositoryBiz) GetImplements(ctx context.Context, entityId string) ([]*model.Entity, error) {
	entities, err := c.codeRepo.GetImplementByEntityId(ctx, entityId)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

func (c *RepositoryBiz) AnalyzeRepo(ctx context.Context, projectId string) error {
	repo, err := c.projectRepo.GetProject(ctx, projectId)
	if err != nil {
		return err
	}
	targetPath := repo.Target
	if len(repo.Path) > 0 {
		targetPath = repo.Path
	}
	project := model.NewProject(repo)
	root, err := project.ParseCode(ctx, targetPath)
	if err != nil {
		return err
	}
	if root == nil {
		return nil
	}
	root.ClassifyExtends(ctx)
	root.ClassifyMethod(ctx)
	if err = project.AnalyzeRelations(ctx); err != nil {
		return err
	}

	pkgs := project.GetPackages()
	if err = c.entityRepo.SavePackages(ctx, pkgs); err != nil {
		return err
	}

	if err = c.entityRepo.SaveFiles(ctx, project.GetFiles()); err != nil {
		return err
	}
	if err = c.entityRepo.SaveImports(ctx, project.GetImport()); err != nil {
		return err
	}
	if err = c.entityRepo.SaveEntities(ctx, project.GetEntities()); err != nil {
		return err
	}
	if err = c.entityRepo.SaveFields(ctx, project.GetFields()); err != nil {
		return err
	}
	if err = c.codeRepo.SaveFunctions(ctx, project.GetFunctions()); err != nil {
		return err
	}
	return c.codeRepo.SaveRelations(ctx, project.Relations)
}
