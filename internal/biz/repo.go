package biz

import (
	"context"
)

type ProjectRepo interface {
	SaveProject(ctx context.Context, p *Project) error
}
