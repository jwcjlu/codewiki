package repo

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"
	"context"
	"errors"
	"github.com/google/uuid"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"gorm.io/gorm"
	"strings"
)

// gormRepo is responsible for Repo CRUD in MySQL
type gormRepo struct {
	db *gorm.DB
}

type RepoModel struct {
	ID          string      `gorm:"primaryKey;size:64"`
	Name        string      `gorm:"size:128;not null"`
	RepoType    int32       `gorm:"not null"`
	Path        string      `gorm:"size:512"`
	Target      string      `gorm:"size:1024;not null"`
	Token       string      `gorm:"size:512"`
	Description string      `gorm:"size:512"`
	Language    v1.Language `gorm:"size:50"`
	Excludes    string      `gorm:"text"`
}

func (RepoModel) TableName() string {
	return "t_repo"
}
func autoMigrateRepo(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	return db.AutoMigrate(&RepoModel{})
}

// compositeRepo wires MySQL (for repos) + Neo4j (for code graph)
type compositeRepo struct {
	sql *gormRepo
	g   *projectRepo
}

func NewCompositeRepo(driver neo4j.DriverWithContext, db *gorm.DB) (biz.ProjectRepo, error) {
	// neo4j part
	pr := &projectRepo{neo4jDriver: driver}
	// mysql part
	gr := &gormRepo{db: db}
	if err := autoMigrateRepo(db); err != nil {
		return nil, err
	}
	return &compositeRepo{sql: gr, g: pr}, nil
}

// Project graph ops delegate to neo4j
func (r *compositeRepo) SaveProject(ctx context.Context, p *biz.Project) error {
	return r.g.SaveProject(ctx, p)
}
func (r *compositeRepo) QueryCallChain(ctx context.Context, id string) ([]*v1.CallRelationship, error) {
	return r.g.QueryCallChain(ctx, id)
}
func (r *compositeRepo) BindRepoRoot(ctx context.Context, repoId, rootPkgId string) error {
	return r.g.BindRepoRoot(ctx, repoId, rootPkgId)
}
func (r *compositeRepo) GetRepoTree(ctx context.Context, id string) ([]*v1.PackageNode, []*v1.FileNode, error) {
	return r.g.GetRepoTree(ctx, id)
}
func (r *compositeRepo) GetFunctionByFileId(ctx context.Context,
	fileId string) ([]*v1.Function, error) {
	return r.g.GetFunctionByFileId(ctx, fileId)
}

// Repo CRUD via MySQL
func (r *compositeRepo) CreateRepo(ctx context.Context, req *v1.CreateRepoReq) (string, error) {
	if r.sql == nil || r.sql.db == nil {
		return "", errors.New("mysql is not configured")
	}
	m := &RepoModel{
		ID:          uuid.NewString(),
		Name:        req.Name,
		RepoType:    int32(req.RepoType),
		Path:        req.Path,
		Target:      req.Target,
		Token:       req.Token,
		Description: req.Description,
		Language:    req.Language,
		Excludes:    strings.Join(req.Excludes, ","),
	}
	r.sql.db.Transaction(func(session *gorm.DB) error {
		if err := session.Create(m).Error; err != nil {
			return err
		}
		_, err := r.g.CreateRepo(ctx, m)
		if err != nil {
			return err
		}
		return nil
	})
	return m.ID, nil
}

func (r *compositeRepo) ListRepos(ctx context.Context) ([]*v1.Repo, error) {
	if r.sql == nil || r.sql.db == nil {
		return []*v1.Repo{}, nil
	}
	var ms []RepoModel
	if err := r.sql.db.WithContext(ctx).Find(&ms).Error; err != nil {
		return nil, err
	}
	var out []*v1.Repo
	for _, m := range ms {
		out = append(out, &v1.Repo{
			Id:          m.ID,
			Name:        m.Name,
			RepoType:    v1.RepoType(m.RepoType),
			Path:        m.Path,
			Target:      m.Target,
			Token:       m.Token,
			Description: m.Description,
		})
	}
	return out, nil
}

func (r *compositeRepo) GetRepo(ctx context.Context, id string) (*v1.Repo, error) {
	if r.sql == nil || r.sql.db == nil {
		return nil, errors.New("mysql is not configured")
	}
	var m RepoModel
	if err := r.sql.db.WithContext(ctx).First(&m, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &v1.Repo{
		Id:          m.ID,
		Name:        m.Name,
		RepoType:    v1.RepoType(m.RepoType),
		Path:        m.Path,
		Target:      m.Target,
		Token:       m.Token,
		Description: m.Description,
		Excludes:    strings.Split(m.Excludes, ","),
		Language:    m.Language,
	}, nil
}

func (r *compositeRepo) DeleteRepo(ctx context.Context, id string) error {
	if r.sql == nil || r.sql.db == nil {
		return errors.New("mysql is not configured")
	}
	return r.sql.db.Transaction(func(session *gorm.DB) error {
		if err := r.sql.db.WithContext(ctx).Delete(&RepoModel{}, "id = ?", id).Error; err != nil {
			return err
		}
		return r.g.DeleteRepo(ctx, id)
	})

}

func (r *compositeRepo) GetImplementByEntityId(ctx context.Context, entityID string) ([]*v1.Entity, error) {
	return r.g.GetImplementByEntityId(ctx, entityID)
}
