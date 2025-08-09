package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
)

type ProjectRepo interface {
	SaveProject(ctx context.Context, p *Project) error
	QueryCallChain(ctx context.Context, startFunctionName string) ([]*v1.CallRelationship, error)

	// Repo management
	CreateRepo(ctx context.Context, req *v1.CreateRepoReq) (string, error)
	ListRepos(ctx context.Context) ([]*v1.Repo, error)
	GetRepo(ctx context.Context, id string) (*v1.Repo, error)
	DeleteRepo(ctx context.Context, id string) error

	// Repo bindings and views
	BindRepoRoot(ctx context.Context, repoId, rootPkgId string) error
	GetRepoTree(ctx context.Context, id string) (packages []*v1.PackageNode, files []*v1.FileNode, err error)
}
