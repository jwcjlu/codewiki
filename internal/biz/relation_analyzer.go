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
	case *ast.ArrayType:
		// 数组/切片：取元素类型
		return ra.resolveTypeEntity(t.Elt)
	case *ast.MapType:
		// map：取 value 类型
		return ra.resolveTypeEntity(t.Value)
	case *ast.IndexExpr:
		// 泛型实例：退回到基础类型
		return ra.resolveTypeEntity(t.X)
	case *ast.IndexListExpr:
		// 泛型多实参：退回到基础类型
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
		entities:  make(map[string]*Entity),
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

func (v *FunctionCallVisitor) GetFunctionForImport(importName, functionName string) *Function {
	if function := v.analyzer.file.GetFunctionForImport(importName, functionName); function != nil {
		return function
	}
	return v.function.file.GetFunctionForImport(importName, functionName)
}

func (v *FunctionCallVisitor) GetEntityForImport(importName, entityName string) *Entity {
	if entity := v.analyzer.file.GetEntityForImport(importName, entityName); entity != nil {
		return entity
	}
	if entity := v.function.file.GetEntityForImport(importName, entityName); entity != nil {
		return entity
	}
	return v.entities[entityName]
}

func (v *FunctionCallVisitor) GetEntity(name string) *Entity {
	entity := v.entities[name]
	if entity != nil {
		return entity
	}
	return v.analyzer.pkg.GetEntity(name)
}
func (v *FunctionCallVisitor) Visit(node ast.Node) ast.Visitor {
	if node == nil {
		return nil
	}
	switch n := node.(type) {
	case *ast.CallExpr:
		v.handleCallExpr(n)
	case *ast.AssignStmt:
		v.handleAssign(n)
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
			if function := v.GetFunctionForImport(x.Name, selector.Sel.Name); function != nil {
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
		} else {
			entity, ok := v.entities[x.Name]
			if ok {
				if function := entity.FindMethodByName(selector.Sel.Name); function != nil {
					v.relations = append(v.relations, &Relation{
						Type:       Call,
						SourceID:   v.function.ID,
						TargetID:   function.ID,
						Confidence: 1,
					})
				}
			}

		}

	case *ast.SelectorExpr:
		// 处理链式调用
		if entity := v.resolveEntityFromSelector(x); entity != nil {
			// 情况 A：x 解析到的是包变量/常量实体（非结构体/接口）。尝试根据值空间推断其类型再取方法
			if entity.Type != Struct && entity.Type != Interface {
				if recvEnt := v.resolveEntityFromVariable(entity); recvEnt != nil {
					if function := recvEnt.FindMethodByName(selector.Sel.Name); function != nil {
						v.relations = append(v.relations, &Relation{
							Type:       Call,
							SourceID:   v.function.ID,
							TargetID:   function.ID,
							Confidence: 1,
						})
						return
					}
				}
			}
			// 情况 B：x 是结构体/接口或无法从变量值空间推出，按字段->方法链处理
			if field := entity.FindFieldByName(x.Sel.Name); field != nil {
				if function := field.FindFunctionByName(selector.Sel.Name, v.analyzer.file); function != nil {
					v.relations = append(v.relations, &Relation{
						Type:       Call,
						SourceID:   v.function.ID,
						TargetID:   function.ID,
						Confidence: 1,
					})
					return
				}
			}
		}
	case *ast.CallExpr:
		// 处理返回实例再调用方法的链式调用，例如: GetRepo().Analyzer()
		if entity := v.resolveEntityFromCall(x); entity != nil {
			if function := entity.FindMethodByName(selector.Sel.Name); function != nil {
				v.relations = append(v.relations, &Relation{
					Type:       Call,
					SourceID:   v.function.ID,
					TargetID:   function.ID,
					Confidence: 1,
				})
			}
		}
	case *ast.IndexExpr:
		// arr[i].Method() 或 m[k].Method()，解析元素/值类型
		if entity := v.resolveEntityFromIndex(x); entity != nil {
			if function := entity.FindMethodByName(selector.Sel.Name); function != nil {
				v.relations = append(v.relations, &Relation{
					Type:       Call,
					SourceID:   v.function.ID,
					TargetID:   function.ID,
					Confidence: 1,
				})
			}
		}
	case *ast.TypeAssertExpr:
		// x.(T).Method()
		if entity := v.resolveEntityFromTypeAssert(x); entity != nil {
			if function := entity.FindMethodByName(selector.Sel.Name); function != nil {
				v.relations = append(v.relations, &Relation{
					Type:       Call,
					SourceID:   v.function.ID,
					TargetID:   function.ID,
					Confidence: 1,
				})
			}
		}
	case *ast.StarExpr:
		// (*ptr).Method() 或 指针解引用后的调用
		if entity := v.resolveEntityFromExpr(x.X); entity != nil {
			if function := entity.FindMethodByName(selector.Sel.Name); function != nil {
				v.relations = append(v.relations, &Relation{
					Type:       Call,
					SourceID:   v.function.ID,
					TargetID:   function.ID,
					Confidence: 1,
				})
			}
		}
	case *ast.UnaryExpr:
		// (&obj).Method() 或 *expr 的一元操作，向内解析
		if entity := v.resolveEntityFromUnary(x); entity != nil {
			if function := entity.FindMethodByName(selector.Sel.Name); function != nil {
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
		} else {
			return v.entities[ident.Name]
		}
	}

	return nil
}

func (v *FunctionCallVisitor) resolveEntityFromSelector(selector *ast.SelectorExpr) *Entity {
	switch x := selector.X.(type) {
	case *ast.Ident:
		// 优先按导入包解析：pkg.Type / pkg.Var
		if ent := v.GetEntityForImport(x.Name, selector.Sel.Name); ent != nil {
			return ent
		}
		// 否则尝试当作本地标识符（变量/常量/类型）
		return v.resolveEntityFromIdent(x)
	case *ast.SelectorExpr:
		// 链式：递归解析左侧
		if ent := v.resolveEntityFromSelector(x); ent != nil {
			// 若左侧是实体，尝试其字段的类型
			if field := ent.FindFieldByName(x.Sel.Name); field != nil {
				return v.analyzer.resolveTypeEntity(field.expr)
			}
			return ent
		}
	case *ast.CallExpr:
		// 调用返回值再取选择子
		if ent := v.resolveEntityFromCall(x); ent != nil {
			return ent
		}
	}
	return nil
}

func (v *FunctionCallVisitor) resolveEntityFromExpr(expr ast.Expr) *Entity {
	switch t := expr.(type) {
	case *ast.Ident:
		return v.GetEntity(t.Name)
	case *ast.StarExpr:
		return v.resolveEntityFromExpr(t.X)
	case *ast.SelectorExpr:
		return v.resolveEntityFromSelector(t)
	case *ast.ArrayType:
		return v.resolveEntityFromExpr(t.Elt)
	case *ast.MapType:
		return v.resolveEntityFromExpr(t.Value)
	case *ast.IndexExpr:
		return v.resolveEntityFromExpr(t.X)
	case *ast.IndexListExpr:
		return v.resolveEntityFromExpr(t.X)
	case *ast.TypeAssertExpr:
		return v.analyzer.resolveTypeEntity(t.Type)
	}
	return nil
}

// resolveEntityFromCall 根据调用表达式推断其返回的实体类型（取第一个返回值）
func (v *FunctionCallVisitor) resolveEntityFromCall(call *ast.CallExpr) *Entity {
	var callee *Function
	switch fun := call.Fun.(type) {
	case *ast.Ident:
		callee = v.analyzer.file.GetFunctionByNameInPackage(fun.Name)
	case *ast.SelectorExpr:
		// 包级函数调用: pkg.Func()
		if ident, ok := fun.X.(*ast.Ident); ok && ident.Obj == nil {
			callee = v.GetFunctionForImport(ident.Name, fun.Sel.Name)
		} else {
			// 方法调用: obj.Method() 或 链式 obj.Field.Method()
			// 解析接收者实体，然后拿到方法定义
			if ident, ok := fun.X.(*ast.Ident); ok {
				if entity := v.resolveEntityFromIdent(ident); entity != nil {
					callee = entity.FindMethodByName(fun.Sel.Name)
				}
			}
			if callee == nil {
				if selX, ok := fun.X.(*ast.SelectorExpr); ok {
					// 针对 obj.Field.Method()，先根据字段类型定位方法
					if entity := v.resolveEntityFromSelector(selX); entity != nil {
						if field := entity.FindFieldByName(selX.Sel.Name); field != nil {
							callee = field.FindFunctionByName(fun.Sel.Name, v.analyzer.file)
						}
					}
				}
			}
		}
	}

	if callee == nil || len(callee.Results) == 0 {
		return nil
	}
	// 仅取第一个返回值的类型去解析实体
	firstResult := callee.Results[0]
	if firstResult == nil {
		return nil
	}

	return NewRelationAnalyzer(callee.file, callee.file.GetCurrentPkg()).resolveTypeEntity(firstResult.expr)
}

// resolveEntityFromIndex 解析下标访问后的元素/值类型实体
func (v *FunctionCallVisitor) resolveEntityFromIndex(idx *ast.IndexExpr) *Entity {
	switch base := idx.X.(type) {
	case *ast.Ident:
		if base.Obj == nil {
			return nil
		}
		if decl, ok := base.Obj.Decl.(*ast.ValueSpec); ok {
			if decl.Type == nil {
				return nil
			}
			switch t := decl.Type.(type) {
			case *ast.ArrayType:
				return v.analyzer.resolveTypeEntity(t.Elt)
			case *ast.MapType:
				return v.analyzer.resolveTypeEntity(t.Value)
			default:
				return v.analyzer.resolveTypeEntity(t)
			}
		}
	case *ast.SelectorExpr:
		// pkg.Var[i]：尝试将 pkg.Var 作为变量实体再取其类型的元素
		if ent := v.resolveEntityFromSelector(base); ent != nil {
			// 非结构体/接口实体，FindFieldByName 会回落到值空间类型
			fld := ent.FindFieldByName(base.Sel.Name)
			if fld != nil {
				switch t := fld.expr.(type) {
				case *ast.ArrayType:
					return v.analyzer.resolveTypeEntity(t.Elt)
				case *ast.MapType:
					return v.analyzer.resolveTypeEntity(t.Value)
				default:
					return v.analyzer.resolveTypeEntity(t)
				}
			}
		}
	}
	return nil
}

// resolveEntityFromTypeAssert 解析类型断言后的实体
func (v *FunctionCallVisitor) resolveEntityFromTypeAssert(ta *ast.TypeAssertExpr) *Entity {
	if ta.Type == nil {
		return nil
	}
	return v.analyzer.resolveTypeEntity(ta.Type)
}

// resolveEntityFromUnary 解析一元表达式（取址/解引用）后的实体
func (v *FunctionCallVisitor) resolveEntityFromUnary(ue *ast.UnaryExpr) *Entity {
	if ue.X == nil {
		return nil
	}
	switch ue.Op {
	// &obj 或 *obj：都向内解析其基础实体
	default:
		return v.resolveEntityFromExpr(ue.X)
	}
}

// resolveEntityFromVariable 尝试从包级变量/常量实体的值空间推断其真实类型实体
func (v *FunctionCallVisitor) resolveEntityFromVariable(ent *Entity) *Entity {
	if ent == nil || ent.vSpace == nil {
		return nil
	}
	// 显式类型：直接解析
	if ent.vSpace.Type != nil {
		return v.analyzer.resolveTypeEntity(ent.vSpace.Type)
	}
	// 从初始化表达式推断：取首个值
	if len(ent.vSpace.Values) == 0 {
		return nil
	}
	val := ent.vSpace.Values[0]
	switch e := val.(type) {
	case *ast.CallExpr:
		// 例如：var X = pkg.New()
		return v.resolveEntityFromCall(e)
	case *ast.CompositeLit:
		// 例如：var X = T{...}
		return v.analyzer.resolveTypeEntity(e.Type)
	case *ast.UnaryExpr:
		// 例如：var X = &T{...}
		if cl, ok := e.X.(*ast.CompositeLit); ok {
			return v.analyzer.resolveTypeEntity(cl.Type)
		}
		return v.resolveEntityFromExpr(e.X)
	case *ast.Ident:
		return v.analyzer.resolveTypeEntity(e)
	case *ast.SelectorExpr:
		return v.analyzer.resolveTypeEntity(e)
	}
	return nil
}

func (v *FunctionCallVisitor) handleAssign(assign *ast.AssignStmt) {
	for index, expr := range assign.Lhs {
		switch t := expr.(type) {
		case *ast.Ident:
			v.handleIdentEntity(t, index)
		}
	}
}
func (v *FunctionCallVisitor) handleIdentEntity(ident *ast.Ident, index int) {
	name := ident.Name
	if ident.Obj == nil {
		return
	}
	switch decl := ident.Obj.Decl.(type) {
	case *ast.ValueSpec:
		if decl.Type == nil {
			return
		}
		switch declType := decl.Type.(type) {
		case *ast.SelectorExpr:
			implName := ""
			if x, ok := declType.X.(*ast.Ident); ok {
				implName = x.Name
			}
			entity := v.GetEntityForImport(implName, declType.Sel.Name)
			if entity == nil {
				return
			}
			v.entities[name] = entity
		}
	case *ast.AssignStmt:
		v.handleAssignStmt(name, index, decl)
	}
}

func (v *FunctionCallVisitor) handleAssignStmt(name string, index int, as *ast.AssignStmt) {

	for _, expr := range as.Rhs {
		switch t := expr.(type) {
		case *ast.CallExpr:
			switch tf := t.Fun.(type) {
			case *ast.SelectorExpr:
				implName := ""
				if x, ok := tf.X.(*ast.Ident); ok {
					implName = x.Name
				}
				function := v.GetFunctionForImport(implName, tf.Sel.Name)
				if function == nil {
					return
				}
				if len(function.Results) <= index {
					return
				}
				field := function.Results[index]
				if field == nil {
					return
				}
				entity := v.GetEntityForImport(implName, field.FieldName())
				if entity == nil {
					return
				}
				v.entities[name] = entity
			}
		}
	}
}
