package biz

import (
	"fmt"
	"go/ast"
)

const (
	Contains      = "Contains"      //包含
	ContainsFile  = "ContainsFile"  //包含
	DeclareFunc   = "DeclareFunc"   //声明
	DeclareEntity = "DeclareEntity" //声明
	HasFields     = "HasFields"     //有某字段
	HasMethod     = "HasMethod"     //有某方法
	Implement     = "Implement"     //实现
	Call          = "Call"          //调用
	Extends       = "Extends"       //继承
	Imports       = "Import"
)

type Relation struct {
	Type       string
	TargetID   string
	Confidence float64
	SourceID   string
}

func (r *Relation) UnionKey() string {

	return fmt.Sprintf("%s#%s#%s", r.SourceID, r.Type, r.TargetID)
}

// RelationAnalyzer 关系分析器
type RelationAnalyzer struct {
	file *File
	pkg  *Package
}

// NewRelationAnalyzer 关系分析器
func NewRelationAnalyzer(file *File, pkg *Package) *RelationAnalyzer {
	return &RelationAnalyzer{
		file: file,
		pkg:  pkg,
	}
}

func (ra *RelationAnalyzer) AnalyzeEntityRelations() ([]*Relation, error) {
	var relations []*Relation
	for _, e := range ra.file.GetEntities() {

		// 分析字段关系
		for _, field := range e.GetFields() {
			fieldRelations := ra.analyzeFieldRelations(field, e)
			relations = append(relations, fieldRelations...)
		}

		// 分析方法关系
		for _, fun := range e.GetMethods() {
			if fun.Data == nil {
				continue
			}
			funRelations := ra.analyzeFunctionRelations(fun, e)
			relations = append(relations, funRelations...)
		}
		for _, ee := range e.Extends {
			relations = append(relations, &Relation{
				Type:       Extends,
				TargetID:   ee.ID,
				Confidence: 1,
				SourceID:   e.ID,
			})
		}
		relations = append(relations, &Relation{
			Type:       DeclareEntity,
			TargetID:   e.ID,
			Confidence: 1,
			SourceID:   ra.file.ID,
		})
	}
	for _, fun := range ra.file.GetFunctions() {
		//添加声明函数的关系
		relations = append(relations, &Relation{
			Type:       DeclareFunc,
			TargetID:   fun.ID,
			Confidence: 1,
			SourceID:   ra.file.ID,
		})
		funRelations := ra.analyzeFunctionRelations(fun, nil)
		relations = append(relations, funRelations...)
	}
	return relations, nil
}

func (ra *RelationAnalyzer) analyzeFieldRelations(field *Field, entity *Entity) []*Relation {
	if field.expr == nil {
		return nil
	}
	var relations []*Relation
	typeEntity := ra.resolveTypeEntity(field.expr)
	if typeEntity != nil && typeEntity.ID != entity.ID {
		relations = append(relations, &Relation{
			Type:       HasFields,
			TargetID:   typeEntity.ID,
			Confidence: 1,
			SourceID:   entity.ID,
		})
	}

	return relations
}

func (ra *RelationAnalyzer) analyzeFunctionRelations(fun *Function, entity *Entity) []*Relation {
	var relations []*Relation

	// 添加方法关系
	if entity != nil {
		relations = append(relations, &Relation{
			Type:       HasMethod,
			TargetID:   fun.ID,
			Confidence: 1,
			SourceID:   entity.ID,
		})
	}
	// 分析函数调用关系
	callRelations := ra.analyzeFunctionCalls(fun)
	relations = append(relations, callRelations...)

	return relations
}
func (ra *RelationAnalyzer) resolveTypeEntity(expr ast.Expr) *Entity {
	switch t := expr.(type) {
	case *ast.Ident:
		return ra.pkg.GetEntity(t.Name)
	case *ast.SelectorExpr:
		if ident, ok := t.X.(*ast.Ident); ok {
			return ra.file.GetEntityForImport(ident.Name, t.Sel.Name)
		}
	case *ast.StarExpr:
		return ra.resolveTypeEntity(t.X)
	}
	return nil
}

