package model

import (
	v1 "codewiki/api/codewiki/v1"
	"context"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"go/types"
	"path/filepath"
	"strings"
)

type File struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	PkgID    string `json:"pkg_id"`
	FilePath string `json:"file_path"`
	fset     *token.FileSet

	// AST相关
	f1 *ast.File

	// 导入管理
	importManager *ImportManager

	// 实体管理
	entityManager *EntityManager

	// 函数管理
	functionManager *FunctionManager
	// 包引用
	pkg *Package
}

func (file *File) BuildRawCodeChunk() *CodeChunk {
	data, err := file.ReadFileContent()
	if err != nil {
		return nil
	}
	if len(data) == 0 {
		return nil
	}
	return &CodeChunk{
		Path:    file.FilePath,
		Content: string(data),
		Scope:   ChunkFileScope,
		Id:      file.ID,
	}
}
func (file *File) SourceCode() (string, error) {
	data, err := file.ReadFileContent()
	if err != nil {
		return "", err
	}
	return string(data), nil
}
func (file *File) GetCurrentPkg() *Package {
	return file.pkg
}

// NewFile 创建新的文件对象
func NewFile(dir, name string, pkg *Package) *File {
	file := &File{
		Name:     name,
		PkgID:    pkg.ID,
		ID:       fmt.Sprintf("%s@%s", pkg.ID, name),
		pkg:      pkg,
		FilePath: filepath.Join(dir, name),
		fset:     token.NewFileSet(),
	}

	// 初始化各个管理器
	file.importManager = NewImportManager(file)
	file.entityManager = NewEntityManager(file)
	file.functionManager = NewFunctionManager(file)

	return file
}

func (file *File) ReadFileContent() ([]byte, error) {
	return GetFileContent(file.FilePath)
}
func (file *File) Parse(filePath string) error {
	f, err := parser.ParseFile(file.fset, filePath, nil, parser.AllErrors|parser.ParseComments)
	if err != nil {
		return err
	}
	visitor := &FileVisitor{
		file: file,
		pkg:  file.pkg,
	}
	ast.Walk(visitor, f)
	return nil
}

func (file *File) AnalyzeRelations(ctx context.Context, pkg *Package) error {
	relations, err := NewRelationAnalyzer(file, pkg).AnalyzeEntityRelations()
	if err != nil {
		return err
	}
	file.pkg.GetCodeParse().AddRelations(relations)
	return nil
}
func (file *File) FindInterfaceImpl(ctx context.Context, entity *Entity) []*Entity {
	if entity.Type != Interface {
		return nil
	}
	if entity.CountFunction() < 1 {
		return nil
	}
	var entities []*Entity
	for _, e := range file.entityManager.GetEntities() {
		if e.Type != Struct {
			continue
		}
		if e.IsImplInterface(entity) {
			entities = append(entities, e)
		}
	}
	return entities
}
func (file *File) ClassifyMethod(ctx context.Context, pkg *Package) {
	for _, fun := range file.functionManager.GetMethods() {
		structEntity := pkg.GetEntity(fun.Receiver)
		if structEntity == nil {
			continue
		}
		structEntity.AddMethod(fun)
	}
}

func (file *File) ClassifyExtends(ctx context.Context, pkg *Package) {
	for _, entity := range file.entityManager.GetEntities() {
		entity.HandlerExtends(file, pkg)
	}

}

func (file *File) GetFunctionByNameInPackage(name string) *Function {
	return file.pkg.GetFunctionByName(name)
}
func (file *File) GetEntityByNameInPackage(name string) *Entity {
	return file.pkg.GetEntity(name)
}
func (file *File) GetImports() []*Import {
	return file.importManager.GetImport()
}
func (file *File) AddImport(imp *ast.ImportSpec) {
	file.importManager.AddImport(imp)
}
func (file *File) GetEntities() []*Entity {
	return file.entityManager.GetEntities()
}
func (file *File) GetFunctions() []*Function {
	return file.functionManager.GetFunctions()
}
func (file *File) GetFunctionByName(name string) *Function {
	return file.functionManager.GetFunctionByName(name)
}
func (file *File) GetMethods() []*Function {
	return file.functionManager.GetMethods()
}
func (file *File) AddEntity(entity *Entity) {
	file.entityManager.AddEntity(entity)
}
func (file *File) EntityCount() int {
	return len(file.entityManager.entities) + file.FunctionCount()
}
func (file *File) FunctionCount() int {
	return len(file.functionManager.functions)
}
func (file *File) GetEntity(name string) *Entity {
	return file.entityManager.GetEntity(name)
}

