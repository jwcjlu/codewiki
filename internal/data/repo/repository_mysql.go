package repo

import (
	"codewiki/internal/biz"
	"codewiki/internal/biz/model"
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// gormRepo is responsible for Repo CRUD in MySQL
type repositoryRepo struct {
	db *gorm.DB
}

func NewRepositoryRepo(db *gorm.DB) biz.RepositoryRepo {
	return &repositoryRepo{db: db}
}

func (r *repositoryRepo) CreateRepository(ctx context.Context, repo *model.CodeRepository) error {
	repo.ID = uuid.NewString()
	return r.db.WithContext(ctx).Create(repo).Error
}

func (r *repositoryRepo) ListRepositories(ctx context.Context) ([]*model.CodeRepository, error) {
	var pes []*model.CodeRepository
	if err := r.db.WithContext(ctx).Find(&pes).Error; err != nil {
		return nil, err
	}
	return pes, nil
}
func (r *repositoryRepo) GetRepository(ctx context.Context, id string) (*model.CodeRepository, error) {
	var m model.CodeRepository
	if err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *repositoryRepo) DeleteRepository(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&model.CodeRepository{}, "id = ?", id).Error
}

func (r *repositoryRepo) UpdateRepository(ctx context.Context, project *model.CodeRepository) error {
	return r.db.WithContext(ctx).Updates(project).Error
}
