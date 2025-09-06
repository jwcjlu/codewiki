package model

import (
	"fmt"
	"os"
	"time"

	"codewiki/internal/pkg/localcache"
)

type FileContentKey struct {
	fileContentKey string
}

func NewFileContentKey(fileContentKey string) *FileContentKey {
	return &FileContentKey{fileContentKey: fileContentKey}
}
func (key *FileContentKey) KeyString() string {
	return key.fileContentKey
}

var fileContentCache = localcache.NewLocalCache(func(key *FileContentKey) ([]byte, error) {
	if key == nil {
		return nil, fmt.Errorf("FileContentKey is null")
	}
	content, err := os.ReadFile(key.fileContentKey)
	if err != nil {
		return nil, err
	}

	return content, nil
}, 5*time.Minute, 100)

func GetFileContent(filePath string) ([]byte, error) {
	content, err := fileContentCache.Get(NewFileContentKey(filePath))
	if err != nil {
		return nil, err
	}
	return content, nil
}
