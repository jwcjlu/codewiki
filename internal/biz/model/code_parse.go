package model

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

type CodeParse struct {
	config      *Config
	module      string
	RootPath    string
	pkgs        map[string]*Package
	Relations   []*Relation
	Root        *Package
	Repo        *CodeRepository
	relationMap map[string]bool
	repoDir     string
}

type Config struct {
	Language v1.Language
	Includes []string
	Excludes []string
}

func NewCodeParse(repo *CodeRepository, repoDir string) *CodeParse {

	return &CodeParse{config: &Config{
		Language: repo.Language,
		Excludes: strings.Split(repo.Excludes, ","),
	},
		pkgs:        make(map[string]*Package),
		relationMap: make(map[string]bool),
		Repo:        repo,
		repoDir:     repoDir,
	}
}

func (cp *CodeParse) LanguagePrefix() string {
	switch cp.config.Language {
	case v1.Language_Golang:
		return ".go"
	case v1.Language_Java:
		return ".java"
	}
	return ""
}

func (cp *CodeParse) ParseCode(ctx context.Context) (*Package, error) {
	if err := cp.Repo.cloneIfNeeded(ctx, cp.repoDir); err != nil {
		return nil, err
	}
	pathPath, err := FindGoModPath(cp.Repo.LocalPath)
	var module string
	if err == nil {
		if module, err = GetModuleName(pathPath); err != nil {
			return nil, err
		}
		cp.module = module
	}
	root := NewPackage(cp.shouldInclude, cp, cp.Repo.ID, filepath.Base(cp.Repo.LocalPath))
	cp.RootPath = filepath.Base(cp.Repo.LocalPath)
	err = root.Parse(ctx, cp.Repo.LocalPath)
	if err != nil {
		return nil, err
	}
	cp.Root = root
	cp.pkgs[root.ID] = root
	return root, nil
}

// AnalyzeRelations 分析包和包，包和文件，类和函数，函数和函数之间的关系
func (cp *CodeParse) AnalyzeRelations(ctx context.Context) error {
	cp.Root.ClassifyExtends(ctx)
	cp.Root.ClassifyMethod(ctx)
	for _, pkg := range cp.pkgs {
		if err := pkg.AnalyzeRelations(ctx, cp.module); err != nil {
			return err
		}
		if len(pkg.ParentID) > 0 {
			cp.Relations = append(cp.Relations, &Relation{
				Type:       Contains,
				TargetID:   pkg.ID,
				Confidence: 1,
				SourceID:   pkg.ParentID,
			})
		}
	}
	//分析实现关系
	cp.AnalyzeInterfaceImplRelations(ctx)
	return nil
}
func (cp *CodeParse) GetPackageById(pkgId string) *Package {
	return cp.pkgs[pkgId]
}
func (cp *CodeParse) GetEntity(pkgName, key string) *Entity {
	pkg, ok := cp.pkgs[pkgName]
	if ok {
		return pkg.GetEntity(key)

	}
	if len(cp.RootPath) > 0 {
		pkg, ok = cp.pkgs[fmt.Sprintf("%s@%s@%s", cp.Repo.ID, cp.RootPath, pkgName)]
	}
	if ok {
		return pkg.GetEntity(key)
	}
	return nil
}

func (cp *CodeParse) GetFunctionByName(pkgName, functionName string) *Function {
	pkg := cp.GetPackageByName(pkgName)
	if pkg != nil {
		return pkg.GetFunctionByName(functionName)
	}
	return nil
}

func (cp *CodeParse) GetPackageByName(pkgName string) *Package {
	pkg, ok := cp.pkgs[pkgName]
	if ok {
		return pkg
	}
	if len(cp.RootPath) > 0 {
		pkg, ok = cp.pkgs[fmt.Sprintf("%s@%s@%s", cp.Repo.ID, cp.RootPath, pkgName)]
	}
	return pkg
}
func (cp *CodeParse) AddRelations(rs []*Relation) {
	for _, r := range rs {
		if _, ok := cp.relationMap[r.UnionKey()]; ok {
			continue
		}
		cp.Relations = append(cp.Relations, r)
		cp.relationMap[r.UnionKey()] = true
	}

}
func (cp *CodeParse) AddPackage(pkg *Package) {
	cp.pkgs[pkg.ID] = pkg
}

// AnalyzeInterfaceImplRelations 分析接口实现的的关系
func (cp *CodeParse) AnalyzeInterfaceImplRelations(ctx context.Context) {
	cp.Relations = append(cp.Relations, cp.Root.AnalyzeInterfaceImplRelations(ctx, cp)...)

}

// FindInterfaceImpl 找出接口的实现
func (cp *CodeParse) FindInterfaceImpl(ctx context.Context, interfaceEntity *Entity) []*Entity {
	return cp.Root.FindInterfaceImpl(ctx, interfaceEntity)
}

func (cp *CodeParse) GetPackages() []*Package {
	filter := map[string]bool{}
	var packages []*Package
	for _, pkg := range cp.pkgs {
		if _, ok := filter[pkg.ID]; ok {
			continue
		}
		packages = append(packages, pkg)
		filter[pkg.ID] = true
	}
	return packages
}
func (cp *CodeParse) GetFiles() []*File {
	filter := map[string]bool{}
	var files []*File
	for _, pkg := range cp.pkgs {
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
func (cp *CodeParse) shouldInclude(path string) bool {
	ext := filepath.Ext(path)
	if ext != cp.LanguagePrefix() {
		return false
	}
	for _, exclude := range cp.config.Excludes {
		if matched, _ := regexp.MatchString(exclude, path); matched {
			return false
		}
	}

	if len(cp.config.Includes) > 0 {
		for _, include := range cp.config.Includes {
			if matched, _ := regexp.MatchString(include, path); matched {
				return true
			}
		}
		return false
	}

	return true
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

// AnalyzeExtends 分析继承关系
func (cp *CodeParse) AnalyzeExtends(ctx context.Context) {
	cp.Root.ClassifyExtends(ctx)
}

// AnalyzeMethod 分析实体方法
func (cp *CodeParse) AnalyzeMethod(ctx context.Context) {
	cp.Root.ClassifyMethod(ctx)
}

func (cp *CodeParse) GetImport() []*Import {
	var imports []*Import
	for _, file := range cp.GetFiles() {
		imports = append(imports, file.GetImports()...)
	}
	return imports
}
func (cp *CodeParse) GetFields() []*Field {
	var fields []*Field
	for _, entity := range cp.GetEntities() {
		fields = append(fields, entity.GetFields()...)
	}
	return fields
}
func (cp *CodeParse) GetEntities() []*Entity {
	var entities []*Entity
	for _, file := range cp.GetFiles() {
		entities = append(entities, file.GetEntities()...)
	}
	return entities

}
func (cp *CodeParse) GetFunctions() []*Function {
	var functions []*Function
	for _, file := range cp.GetFiles() {
		functions = append(functions, file.GetFunctions()...)
		for _, entity := range file.GetEntities() {
			functions = append(functions, entity.GetMethods()...)
		}

	}
	return functions

}
