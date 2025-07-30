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
func (c *CodeWiki) Analyze(ctx context.Context, in *v1.AnalyzeReq) error {
	project := NewProject(&Config{
		Language: in.Language,
		Includes: in.Includes,
		Excludes: in.Excludes,
	})
	return project.Analyze(ctx, in.Target, c.projectRepo)

}
