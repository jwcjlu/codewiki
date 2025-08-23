package biz

import (
	"codewiki/internal/biz/model"
	"codewiki/internal/pkg/log"
	"context"
)

type RepositoryBiz struct {
	indexer     *Indexer
	codeRepo    CodeRepo
	entityRepo  EntityRepo
	projectRepo ProjectRepo
}

func NewRepositoryBiz(indexer *Indexer, codeRepo CodeRepo, entityRepo EntityRepo, projectRepo ProjectRepo) *RepositoryBiz {
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
	projectEntity, err := c.projectRepo.GetProject(ctx, projectId)
	if err != nil {
		return err
	}
	targetPath := projectEntity.Target
	if len(projectEntity.Path) > 0 {
		targetPath = projectEntity.Path
	}
	project := model.NewProject(projectEntity)
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
	ctx = context.WithoutCancel(ctx)
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
	go func() {
		if err = c.indexer.Indexer(ctx, project); err != nil {
			log.Errorf(ctx, "indexer.Indexer err:%v", err)
		} else {
			log.Info(ctx, "indexer.Indexer succ")
		}
	}()
	return c.codeRepo.SaveRelations(ctx, project.Relations)
}
