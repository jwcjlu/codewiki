package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
)

type CodeWiki struct {
	entityRepo EntityRepo
}

func NewCodeWiki(entityRepo EntityRepo) *CodeWiki {
	return &CodeWiki{entityRepo: entityRepo}
}
func (c *CodeWiki) Analyze(ctx context.Context, in *v1.AnalyzeReq) error {
	project := NewProject(&Config{
		Language: in.Language,
		Includes: in.Includes,
		Excludes: in.Excludes,
	})
	return project.Analyze(ctx, in.Target)

}
