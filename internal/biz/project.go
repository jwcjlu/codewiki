package biz

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
	"fmt"
	"golang.org/x/mod/modfile"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type Project struct {
	config       *Config
	module       string
	entities     map[string]*Entity
	RootPath     string
	pkgs         map[string]*Package
	Relations    []*Relation
	Root         *Package
	relationsmap map[string]bool
}
type Config struct {
	Language string
	Includes []string
	Excludes []string
}

func NewProject(config *Config) *Project {
	return &Project{config: config, entities: make(map[string]*Entity), pkgs: make(map[string]*Package), relationsmap: make(map[string]bool)}
}

func (p *Project) Analyze(ctx context.Context, rootPath string, projectRepo ProjectRepo) error {
	root, err := p.ParseCode(ctx, rootPath)
	if err != nil {
		return v1.ErrorParseCodeError("parseCode failure ").WithCause(err)
	}
	p.pkgs[root.ID] = root
	root.ClassifyExtends(ctx)
	root.ClassifyMethod(ctx)
	p.Root = root
	if err = p.AnalyzeRelations(ctx); err != nil {
		return err
	}
	p.AnalyzeInterfaceImplRelations(ctx)
	for _, relation := range p.Relations {
		if relation.SourceID == "dragonfly@client@config@dynconfig_manager.go:dynconfigManager" {
			fmt.Println(*relation)
		}
	}

	return projectRepo.SaveProject(ctx, p)

}
func (p *Project) ParseCode(ctx context.Context, rootPath string) (*Package, error) {
	pathPath, err := FindGoModPath(rootPath)
	var module string
	if err == nil {
		if module, err = GetModuleName(pathPath); err != nil {
			return nil, err
		}
		p.module = module
	}
	root := NewPackage(p.shouldInclude, p, "", filepath.Base(rootPath))
	p.RootPath = filepath.Base(rootPath)
	err = root.Parse(ctx, rootPath)
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

// GetModuleName 解析 go.mod 文件并返回模块名称
func GetModuleName(goModPath string) (string, error) {
	// 读取 go.mod 文件内容
	data, err := os.ReadFile(goModPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("go.mod file not found: %w", err)
		}
		return "", fmt.Errorf("error reading go.mod: %w", err)
	}

	// 解析 mod 文件
	f, err := modfile.Parse(goModPath, data, nil)
	if err != nil {
		return "", fmt.Errorf("error parsing modfile: %w", err)
	}

	// 获取 module 路径
	if f.Module == nil {
		return "", fmt.Errorf("no module declaration found in %s", goModPath)
	}

	return f.Module.Mod.Path, nil
}

// FindGoModPath 向上搜索目录树查找最近的 go.mod
func FindGoModPath(startDir string) (string, error) {
	dir := startDir
	for {
		modPath := filepath.Join(dir, "go.mod")
		if _, err := os.Stat(modPath); err == nil {
			return modPath, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir { // 到达根目录
			return "", fmt.Errorf("no go.mod found in directory tree")
		}
		dir = parent
	}
}

func (p *Project) AnalyzeRelations(ctx context.Context) error {
	for _, pkg := range p.pkgs {
		if err := pkg.AnalyzeRelations(ctx, p.module); err != nil {
			return err
		}
		if len(pkg.ParentID) > 0 {
			p.Relations = append(p.Relations, &Relation{
				Type:       Contains,
				TargetID:   pkg.ID,
				Confidence: 1,
				SourceID:   pkg.ParentID,
			})
		}

	}
	return nil
}

func (p *Project) AddEntity(key string, entity *Entity) {
	p.entities[key] = entity
}

func (p *Project) GetEntity(pkgName, key string) *Entity {
	pkg, ok := p.pkgs[pkgName]
	if ok {
		return pkg.structMap[key]

	}
	if len(p.RootPath) > 0 {
		pkg, ok = p.pkgs[fmt.Sprintf("%s@%s", p.RootPath, pkgName)]
	}
	if ok {
		return pkg.structMap[key]
	}
	return nil
}

func (p *Project) GetFunction(pkgName, functionName string) *Function {
	pkg, ok := p.pkgs[pkgName]
	if ok {
		return pkg.functionMap[functionName]

	}
	if len(p.RootPath) > 0 {
		pkg, ok = p.pkgs[fmt.Sprintf("%s@%s", p.RootPath, pkgName)]
	}
	if ok {
		return pkg.functionMap[functionName]
	}
	return nil
}
func (p *Project) AddRelations(rs []*Relation) {
	for _, r := range rs {
		if _, ok := p.relationsmap[r.UnionKey()]; ok {
			continue
		}
		p.Relations = append(p.Relations, r)
		p.relationsmap[r.UnionKey()] = true
	}

}
func (p *Project) AddPackage(pkg *Package) {
	p.pkgs[pkg.ID] = pkg
}

// AnalyzeInterfaceImplRelations 分析接口实现的的关系
func (p *Project) AnalyzeInterfaceImplRelations(ctx context.Context) {
	p.Relations = append(p.Relations, p.Root.AnalyzeInterfaceImplRelations(ctx, p)...)

}

// FindInterfaceImpl 找出接口的实现
func (p *Project) FindInterfaceImpl(ctx context.Context, interfaceEntity *Entity) []*Entity {
	return p.Root.FindInterfaceImpl(ctx, interfaceEntity)
}

func (p *Project) GetPackages() []*Package {
	filter := map[string]bool{}
	var packages []*Package
	for _, pkg := range p.pkgs {
		if _, ok := filter[pkg.ID]; ok {
			continue
		}
		packages = append(packages, pkg)
		filter[pkg.ID] = true
	}
	return packages
}
func (p *Project) GetFiles() []*File {
	filter := map[string]bool{}
	var files []*File
	for _, pkg := range p.pkgs {
		for _, file := range pkg.Files {
			if _, ok := filter[file.ID]; ok {
				continue
			}
			files = append(files, file)
			filter[file.ID] = true
		}

	}
	return files
}
