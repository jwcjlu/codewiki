package model

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/pkg/git"
	"context"

	"os"
	"path/filepath"
	"strings"
)

var PathSep = "@"

type CodeRepository struct {
	ID          string      `gorm:"primaryKey;size:64"`
	Name        string      `gorm:"size:128;not null"`
	RepoType    int32       `gorm:"not null"`
	RemotePath  string      `gorm:"size:512"`
	LocalPath   string      `gorm:"size:1024;not null"`
	Token       string      `gorm:"size:512"`
	Description string      `gorm:"size:512"`
	Language    v1.Language `gorm:"size:50"`
	Excludes    string      `gorm:"size:1024"`
}

func (*CodeRepository) TableName() string {
	return "t_repo"
}

func (codeRepo *CodeRepository) ReadFile(fileId string) (string, error) {
	fileId = strings.TrimPrefix(fileId, codeRepo.ID)
	fileId = strings.TrimPrefix(fileId, PathSep)
	fileId = strings.TrimPrefix(fileId, filepath.Base(codeRepo.LocalPath))
	fileId = strings.TrimPrefix(fileId, PathSep)
	filePath := filepath.Join(codeRepo.LocalPath, strings.ReplaceAll(fileId, PathSep, string(filepath.Separator)))
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (codeRepo *CodeRepository) cloneIfNeeded(ctx context.Context, rootDir string) error {
	if len(codeRepo.LocalPath) > 0 {
		return nil
	}
	projectName := strings.TrimSuffix(filepath.Base(codeRepo.RemotePath), filepath.Ext(codeRepo.RemotePath))
	_, err := os.Stat(filepath.Join(rootDir, projectName))
	if err == nil {
		return nil
	}
	if !os.IsNotExist(err) {
		return err
	}
	os.RemoveAll(filepath.Join(rootDir, projectName))
	_, err = git.CloneRepository(ctx, &git.CloneRepositoryReq{
		URL:            codeRepo.RemotePath,
		LocalBasePath:  rootDir,
		RepositoryName: projectName,
		Token:          codeRepo.Token,
		Branch:         "",
	})
	if err != nil {
		return err
	}
	codeRepo.LocalPath = filepath.Join(rootDir, projectName)
	return nil
}

type Scope string

const (
	ChunkFileScope     Scope = "file"
	ChunkFunctionScope Scope = "function"
	ChunkPkgScope      Scope = "pkg"
	ChunkProjectScope  Scope = "project"
)

type CodeChunk struct {
	Path        string `json:"path" `
	Content     string `json:"content" `
	codeVector  []float32
	logicVector []float32
	Document    string `json:"document"`
	Logic       string `json:"logic"`
	Scope       Scope  `json:"scope"`
	Id          string `json:"id"`
}

func (cc *CodeChunk) SetCodeVector(codeVector []float32) {
	cc.codeVector = codeVector
}
func (cc *CodeChunk) CodeVector() []float32 {
	return cc.codeVector
}
func (cc *CodeChunk) LogicVector() []float32 {
	return cc.logicVector
}

type CodeChunkBuilder interface {
	BuildRawCodeChunk() *CodeChunk
}

type CallRelation struct {
	CallerId       string
	CallerName     string
	CalleeId       string
	CalleeName     string
	CalleeFileId   string
	CallerFileId   string
	CalleeScope    int64
	CallerScope    int64
	CalleeEntityId string
	CallerEntityId string
}
