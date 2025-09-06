package model

import (
	"context"
	"fmt"
	"strings"

	"os"
	"path/filepath"
)

type Package struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	ParentID     string `json:"parent_id"`
	Path         string
	Packages     []*Package
	Files        []*File
	filter       func(path string) bool
	entityCount  int
	codeParse    *CodeParse
	filesContent strings.Builder
}

func NewPackage(filter func(path string) bool, codeParse *CodeParse, parentID, name string) *Package {
	pkg := &Package{
		filter:    filter,
		codeParse: codeParse,
		ParentID:  parentID,
		Name:      name,
		ID:        geneID(parentID, name),
	}
	codeParse.AddPackage(pkg)
	return pkg
}

func (p *Package) AppendFileCode(path, content string) {
	p.filesContent.WriteString(fmt.Sprintf("// File: %s\n%s\n\n", path, content))
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
			subP := NewPackage(p.filter, p.codeParse, p.ID, dir.Name())
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

			file := NewFile(rootPath, dir.Name(), p)
			if err = file.Parse(file.FilePath); err != nil {
				return err
			}
			p.Files = append(p.Files, file)

		}
	}
	return nil
}
func (p *Package) AnalyzeRelations(ctx context.Context, module string) error {
	for _, file := range p.Files {
		if err := file.AnalyzeRelations(ctx, p); err != nil {
			return err
		}

		var relations []*Relation
		relations = append(relations, &Relation{Type: ContainsFile,
			TargetID:   file.ID,
			Confidence: 0,
			SourceID:   file.PkgID})
		p.GetCodeParse().AddRelations(relations)
	}
	for _, pkg := range p.Packages {
		if err := pkg.AnalyzeRelations(ctx, module); err != nil {
			return nil
		}
	}
	return nil
}

// ClassifyMethod 归类方法到对应的实体里
func (p *Package) ClassifyMethod(ctx context.Context) {
	for _, file := range p.Files {
		file.ClassifyMethod(ctx, p)

	}
	for _, pkg := range p.Packages {
		pkg.ClassifyMethod(ctx)
	}
}

// ClassifyExtends 归类继承关系
func (p *Package) ClassifyExtends(ctx context.Context) {
	for _, file := range p.Files {
		file.ClassifyExtends(ctx, p)

	}
	for _, pkg := range p.Packages {
		pkg.ClassifyExtends(ctx)
	}
}

func (p *Package) FindInterfaceImpl(ctx context.Context, entity *Entity) []*Entity {
	var impls []*Entity
	for _, file := range p.Files {
		impls = append(impls, file.FindInterfaceImpl(ctx, entity)...)

	}
	for _, pkg := range p.Packages {
		impls = append(impls, pkg.FindInterfaceImpl(ctx, entity)...)
	}
	return impls
}

func geneID(parentID, name string) string {
	if len(parentID) == 0 {
		return name
	}
	return fmt.Sprintf("%s@%s", parentID, name)
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
func (p *Package) GetCodeParse() *CodeParse {
	return p.codeParse
}
func (p *Package) GetModule() string {
	return p.codeParse.module
}

func (p *Package) AddFile(f *File) {
	p.Files = append(p.Files, f)
}
func (p *Package) AnalyzeInterfaceImplRelations(ctx context.Context, project *CodeParse) []*Relation {
	var relations []*Relation
	for _, file := range p.Files {
		for _, entity := range file.GetEntities() {
			if entity.Type != Interface {
				continue
			}
			entities := project.FindInterfaceImpl(ctx, entity)
			for _, e := range entities {
				relations = append(relations, &Relation{
					Type:       Implement,
					TargetID:   entity.ID,
					Confidence: 0,
					SourceID:   e.ID,
				})
			}
		}
	}
	for _, pkg := range p.Packages {
		relations = append(relations, pkg.AnalyzeInterfaceImplRelations(ctx, project)...)
	}
	return relations
}

func (p *Package) GetFunctionByName(name string) *Function {
	for _, file := range p.Files {
		if fun := file.GetFunctionByName(name); fun != nil {
			return fun
		}
	}
	return nil
}
func (p *Package) GetEntity(name string) *Entity {
	for _, file := range p.Files {
		if entity := file.GetEntity(name); entity != nil {
			return entity
		}
	}
	return nil
}
func (p *Package) GetEntityByPkg(pkgId, name string) *Entity {
	newP := p
	if pkg := p.GetCodeParse().GetPackageById(pkgId); pkg != nil {
		newP = pkg
	}
	for _, file := range newP.Files {
		if entity := file.GetEntity(name); entity != nil {
			return entity
		}
	}
	return nil
}
