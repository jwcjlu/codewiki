package biz

import (
	"context"
)

type EntityRepo interface {
	BatchSaveEntities(ctx context.Context, entities []*Entity) error

	BatchSaveRelation(ctx context.Context, relations []*Relation) error
}