// analyzeFunctionCalls 分析函数调用关系
func (ra *RelationAnalyzer) analyzeFunctionCalls(fun *Function) []*Relation {
	if fun.Data == nil {
		return nil
	}

	visitor := &FunctionCallVisitor{
		relations: make([]*Relation, 0),
		function:  fun,
		analyzer:  ra,
	}
	// 遍历AST
	ast.Walk(visitor, fun.Data)
	return visitor.relations
}

// FunctionCallVisitor 函数调用访问器
type FunctionCallVisitor struct {
	relations []*Relation
	function  *Function
	analyzer  *RelationAnalyzer
	entities  map[string]*Entity
}

func (v *FunctionCallVisitor) Visit(node ast.Node) ast.Visitor {
	if node == nil {
		return nil
	}

	switch n := node.(type) {
	case *ast.CallExpr:
		v.handleCallExpr(n)
	}

	return v
}

func (v *FunctionCallVisitor) handleCallExpr(call *ast.CallExpr) {
	switch fun := call.Fun.(type) {
	case *ast.Ident:
		// 直接函数调用
		if function := v.analyzer.file.GetFunctionByNameInPackage(fun.Name); function != nil {
			v.relations = append(v.relations, &Relation{
				Type:       Call,
				SourceID:   v.function.ID,
				TargetID:   function.ID,
				Confidence: 1,
			})
		}

	case *ast.SelectorExpr:
		v.handleSelectorExpr(fun)
	}
}

func (v *FunctionCallVisitor) handleSelectorExpr(selector *ast.SelectorExpr) {
	switch x := selector.X.(type) {
	case *ast.Ident:
		if x.Obj == nil { // 其他包的方法直接调用eg:os.OpenFile("empty.go")
			if function := v.analyzer.file.GetFunctionForImport(x.Name, selector.Sel.Name); function != nil {
				v.relations = append(v.relations, &Relation{
					Type:       Call,
					SourceID:   v.function.ID,
					TargetID:   function.ID,
					Confidence: 1,
				})
			}
			return
		}

		if entity := v.resolveEntityFromIdent(x); entity != nil { // 处理实体方法调用eg:e.Server("empty.go")
			if function := entity.FindMethodByName(selector.Sel.Name); function != nil {
				v.relations = append(v.relations, &Relation{
					Type:       Call,
					SourceID:   v.function.ID,
					TargetID:   function.ID,
					Confidence: 1,
				})
			}
		}

	case *ast.SelectorExpr:
		// 处理链式调用
		if entity := v.resolveEntityFromSelector(x); entity != nil {
			if field := entity.FindFieldByName(x.Sel.Name); field != nil {
				if function := field.FindFunctionByName(selector.Sel.Name, v.analyzer.file); function != nil {
					v.relations = append(v.relations, &Relation{
						Type:       Call,
						SourceID:   v.function.ID,
						TargetID:   function.ID,
						Confidence: 1,
					})
				}
			}
		}
	}
}

func (v *FunctionCallVisitor) resolveEntityFromIdent(ident *ast.Ident) *Entity {
	if ident.Obj == nil {
		return nil
	}

	switch decl := ident.Obj.Decl.(type) {
	case *ast.Field:
		return v.resolveEntityFromExpr(decl.Type)
	case *ast.ValueSpec:
		if len(decl.Values) > 0 {
			return v.resolveEntityFromExpr(decl.Type)
		}
	}

	return nil
}

func (v *FunctionCallVisitor) resolveEntityFromSelector(selector *ast.SelectorExpr) *Entity {
	if ident, ok := selector.X.(*ast.Ident); ok {
		return v.analyzer.file.GetEntityForImport(ident.Name, selector.Sel.Name)
	}
	return nil
}

func (v *FunctionCallVisitor) resolveEntityFromExpr(expr ast.Expr) *Entity {
	switch t := expr.(type) {
	case *ast.Ident:
		return v.analyzer.pkg.GetEntity(t.Name)
	case *ast.StarExpr:
		return v.resolveEntityFromExpr(t.X)
	case *ast.SelectorExpr:
		return v.resolveEntityFromSelector(t)
	}
	return nil
}
