package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
)

type CodeWiki struct {
	projectRepo ProjectRepo
}

func NewCodeWiki(projectRepo ProjectRepo) *CodeWiki {
	return &CodeWiki{projectRepo: projectRepo}
}
func (c *CodeWiki) QueryCallChain(ctx context.Context, startFunctionName string) ([]*v1.CallRelationship, error) {

	return c.projectRepo.QueryCallChain(ctx, startFunctionName)

}

// Repo management APIs delegating to repository layer
func (c *CodeWiki) CreateRepo(ctx context.Context, req *v1.CreateRepoReq) (string, error) {
	return c.projectRepo.CreateRepo(ctx, req)
}
func (c *CodeWiki) ListRepos(ctx context.Context) ([]*v1.Repo, error) {
	return c.projectRepo.ListRepos(ctx)
}
func (c *CodeWiki) GetRepo(ctx context.Context, id string) (*v1.Repo, error) {
	return c.projectRepo.GetRepo(ctx, id)
}
func (c *CodeWiki) DeleteRepo(ctx context.Context, id string) error {
	return c.projectRepo.DeleteRepo(ctx, id)
}
func (c *CodeWiki) AnalyzeRepo(ctx context.Context, id string) error {
	// get repo info
	repo, err := c.projectRepo.GetRepo(ctx, id)
	if err != nil {
		return err
	}
	// build analyze target
	targetPath := repo.Target
	if len(repo.Path) > 0 {
		targetPath = repo.Path
	}

	project := NewProject(repo)
	if err = project.Analyze(ctx, targetPath, c.projectRepo); err != nil {
		return err
	}
	return nil
}
func (c *CodeWiki) GetRepoTree(ctx context.Context, id string) (packages []*v1.PackageNode, files []*v1.FileNode, err error) {
	return c.projectRepo.GetRepoTree(ctx, id)
}
