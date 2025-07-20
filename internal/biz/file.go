package biz

import (
	"context"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
)

type File struct {
	ID        string      `json:"id"`
	Name      string      `json:"name"`
	PkgID     string      `json:"pkg_id"`
	Entities  []*Entity   `json:"entities"`
	Functions []*Function `json:"functions"`
	f         *ast.File
	Imports   []Import
}

type Import struct {
	Name string
	Path string
}

func (e *File) Parse(ctx context.Context, pkgId string, filePath string) error {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, filePath, nil, parser.AllErrors|parser.ParseComments)
	if err != nil {
		return err
	}
	// 提取其他实体
	ast.Inspect(f, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.TypeSpec:
			e.parseTypeSpec(ctx, node, f)
		case *ast.GenDecl:
			e.parseGenDecl(ctx, node)
		case *ast.FuncDecl:
			e.parseFuncDecl(ctx, node, f)
		}

		return true
	})
	return nil
}

func (e *File) EntityCount() int {
	return len(e.Entities)
}

func (e *File) parseGenDecl(ctx context.Context, node *ast.GenDecl) {
	if node.Tok == token.CONST || node.Tok == token.VAR {
		for _, spec := range node.Specs {
			if value, ok := spec.(*ast.ValueSpec); ok && value.Names != nil {
				for _, name := range value.Names {
					entityType := Variable
					if node.Tok == token.CONST {
						entityType = Constant
					}
					e.Entities = append(e.Entities, &Entity{
						ID:     fmt.Sprintf("%s:%s", e.ID, name.Name),
						Type:   entityType,
						FileID: e.ID,
						Name:   name.Name,
					})
				}
			}
		}
	}
	if node.Tok == token.IMPORT {
		for _, spec := range node.Specs {
			spec, ok := spec.(*ast.ImportSpec)
			if ok {
				imp := Import{
					Path: spec.Path.Value,
				}
				if spec.Name != nil {
					imp.Name = spec.Name.Name
				}
				e.Imports = append(e.Imports, imp)
			}

		}
	}

}

func (e *File) parseTypeSpec(ctx context.Context, node *ast.TypeSpec, f *ast.File) {
	switch node.Type.(type) {
	case *ast.StructType:
		if structType, ok := node.Type.(*ast.StructType); ok {
			entity := Entity{
				ID:       fmt.Sprintf("%s:%s", e.ID, node.Name.Name),
				Type:     Struct,
				Name:     node.Name.Name,
				FileID:   e.ID,
				f:        f,
				Comment:  TextWarp(node.Comment),
				Document: TextWarp(node.Doc),
			}
			for _, field := range structType.Fields.List {
				if len(field.Names) < 1 {
					continue
				}
				fd := Field{Name: field.Names[0].Name, StructID: entity.ID, Document: TextWarp(field.Doc)}
				fd.Scope = StructScope
				entity.Fields = append(entity.Fields, &fd)
				if field.Type == nil {
					continue
				}
				fd.expr = field.Type

			}
			e.Entities = append(e.Entities, &entity)

		}
	case *ast.InterfaceType:
		if interfaceType, ok := node.Type.(*ast.InterfaceType); ok {
			entity := Entity{
				ID:       fmt.Sprintf("%s:%s", e.ID, node.Name.Name),
				Type:     Interface,
				Name:     node.Name.Name,
				FileID:   e.ID,
				f:        f,
				Comment:  TextWarp(node.Comment),
				Document: TextWarp(node.Doc),
			}
			for _, method := range interfaceType.Methods.List {
				if len(method.Names) < 1 {
					continue
				}
				fun := &Function{
					Name:     method.Names[0].Name,
					EntId:    entity.ID,
					Document: TextWarp(method.Doc),
					Comment:  TextWarp(method.Comment),
					Scope:    InterfaceScope,
				}
				entity.Functions = append(e.Functions, fun)
				if method.Type == nil {
					continue
				}

				if funcType, ok := method.Type.(*ast.FuncType); ok {
					fun.Parse(ctx, funcType)

				}
				fun.expr = method.Type
			}
			e.Entities = append(e.Entities, &entity)
		}
	}

}

func (e *File) parseFuncDecl(ctx context.Context, node *ast.FuncDecl, f *ast.File) {
	if node.Type == nil {
		return
	}
	entId := e.ID
	fun := Function{
		EntId:    entId,
		Name:     node.Name.Name,
		Data:     node.Body,
		Document: TextWarp(node.Doc),
		expr:     nil,
		Scope:    FunctionScope,
		recv:     node.Recv,
	}
	fun.Parse(ctx, node.Type)
	e.Functions = append(e.Functions, &fun)
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
