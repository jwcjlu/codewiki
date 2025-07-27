package biz

import (
	"context"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"
)

type File struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	PkgID       string      `json:"pkg_id"`
	Entities    []*Entity   `json:"entities"`
	Functions   []*Function `json:"functions"`
	f           *ast.File
	Imports     []*Import
	methods     []*Function
	localImport map[string]*Import //本工程的包
	pkg         *Package
	functionMap map[string]*Function
	entityMap   map[string]*Entity
}

func NewFile(name string, pkg *Package) *File {
	file := &File{
		localImport: make(map[string]*Import),
		Name:        name,
		PkgID:       pkg.ID,
		ID:          fmt.Sprintf("%s@%s", pkg.ID, name),
		pkg:         pkg,
		functionMap: make(map[string]*Function),
		entityMap:   make(map[string]*Entity),
	}

	return file
}

type Import struct {
	Name string
	Path string
}

func (imp *Import) GetRef() string {
	if len(imp.Name) > 0 {
		return imp.Name
	}
	return filepath.Base(imp.Path)
}

func (file *File) Parse(ctx context.Context, filePath string, pkg *Package) error {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, filePath, nil, parser.AllErrors|parser.ParseComments)
	if err != nil {
		return err
	}
	// 提取其他实体
	ast.Inspect(f, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.TypeSpec:
			file.parseTypeSpec(ctx, node, f, pkg)
		case *ast.GenDecl:
			file.parseGenDecl(ctx, node)
		case *ast.FuncDecl:
			file.parseFuncDecl(ctx, node, f)
		}

		return true
	})
	return nil
}

func (file *File) EntityCount() int {
	return len(file.Entities)
}

func (file *File) parseGenDecl(ctx context.Context, node *ast.GenDecl) {
	if node.Tok == token.CONST || node.Tok == token.VAR {
		for _, spec := range node.Specs {
			if value, ok := spec.(*ast.ValueSpec); ok && value.Names != nil {
				for _, name := range value.Names {
					entityType := Variable
					if node.Tok == token.CONST {
						entityType = Constant
					}
					entity := &Entity{
						ID:          fmt.Sprintf("%s:%s", file.ID, name.Name),
						Type:        entityType,
						FileID:      file.ID,
						Name:        name.Name,
						fieldMap:    make(map[string]*Field),
						functionMap: make(map[string]*Function),
					}
					file.Entities = append(file.Entities, entity)
					file.entityMap[entity.Name] = entity
				}
			}
		}
	}
	if node.Tok == token.IMPORT {
		for _, spec := range node.Specs {
			spec, ok := spec.(*ast.ImportSpec)
			if ok {
				imp := &Import{
					Path: strings.Trim(spec.Path.Value, `"`),
				}
				if spec.Name != nil {
					imp.Name = spec.Name.Name
				}
				file.Imports = append(file.Imports, imp)
				if strings.Contains(imp.Path, file.pkg.GetModule()) {
					imp.Path = strings.Trim(imp.Path, file.pkg.GetModule())
					file.localImport[imp.GetRef()] = imp
				}

			}

		}
	}

}

