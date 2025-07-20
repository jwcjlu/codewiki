package biz

import (
	"context"
	"go/ast"
	"go/token"
)

type EntityType int

const (
	_ EntityType = iota
	Struct
	Interface
	Constant
	Variable
)

type ScopeType int

const (
	_ ScopeType = iota
	StructScope
	FunctionScope
	InterfaceScope
)

type Entity struct {
	ID         string     `json:"id"`
	Type       EntityType `json:"type"`
	Name       string     `json:"name"`
	FileID     string     `json:"file_id"`
	Position   token.Position
	Definition string `json:"definition"`
	Relations  []Relation
	Embeddings []float64 `json:"-"`
	f          *ast.File
	Comment    string      `json:"comment"`
	Document   string      `json:"document"`  //根据语法树生成doc
	Functions  []*Function `json:"functions"` //实例方法,结构体的方法
	Fields     []*Field    `json:"fields"`
}

func (e *Entity) Parse(ctx context.Context, pkgId string) error {
	return nil
}

//InstanceMethod 实例方法,结构体的方法

type Function struct {
	EntId    string         `json:"ent_id"`
	Name     string         `json:"name"`
	Params   []*Field       `json:"params"`
	Results  []*Field       `json:"results"`
	Data     *ast.BlockStmt `json:"data"`
	Document string         `json:"document"`
	Comment  string         `json:"comment"`
	expr     ast.Expr
	recv     *ast.FieldList
	Scope    ScopeType `json:"scope"`
}

func (f *Function) Parse(ctx context.Context, node *ast.FuncType) {
	if node.Params != nil {
		for _, param := range node.Params.List {
			if len(param.Names) < 1 {
				continue
			}
			pField := Field{
				Name:     param.Names[0].Name,
				Document: TextWarp(param.Doc),
				expr:     param.Type,
				Comment:  TextWarp(param.Comment),
				Scope:    f.Scope,
			}
			f.Params = append(f.Params, &pField)
		}
	}
	if node.Results != nil {
		for _, result := range node.Results.List {
			if len(result.Names) < 1 {
				continue
			}
			pField := Field{
				Name:     result.Names[0].Name,
				Document: TextWarp(result.Doc),
				expr:     result.Type,
				Scope:    f.Scope,
				Comment:  TextWarp(result.Comment),
			}
			f.Results = append(f.Results, &pField)
		}
	}
}

type Field struct {
	Name     string `json:"name"`
	StructID string `json:"struct_id"`
	EntityID string `json:"entity_id"`
	Document string `json:"document"`
	Comment  string `json:"comment"`
	expr     ast.Expr
	Scope    ScopeType `json:"scope"`
}
