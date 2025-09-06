package biz

import (
	"codewiki/internal/biz/model"
	"codewiki/internal/conf"
	"codewiki/internal/pkg/log"
	"context"
	"fmt"
	"os"
	"path/filepath"
)

type CodeAnalyzer struct {
	indexer        *Indexer
	codeRepo       CodeRepo
	entityRepo     EntityRepo
	repositoryRepo RepositoryRepo
	repoDir        string
}

func NewCodeAnalyzer(codeRepo CodeRepo,
	repositoryRepo RepositoryRepo,
	entityRepo EntityRepo,
	indexer *Indexer, data *conf.Data) *CodeAnalyzer {
	repoDir := data.RepoDir
	if len(repoDir) < 1 {
		repoDir = filepath.Join(os.TempDir(), "codewiki", "repository")
	}
	if err := os.MkdirAll(repoDir, os.ModePerm); err != nil {
		panic(fmt.Errorf("newCodeAnalyzer failure  err:[%v]", err))
	}
	return &CodeAnalyzer{codeRepo: codeRepo,
		repositoryRepo: repositoryRepo,
		entityRepo:     entityRepo,
		indexer:        indexer,
		repoDir:        repoDir,
	}
}
func (c *CodeAnalyzer) QueryCallChain(ctx context.Context, id string) ([]*model.CallRelation, error) {
	return c.codeRepo.QueryCallRelations(ctx, id, 0)

}

func (c *CodeAnalyzer) ViewFileContent(ctx context.Context, projectId, id string) (*model.FileContent, error) {
	cr, err := c.repositoryRepo.GetRepository(ctx, projectId)
	if err != nil {
		return nil, err
	}
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
func (c *CodeAnalyzer) GetImplements(ctx context.Context, entityId string) ([]*model.Entity, error) {
	entities, err := c.codeRepo.GetImplementByEntityId(ctx, entityId)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

func (c *CodeAnalyzer) AnalyzeRepo(ctx context.Context, projectId string, forceUpdate bool) error {
	cr, err := c.repositoryRepo.GetRepository(ctx, projectId)
	if err != nil {
		return err
	}
	codeParse := model.NewCodeParse(cr, c.repoDir)
	root, err := codeParse.ParseCode(ctx)
	if err != nil {
		return err
	}
	if root == nil {
		return nil
	}
	root.ClassifyExtends(ctx)
	root.ClassifyMethod(ctx)
	if err = codeParse.AnalyzeRelations(ctx); err != nil {
		return err
	}
	ctx = context.WithoutCancel(ctx)
	pkgs := codeParse.GetPackages()
	if err = c.entityRepo.SavePackages(ctx, pkgs); err != nil {
		return err
	}

	if err = c.entityRepo.SaveFiles(ctx, codeParse.GetFiles()); err != nil {
		return err
	}

	if err = c.entityRepo.SaveEntities(ctx, codeParse.GetEntities()); err != nil {
		return err
	}
	if err = c.entityRepo.SaveFields(ctx, codeParse.GetFields()); err != nil {
		return err
	}
	if err = c.codeRepo.SaveFunctions(ctx, codeParse.GetFunctions()); err != nil {
		return err
	}
	go func() {
		if !forceUpdate {
			log.Info(ctx, "Already indexed ")
			return
		}
		if err = c.indexer.Indexer(ctx, codeParse); err != nil {
			log.Errorf(ctx, "indexer.Indexer err:%v", err)
		} else {
			log.Info(ctx, "indexer.Indexer succ")
		}
	}()
	if err = c.repositoryRepo.UpdateRepository(ctx, cr); err != nil {
		return err
	}
	return c.codeRepo.SaveRelations(ctx, codeParse.Relations)
}