func (file *File) parseTypeSpec(ctx context.Context, node *ast.TypeSpec, f *ast.File, pkg *Package) {
	switch node.Type.(type) {
	case *ast.StructType:
		if structType, ok := node.Type.(*ast.StructType); ok {
			entity := Entity{
				ID:          fmt.Sprintf("%s:%s", file.ID, node.Name.Name),
				Type:        Struct,
				Name:        node.Name.Name,
				FileID:      file.ID,
				f:           f,
				Comment:     TextWarp(node.Comment),
				Document:    TextWarp(node.Doc),
				PkgID:       file.PkgID,
				fieldMap:    make(map[string]*Field),
				functionMap: make(map[string]*Function),
			}

			for _, field := range structType.Fields.List {
				fd := Field{
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

				entity.Fields = append(entity.Fields, &fd)
				entity.fieldMap[fd.Name] = &fd
			}
			file.Entities = append(file.Entities, &entity)
			file.entityMap[entity.Name] = &entity
			pkg.AddEntity(entity.Name, &entity)
			pkg.project.AddEntity(entity.ID, &entity)
		}
	case *ast.InterfaceType:
		if interfaceType, ok := node.Type.(*ast.InterfaceType); ok {
			entity := Entity{
				ID:          fmt.Sprintf("%s:%s", file.ID, node.Name.Name),
				Type:        Interface,
				Name:        node.Name.Name,
				FileID:      file.ID,
				f:           f,
				PkgID:       file.PkgID,
				Comment:     TextWarp(node.Comment),
				Document:    TextWarp(node.Doc),
				fieldMap:    make(map[string]*Field),
				functionMap: make(map[string]*Function),
			}
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
					ID:       fmt.Sprintf("%s:%s", entity.ID, method.Names[0].Name),
				}
				entity.Functions = append(entity.Functions, fun)
				file.functionMap[fun.Name] = fun
				entity.functionMap[fun.Name] = fun
				if method.Type == nil {
					continue
				}
				if funcType, ok := method.Type.(*ast.FuncType); ok {
					fun.Parse(ctx, funcType)
				}
				fun.expr = method.Type
			}
			file.Entities = append(file.Entities, &entity)
			file.entityMap[entity.Name] = &entity
			pkg.AddEntity(entity.Name, &entity)
			pkg.project.AddEntity(entity.ID, &entity)
		}
	}

}

func (file *File) parseFuncDecl(ctx context.Context, node *ast.FuncDecl, f *ast.File) {
	if node.Type == nil {
		return
	}
	entId := file.ID
	fun := &Function{
		EntId:    entId,
		Name:     node.Name.Name,
		Data:     node.Body,
		Document: TextWarp(node.Doc),
		expr:     nil,
		Scope:    FunctionScope,
		PkgID:    file.PkgID,
		ID:       fmt.Sprintf("%s:%s", file.PkgID, node.Name.Name),
	}
	fun.Parse(ctx, node.Type)
	if node.Recv != nil && len(node.Recv.List) > 0 && node.Recv.List[0].Type != nil {
		fun.Receiver = parseReceiver(node.Recv.List[0].Type)
		file.methods = append(file.methods, fun)
		file.functionMap[fun.Name] = fun

	} else {
		file.functionMap[fun.Name] = fun
		file.pkg.AddFunction(fun.Name, fun)
		file.Functions = append(file.Functions, fun)
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
func (file *File) AnalyzeRelations(ctx context.Context, pkg *Package) error {
	var relations []*Relation
	for _, entity := range file.Entities {
		if rs, err := entity.AnalyzeRelations(ctx, file); err != nil {
			return err
		} else {
			relations = append(relations, rs...)
		}
	}
	for _, fun := range file.Functions {
		relations = append(relations, fun.AnalyzeRelations(ctx, file)...)
	}
	file.pkg.GetProject().AddRelations(relations)
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
	for _, e := range file.Entities {
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
	for _, fun := range file.methods {
		structEntity, ok := pkg.structMap[fun.Receiver]
		if !ok {
			continue
		}
		structEntity.Functions = append(structEntity.Functions, fun)
		structEntity.functionMap[fun.Name] = fun
	}
}

func (file *File) ClassifyExtends(ctx context.Context, pkg *Package) {
	for _, entity := range file.Entities {
		entity.HandlerExtends(file, pkg)
	}

}
func (file *File) GetEntity(name string) *Entity {
	entity := file.entityMap[name]
	if entity != nil {
		return entity
	}
	for _, f := range file.pkg.Files {
		entity = f.entityMap[name]
		if entity != nil {
			return entity
		}
	}
	return nil
}

func (file *File) GetEntityForImport(importName, entityName string) *Entity {
	imp, ok := file.localImport[importName]
	if !ok {
		return nil
	}
	pkgKey := strings.ReplaceAll(fmt.Sprintf("%s", strings.TrimPrefix(imp.Path, "/")), "/", "@")
	return file.pkg.GetProject().GetEntity(pkgKey, entityName)

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
