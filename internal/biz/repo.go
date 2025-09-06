package biz

import (
	"codewiki/internal/biz/model"
	"context"
)

type EntityRepo interface {
	SavePackages(ctx context.Context, pkgs []*model.Package) error
	SaveFiles(ctx context.Context, files []*model.File) error
	SaveEntities(ctx context.Context, entities []*model.Entity) error
	SaveImports(ctx context.Context, imports []*model.Import) error
	SaveFields(ctx context.Context, fields []*model.Field) error
	QueryPkgAndFileByProjectId(ctx context.Context, id string) ([]model.Package, []model.File, error)
}

type CodeRepo interface {
	QueryCallRelations(ctx context.Context, projectId string, limit int) ([]*model.CallRelation, error)
	SaveRelations(ctx context.Context, relation []*model.Relation) error
	GetFunctionByFileId(ctx context.Context, fileId string) (functions []*model.Function, err error)
	GetImplementByEntityId(ctx context.Context, entityID string) (entities []*model.Entity, err error)
	SaveFunctions(ctx context.Context, functions []*model.Function) error
}
type IndexerRepo interface {
	SaveCodeChunk(ctx context.Context, projectName, partition string, codeChunks []*model.CodeChunk) error
	SearchCodeChunk(ctx context.Context, req *SearchCodeChunksReq) ([]*model.CodeChunk, error)
	SearchCodeChunkByIds(ctx context.Context, collectionName string, ids []string, limit int) ([]*model.CodeChunk, error)
}

type RepositoryRepo interface {
	CreateRepository(ctx context.Context, req *model.CodeRepository) error
	ListRepositories(ctx context.Context) ([]*model.CodeRepository, error)
	GetRepository(ctx context.Context, id string) (*model.CodeRepository, error)
	DeleteRepository(ctx context.Context, id string) error
	UpdateRepository(ctx context.Context, project *model.CodeRepository) error
}