func (file *File) GetEntityForImport(importName, entityName string) *Entity {
	imp := file.importManager.LocalImport(importName)
	if imp == nil {
		return nil
	}
	pkgKey := strings.ReplaceAll(fmt.Sprintf("%s", strings.TrimPrefix(imp.Path, "/")), "/", "@")
	return file.pkg.GetCodeParse().GetEntity(pkgKey, entityName)

}
func (file *File) GetFunctionForImport(importName, functionName string) *Function {
	imp := file.importManager.LocalImport(importName)
	if imp == nil {
		return nil
	}
	pkgKey := strings.ReplaceAll(fmt.Sprintf("%s", strings.TrimPrefix(imp.Path, "/")), "/", "@")

	return file.pkg.GetCodeParse().GetFunctionByName(pkgKey, functionName)

}

type Import struct {
	Name   string
	Path   string
	FileId string
}

func (imp *Import) GetRef() string {
	if len(imp.Name) > 0 {
		return imp.Name
	}
	return filepath.Base(imp.Path)
}

// ImportManager 导入管理器
type ImportManager struct {
	file        *File
	imports     []*Import
	localImport map[string]*Import
}

func NewImportManager(file *File) *ImportManager {
	return &ImportManager{
		file:        file,
		localImport: make(map[string]*Import),
	}
}

func (im *ImportManager) AddImport(spec *ast.ImportSpec) {
	imp := &Import{
		Path:   strings.Trim(spec.Path.Value, "`"),
		FileId: im.file.ID,
	}
	if spec.Name != nil {
		imp.Name = strings.Trim(spec.Name.Name, `"`)
	}

	im.imports = append(im.imports, imp)

	// 处理本地导入
	if strings.Contains(imp.Path, im.file.pkg.GetModule()) {
		imp.Path = strings.TrimPrefix(strings.Trim(imp.Path, `"`), im.file.pkg.GetModule())
		im.localImport[imp.GetRef()] = imp
	}
}

func (im *ImportManager) LocalImport(importName string) *Import {
	return im.localImport[importName]
}
func (im *ImportManager) GetImport() []*Import {
	return im.imports
}

// EntityManager 实体管理器
type EntityManager struct {
	file      *File
	entities  []*Entity
	entityMap map[string]*Entity
}

func NewEntityManager(file *File) *EntityManager {
	return &EntityManager{
		file:      file,
		entityMap: make(map[string]*Entity),
	}
}

func (em *EntityManager) AddEntity(entity *Entity) {
	em.entities = append(em.entities, entity)
	em.entityMap[entity.Name] = entity
}

func (em *EntityManager) GetEntity(name string) *Entity {
	return em.entityMap[name]
}
func (em *EntityManager) GetEntities() []*Entity {
	return em.entities
}

// FileVisitor AST访问器
type FileVisitor struct {
	file *File
	pkg  *Package
}

func (v *FileVisitor) Visit(node ast.Node) ast.Visitor {
	if node == nil {
		return nil
	}
	switch n := node.(type) {
	case *ast.TypeSpec:
		v.handleTypeSpec(n)
	case *ast.GenDecl:
		v.handleGenDecl(n)
	case *ast.FuncDecl:
		v.handleFuncDecl(n)
	}

	return v
}

// 处理类型声明
func (v *FileVisitor) handleTypeSpec(node *ast.TypeSpec) {
	switch t := node.Type.(type) {
	case *ast.StructType:
		v.handleStructType(node, t)
	case *ast.InterfaceType:
		v.handleInterfaceType(node, t)
	}
}

// 处理结构体类型
func (v *FileVisitor) handleStructType(node *ast.TypeSpec, structType *ast.StructType) {
	entity := NewEntity(v.file, node, Struct)
	// 处理结构体字段
	for _, field := range structType.Fields.List {
		fd := &Field{
			StructID: entity.ID,
			Document: TextWarp(field.Doc),
		}
		fd.Scope = StructScope
		fd.expr = field.Type
		if len(field.Names) > 0 {
			fd.Name = field.Names[0].Name
		} else {
			if field.Type == nil {
				continue
			}
			entity.rawExtends = append(entity.rawExtends, field.Type)
		}
		fd.ObjType = types.ExprString(field.Type)
		entity.AddField(fd)
	}

	v.file.entityManager.AddEntity(entity)
}

