package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"os"
	"path/filepath"
	"strings"
)

var PathSep = "@"

type CodeRepository struct {
	*v1.Repo
}

func (codeRepo *CodeRepository) ReadFile(fileId string) (string, error) {
	fileId = strings.TrimPrefix(fileId, codeRepo.Id)
	fileId = strings.TrimPrefix(fileId, PathSep)
	fileId = strings.TrimPrefix(fileId, filepath.Base(codeRepo.Target))
	fileId = strings.TrimPrefix(fileId, PathSep)
	filePath := filepath.Join(codeRepo.Repo.Target, strings.ReplaceAll(fileId, PathSep, string(filepath.Separator)))
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
