package biz

import (
	"context"
	"fmt"

	"os"
	"path/filepath"
)

type Package struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ParentID    string `json:"parent_id"`
	Path        string
	Packages    []*Package
	Files       []*File
	filter      func(path string) bool
	entityCount int
	structMap   map[string]*Entity
}

func (p *Package) Parse(ctx context.Context, rootPath string) error {
	dirs, err := os.ReadDir(rootPath)
	if err != nil {
		return err
	}
	for _, dir := range dirs {

		if dir.IsDir() {
			if filterFolder(dir.Name()) {
				continue
			}
			subP := &Package{ParentID: p.ID, Name: dir.Name(), filter: p.filter}
			subP.ID = subP.geneID()
			if err = subP.Parse(ctx, filepath.Join(rootPath, dir.Name())); err != nil {
				return err
			}
			if subP.countEntity() < 1 {
				continue
			}
			p.Packages = append(p.Packages, subP)
		} else {
			if p.filter != nil && !p.filter(dir.Name()) {
				continue
			}

			file := &File{Name: dir.Name(), PkgID: p.ID, ID: fmt.Sprintf("%s@%s", p.ID, dir.Name())}
			if err = file.Parse(ctx, p.ID, filepath.Join(rootPath, dir.Name())); err != nil {
				return err
			}
			p.Files = append(p.Files, file)

		}
	}
	return nil
}
func (p *Package) AnalyzeRelations(ctx context.Context) error {

	return nil
}

func (p *Package) buildEntIdMap(ctx context.Context) map[string]string {
	return nil
}

func (p *Package) geneID() string {
	return fmt.Sprintf("%s@%s", p.ParentID, p.Name)
}

func (p *Package) countEntity() int {
	count := 0
	for _, pkg := range p.Packages {
		count += pkg.countEntity()
	}
	for _, file := range p.Files {
		count += file.EntityCount()
	}
	return count
}

func filterFolder(path string) bool {
	if path == "." {
		return true
	}
	if path == ".git" {
		return true
	}
	if path == ".github" {
		return true
	}
	return false
}
