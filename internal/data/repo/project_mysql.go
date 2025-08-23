package repo

import (
	"codewiki/internal/biz"
	"codewiki/internal/biz/model"
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// gormRepo is responsible for Repo CRUD in MySQL
type projectRepo struct {
	db *gorm.DB
}

func NewProjectRepo(db *gorm.DB) biz.ProjectRepo {
	return &projectRepo{db: db}
}

func (p *projectRepo) CreateProject(ctx context.Context, project *model.ProjectEntity) error {
	project.ID = uuid.NewString()
	return p.db.Create(project).Error
}

func (p *projectRepo) ListProjects(ctx context.Context) ([]*model.ProjectEntity, error) {
	var pes []*model.ProjectEntity
	if err := p.db.WithContext(ctx).Find(&pes).Error; err != nil {
		return nil, err
	}
	return pes, nil
}
func (p *projectRepo) GetProject(ctx context.Context, id string) (*model.ProjectEntity, error) {
	var m model.ProjectEntity
	if err := p.db.WithContext(ctx).First(&m, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (p *projectRepo) DeleteProject(ctx context.Context, id string) error {
	return p.db.WithContext(ctx).Delete(&model.Project{}, "id = ?", id).Error
}
