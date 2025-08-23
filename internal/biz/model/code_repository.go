package model

import (
	"os"
	"path/filepath"
	"strings"
)

var PathSep = "@"

type CodeRepository struct {
	*ProjectEntity
}

func (codeRepo *CodeRepository) ReadFile(fileId string) (string, error) {
	fileId = strings.TrimPrefix(fileId, codeRepo.ID)
	fileId = strings.TrimPrefix(fileId, PathSep)
	fileId = strings.TrimPrefix(fileId, filepath.Base(codeRepo.Target))
	fileId = strings.TrimPrefix(fileId, PathSep)
	filePath := filepath.Join(codeRepo.ProjectEntity.Target, strings.ReplaceAll(fileId, PathSep, string(filepath.Separator)))
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
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