// 处理接口类型
func (v *FileVisitor) handleInterfaceType(node *ast.TypeSpec, interfaceType *ast.InterfaceType) {
	file := v.file
	entity := NewEntity(v.file, node, Interface)
	for _, method := range interfaceType.Methods.List {
		if len(method.Names) < 1 {
			entity.rawExtends = append(entity.rawExtends, method.Type)
			continue
		}
		fun := &Function{
			Name:     method.Names[0].Name,
			EntId:    entity.ID,
			Document: TextWarp(method.Doc),
			Comment:  TextWarp(method.Comment),
			Scope:    InterfaceScope,
			file:     file,
			FileId:   file.ID,
			ID:       fmt.Sprintf("%s:%s.%s", entity.ID, entity.Name, method.Names[0].Name),
		}
		entity.AddMethod(fun)
		if method.Type == nil {
			continue
		}
		if funcType, ok := method.Type.(*ast.FuncType); ok {
			fun.Parse(funcType)
		}
		fun.expr = method.Type
	}
	v.file.AddEntity(entity)
}

// 处理通用声明
func (v *FileVisitor) handleGenDecl(node *ast.GenDecl) {
	switch node.Tok {
	case token.IMPORT:
		v.handleImport(node)
	case token.CONST, token.VAR:
		v.handleVarConst(node)
	default:

	}
}

// 处理导入声明
func (v *FileVisitor) handleImport(node *ast.GenDecl) {
	for _, spec := range node.Specs {
		if importSpec, ok := spec.(*ast.ImportSpec); ok {
			v.file.AddImport(importSpec)
		}
	}
}

// 处理变量和常量声明
func (v *FileVisitor) handleVarConst(node *ast.GenDecl) {
	for _, spec := range node.Specs {
		if valueSpec, ok := spec.(*ast.ValueSpec); ok {
			for _, name := range valueSpec.Names {
				file := v.file
				entityType := Variable
				if node.Tok == token.CONST {
					entityType = Constant
				}
				entity := &Entity{
					ID:     fmt.Sprintf("%s:%s", file.ID, name.Name),
					Type:   entityType,
					FileID: file.ID,
					Name:   name.Name,
				}
				entity.SetValueSpace(valueSpec)
				entity.Name = name.Name
				entity.Type = entityType
				if node.Doc != nil {
					for _, text := range node.Doc.List {
						entity.Comment += text.Text + "\n\t"
					}
				}

				v.file.AddEntity(entity)
			}
		}
	}
}

// 处理函数声明
func (v *FileVisitor) handleFuncDecl(node *ast.FuncDecl) {
	if node.Type == nil {
		return
	}
	file := v.file
	entId := file.ID
	fun := &Function{
		EntId:    entId,
		Name:     node.Name.Name,
		Data:     node.Body,
		Document: TextWarp(node.Doc),
		expr:     nil,
		Scope:    FunctionScope,
		PkgID:    file.PkgID,
		FileId:   file.ID,
		file:     file,
		decl:     node,
		ID:       fmt.Sprintf("%s:%s", file.PkgID, node.Name.Name),
	}
	fun.Parse(node.Type)
	if node.Recv != nil && len(node.Recv.List) > 0 && node.Recv.List[0].Type != nil {
		fun.Receiver = parseReceiver(node.Recv.List[0].Type)
		fun.ID = fmt.Sprintf("%s:%s.%s", file.PkgID, fun.Receiver, node.Name.Name)
		v.file.functionManager.AddMethod(fun)
	} else {
		v.file.functionManager.AddFunction(fun)
	}

}

func parseReceiver(expr ast.Expr) string {
	switch node := expr.(type) {
	case *ast.Ident: //标识符（Ident）
		return node.Name

	case *ast.StarExpr: //指针（StarExpr
		switch x := node.X.(type) {
		case *ast.Ident:
			return x.Name
		case *ast.IndexExpr: //指针+泛型（IndexExpr）
			if ident, ok := x.X.(*ast.Ident); ok {
				return ident.Name
			}
		}
	}
	return ""

}

type Text interface {
	Text() string
}

func TextWarp(text Text) string {
	if text == nil {
		return ""
	}
	return text.Text()
}

type FileContent struct {
	Content   string
	Language  v1.Language
	Functions []*Function
}
