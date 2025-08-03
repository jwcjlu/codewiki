package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
)

type ProjectRepo interface {
	SaveProject(ctx context.Context, p *Project) error
	QueryCallChain(ctx context.Context, startFunctionName string) ([]*v1.CallRelationship, error)
}
