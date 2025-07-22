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
	methods   []*Function
}

type Import struct {
	Name string
	Path string
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
					file.Entities = append(file.Entities, &Entity{
						ID:     fmt.Sprintf("%s:%s", file.ID, name.Name),
						Type:   entityType,
						FileID: file.ID,
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
				file.Imports = append(file.Imports, imp)
			}

		}
	}

}

func (file *File) parseTypeSpec(ctx context.Context, node *ast.TypeSpec, f *ast.File, pkg *Package) {
	switch node.Type.(type) {
	case *ast.StructType:
		if structType, ok := node.Type.(*ast.StructType); ok {
			entity := Entity{
				ID:       fmt.Sprintf("%s:%s", file.ID, node.Name.Name),
				Type:     Struct,
				Name:     node.Name.Name,
				FileID:   file.ID,
				f:        f,
				Comment:  TextWarp(node.Comment),
				Document: TextWarp(node.Doc),
				PkgID:    file.PkgID,
			}
			for _, field := range structType.Fields.List {
				if len(field.Names) < 1 {
					continue
				}
				fd := Field{
					Name:     field.Names[0].Name,
					StructID: entity.ID,
					Document: TextWarp(field.Doc),
				}
				fd.Scope = StructScope

				entity.Fields = append(entity.Fields, &fd)
				if field.Type == nil {
					continue
				}
				fd.expr = field.Type

			}
			file.Entities = append(file.Entities, &entity)
			pkg.AddEntity(entity.Name, &entity)
		}
	case *ast.InterfaceType:
		if interfaceType, ok := node.Type.(*ast.InterfaceType); ok {
			entity := Entity{
				ID:       fmt.Sprintf("%s:%s", file.ID, node.Name.Name),
				Type:     Interface,
				Name:     node.Name.Name,
				FileID:   file.ID,
				f:        f,
				PkgID:    file.PkgID,
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
				entity.Functions = append(file.Functions, fun)
				if method.Type == nil {
					continue
				}

				if funcType, ok := method.Type.(*ast.FuncType); ok {
					fun.Parse(ctx, funcType)

				}
				fun.expr = method.Type
			}
			file.Entities = append(file.Entities, &entity)
		}
	}

}

func (file *File) parseFuncDecl(ctx context.Context, node *ast.FuncDecl, f *ast.File) {
	if node.Type == nil {
		return
	}
	entId := file.ID
	fun := Function{
		EntId:    entId,
		Name:     node.Name.Name,
		Data:     node.Body,
		Document: TextWarp(node.Doc),
		expr:     nil,
		Scope:    FunctionScope,
		PkgID:    file.PkgID,
	}
	fun.Parse(ctx, node.Type)
	if node.Recv != nil && len(node.Recv.List) > 0 && node.Recv.List[0].Type != nil {
		fun.Receiver = parseReceiver(node.Recv.List[0].Type)
		file.methods = append(file.methods, &fun)
	} else {
		file.Functions = append(file.Functions, &fun)
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
	for _, fun := range file.methods {
		structEntity, ok := pkg.structMap[fun.Receiver]
		if !ok {
			continue
		}
		structEntity.Functions = append(structEntity.Functions, fun)
		fmt.Println(structEntity.Name, ".", fun.Name)

	}

	return nil
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
