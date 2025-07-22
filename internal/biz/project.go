package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
	"path/filepath"
	"regexp"
	"strings"
)

type Project struct {
	config *Config
}
type Config struct {
	Language string
	Includes []string
	Excludes []string
}

func NewProject(config *Config) *Project {
	return &Project{config: config}
}

func (p *Project) Analyze(ctx context.Context, rootPath string) error {
	root, err := p.ParseCode(ctx, rootPath)
	if err != nil {
		return v1.ErrorParseCodeError("parseCode failure ").WithCause(err)
	}
	if err = root.AnalyzeRelations(ctx); err != nil {
		return err
	}
	return nil

}
func (p *Project) ParseCode(ctx context.Context, rootPath string) (*Package, error) {
	root := &Package{
		ID:        filepath.Base(rootPath),
		Name:      filepath.Base(rootPath),
		Path:      filepath.Base(rootPath),
		filter:    p.shouldInclude,
		structMap: map[string]*Entity{},
	}
	err := root.Parse(ctx, rootPath)
	if err != nil {
		return nil, err
	}
	return root, nil
}

func (p *Project) shouldInclude(path string) bool {
	ext := filepath.Ext(path)
	if p.config.Language != "auto" && len(ext) > 0 {
		if !strings.HasPrefix(ext, "."+p.config.Language) {
			return false
		}
	}

	for _, exclude := range p.config.Excludes {
		if matched, _ := regexp.MatchString(exclude, path); matched {
			return false
		}
	}

	if len(p.config.Includes) > 0 {
		for _, include := range p.config.Includes {
			if matched, _ := regexp.MatchString(include, path); matched {
				return true
			}
		}
		return false
	}

	return true
}
