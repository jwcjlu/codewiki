package biz

import (
	"codewiki/internal/biz/model"
	"context"
)

type RepositoryBiz struct {
	indexer        *Indexer
	codeRepo       CodeRepo
	entityRepo     EntityRepo
	repositoryRepo RepositoryRepo
}

func NewRepositoryBiz(indexer *Indexer,
	codeRepo CodeRepo,
	entityRepo EntityRepo,
	repositoryRepo RepositoryRepo) *RepositoryBiz {

	return &RepositoryBiz{indexer: indexer,
		codeRepo:       codeRepo,
		entityRepo:     entityRepo,
		repositoryRepo: repositoryRepo,
	}
}

func (c *RepositoryBiz) CreateRepository(ctx context.Context, req *model.CodeRepository) error {
	return c.repositoryRepo.CreateRepository(ctx, req)
}
func (c *RepositoryBiz) ListRepositories(ctx context.Context) ([]*model.CodeRepository, error) {
	return c.repositoryRepo.ListRepositories(ctx)
}
func (c *RepositoryBiz) GetRepository(ctx context.Context, id string) (*model.CodeRepository, error) {
	return c.repositoryRepo.GetRepository(ctx, id)
}
func (c *RepositoryBiz) DeleteRepository(ctx context.Context, id string) error {
	return c.repositoryRepo.DeleteRepository(ctx, id)
}
func (c *RepositoryBiz) GetRepoTree(ctx context.Context, id string) (packages []model.Package, files []model.File, err error) {
	return c.entityRepo.QueryPkgAndFileByProjectId(ctx, id)
}
