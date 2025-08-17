package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
)

type CodeWiki struct {
	projectRepo ProjectRepo
	indexer     *Indexer
}

func NewCodeWiki(projectRepo ProjectRepo, indexer *Indexer) *CodeWiki {

	return &CodeWiki{projectRepo: projectRepo, indexer: indexer}
}
func (c *CodeWiki) QueryCallChain(ctx context.Context, id string) ([]*v1.CallRelationship, error) {

	return c.projectRepo.QueryCallChain(ctx, id)

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

	project := NewProject(repo, c.indexer)
	if err = project.Analyze(ctx, targetPath, c.projectRepo); err != nil {
		return err
	}
	return nil
}
func (c *CodeWiki) GetRepoTree(ctx context.Context, id string) (packages []*v1.PackageNode, files []*v1.FileNode, err error) {
	return c.projectRepo.GetRepoTree(ctx, id)
}

func (c *CodeWiki) ViewFileContent(ctx context.Context, req *v1.ViewFileReq) (*FileContent, error) {
	repo, err := c.projectRepo.GetRepo(ctx, req.GetRepoId())
	if err != nil {
		return nil, err
	}
	cr := CodeRepository{Repo: repo}
	content, err := cr.ReadFile(req.Id)
	if err != nil {
		return nil, err
	}
	functions, err := c.projectRepo.GetFunctionByFileId(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	return &FileContent{Content: content, Functions: functions}, nil
}
func (c *CodeWiki) GetImplements(ctx context.Context, entityId string) ([]*v1.Entity, error) {
	entities, err := c.projectRepo.GetImplementByEntityId(ctx, entityId)
	if err != nil {
		return nil, err
	}
	return entities, nil
}
