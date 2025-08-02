package biz

import (
	"context"
	"fmt"
	"go/ast"
	"go/token"
	"go/types"
	"strings"
)

type EntityType int

const (
	_ EntityType = iota
	Struct
	Interface
	Constant
	Variable
)

func (et EntityType) Type() string {
	switch et {
	case Struct:
		return "Struct"
	case Interface:
		return "Interface"
	case Constant:
		return "Constant"
	case Variable:
		return "Variable"
	default:
		return "Entity"
	}
}

type ScopeType int

const (
	_ ScopeType = iota
	StructScope
	FunctionScope
	InterfaceScope
)

type Entity struct {
	ID          string     `json:"id"`
	Type        EntityType `json:"type"`
	Name        string     `json:"name"`
	FileID      string     `json:"file_id"`
	PkgID       string     `json:"pkg_id"`
	Position    token.Position
	Definition  string `json:"definition"`
	Relations   []Relation
	Embeddings  []float64 `json:"-"`
	f           *ast.File
	Comment     string      `json:"comment"`
	Document    string      `json:"document"`  //根据语法树生成doc
	Functions   []*Function `json:"functions"` //实例方法,结构体的方法
	Fields      []*Field    `json:"fields"`
	fieldMap    map[string]*Field
	functionMap map[string]*Function
	Extends     []*Entity  //继承
	rawExtends  []ast.Expr //继承
}

func (e *Entity) CountFunction() int {
	count := len(e.Functions)
	for _, extend := range e.Extends {
		count += len(extend.Functions)
	}
	return count

}

func (e *Entity) AnalyzeRelations(ctx context.Context, file *File) ([]*Relation, error) {
	var relations []*Relation
	for _, field := range e.Fields {
		if field.expr == nil {
			continue
		}
		switch ex := field.expr.(type) {
		case *ast.SelectorExpr:
			var entity *Entity
			if ident, ok := ex.X.(*ast.Ident); ok {
				entity = file.GetEntityForImport(ident.Name, ex.Sel.Name)
			}
			if entity == nil {
				continue
			}
			relations = append(relations, &Relation{
				Type:       HasFields,
				TargetID:   entity.ID,
				Confidence: 1,
				SourceID:   e.ID,
			})

		}
	}
	for _, fun := range e.Functions {
		if fun.Data == nil {
			continue
		}
		relations = append(relations, fun.AnalyzeRelations(ctx, file)...)
		relations = append(relations, &Relation{
			Type:       HasMethod,
			TargetID:   fun.ID,
			Confidence: 1,
			SourceID:   e.ID,
		})

	}
	return relations, nil
}

func (e *Entity) FindFunctionByName(name string) *Function {
	if e == nil {
		return nil
	}
	for _, f := range e.Functions {
		if f.Name == name {
			return f
		}
	}
	return nil
}

// HandlerExtends 处理继承问题
func (e *Entity) HandlerExtends(file *File, pkg *Package) {
	for _, rawExtendType := range e.rawExtends {

		switch extendType := rawExtendType.(type) {
		case *ast.Ident:
			entity, ok := pkg.structMap[extendType.Name]
			if ok {
				e.Extends = append(e.Extends, entity)
			}
		case *ast.SelectorExpr:
			var implName string
			et, ok := extendType.X.(*ast.Ident)
			if !ok {
				continue

			}
			implName = et.Name
			entity := pkg.GetProject().GetEntity(implName, extendType.Sel.Name)
			if entity != nil {
				e.Extends = append(e.Extends, entity)
			}
		case *ast.StarExpr:
			if ident, ok := extendType.X.(*ast.Ident); ok {
				entity, ok := pkg.structMap[ident.Name]
				if ok {
					e.Extends = append(e.Extends, entity)
				}
			}
		case *ast.IndexExpr:
			if selectorExpr, ok := extendType.X.(*ast.SelectorExpr); ok {
				var implName string
				et, ok := selectorExpr.X.(*ast.Ident)
				if !ok {
					continue

				}
				implName = et.Name
				entity := file.GetEntityForImport(implName, selectorExpr.Sel.Name)
				if entity != nil {
					e.Extends = append(e.Extends, entity)
				}
			}

		default:
			fmt.Println("<UNK>", extendType)

		}

	}

}

// IsImplInterface 是否实现改接口
func (e *Entity) IsImplInterface(interfaceEntity *Entity) bool {

	functions := interfaceEntity.Functions
	//接口继承的方法也要加上
	for _, extend := range interfaceEntity.Extends {
		functions = append(functions, extend.Functions...)
	}
	//实体继承的方法
	extendsFunctionMap := make(map[string]*Function)
	for _, extend := range e.Extends {
		for _, function := range extend.Functions {
			extendsFunctionMap[function.Name] = function
		}
	}
	if len(e.Functions)+len(extendsFunctionMap) < len(functions) {
		return false
	}

	for _, function := range functions {
		fun, ok := e.functionMap[function.Name]
		if !ok {
			fun, ok = extendsFunctionMap[function.Name]
		}
		if !ok {
			return false
		} else {
			if !fun.sameFunctionSignature(function) {
				return false
			}
		}
	}
	return true
}

// Function 实例方法,结构体的方法
type Function struct {
	EntId    string         `json:"ent_id"`
	Name     string         `json:"name"`
	Params   []*Field       `json:"params"`
	Results  []*Field       `json:"results"`
	Data     *ast.BlockStmt `json:"data"`
	Document string         `json:"document"`
	Comment  string         `json:"comment"`
	PkgID    string         `json:"pkg_id"`
	FileId   string         `json:"file_id"`
	expr     ast.Expr
	Scope    ScopeType `json:"scope"`
	Receiver string    `json:"receiver"`
	ID       string    `json:"id"`
	file     *File
}

func (f *Function) sameFunctionSignature(function *Function) bool {
	if len(f.Params) != len(function.Params) {
		return false
	}
	if len(f.Results) != len(function.Results) {
		return false
	}
	for index, p := range function.Params {
		p.file = function.file
		compareF := f.Params[index]
		compareF.file = f.file
		if !p.IsSameType(compareF) {
			return false
		}
	}
	for index, r := range function.Results {
		r.file = function.file
		compareF := f.Results[index]
		compareF.file = f.file
		if !r.IsSameType(f.Results[index]) {
			return false
		}
	}
	return true

}

func (f *Function) Parse(ctx context.Context, node *ast.FuncType) {
	if node.Params != nil {
		for _, param := range node.Params.List {
			f.Params = append(f.Params, buildField(param, f.Scope))
		}
	}
	if node.Results != nil {
		for _, result := range node.Results.List {
			f.Results = append(f.Results, buildField(result, f.Scope))
		}
	}
}
func (f *Function) AnalyzeRelations(ctx context.Context, file *File) []*Relation {
	if f.Name == "GetOneVMV2" {
		return f.ParseBlockCalls(f.Data, file)
	}
	return f.ParseBlockCalls(f.Data, file)
}

// ParseBlockCalls 解析 BlockStmt 中的函数调用
func (f *Function) ParseBlockCalls(block *ast.BlockStmt, file *File) []*Relation {
	if block == nil {
		return nil
	}
	var rs []*Relation
	// 遍历块语句中的所有语句
	for _, stmt := range block.List {
		rs = append(rs, f.parseStmtForCalls(stmt, file)...)
	}
	return rs

}

// 递归解析语句中的函数调用
func (f *Function) parseStmtForCalls(stmt ast.Stmt, file *File) []*Relation {
	var rs []*Relation
	switch s := stmt.(type) {
	case *ast.ExprStmt: // 表达式语句
		rs = append(rs, f.parseExprForCall(s.X, file)...)

	case *ast.AssignStmt: // 赋值语句
		for _, expr := range s.Rhs {
			rs = append(rs, f.parseExprForCall(expr, file)...)
		}

	case *ast.ReturnStmt: // 返回语句
		for _, expr := range s.Results {
			rs = append(rs, f.parseExprForCall(expr, file)...)
		}

	case *ast.IfStmt: // if语句
		if s.Init != nil {
			rs = append(rs, f.parseStmtForCalls(s.Init, file)...)
		}
		rs = append(rs, f.parseStmtForCalls(s.Body, file)...)

	case *ast.ForStmt: // for循环
		if s.Init != nil {
			rs = append(rs, f.parseStmtForCalls(s.Init, file)...)
		}
		rs = append(rs, f.parseStmtForCalls(s.Body, file)...)

	case *ast.RangeStmt: // range循环
		rs = append(rs, f.parseExprForCall(s.X, file)...)
		rs = append(rs, f.parseStmtForCalls(s.Body, file)...)

	case *ast.BlockStmt: // 嵌套代码块
		rs = append(rs, f.ParseBlockCalls(s, file)...)
	case *ast.GoStmt:
		rs = append(rs, f.parseExprForCall(s.Call, file)...)

	case *ast.DeclStmt: // 声明语句
		if genDecl, ok := s.Decl.(*ast.GenDecl); ok {
			for _, spec := range genDecl.Specs {
				if valSpec, ok := spec.(*ast.ValueSpec); ok {
					for _, val := range valSpec.Values {
						rs = append(rs, f.parseExprForCall(val, file)...)
					}
				}
			}
		}
	}
	return rs

}

// 递归解析表达式中的函数调用
func (f *Function) parseExprForCall(expr ast.Expr, file *File) []*Relation {
	var rs []*Relation
	switch e := expr.(type) {
	case *ast.CallExpr: // 函数调用表达式
		rs = append(rs, f.parseFunctionInfo(e.Fun, file)...)

	case *ast.ParenExpr: // 括号表达式
		rs = append(rs, f.parseExprForCall(e.X, file)...)

	case *ast.UnaryExpr: // 一元表达式
		rs = append(rs, f.parseExprForCall(e.X, file)...)

	case *ast.BinaryExpr: // 二元表达式
		rs = append(rs, f.parseExprForCall(e.X, file)...)
		rs = append(rs, f.parseExprForCall(e.Y, file)...)

	case *ast.SelectorExpr: // 选择器表达式
		rs = append(rs, f.parseExprForCall(e.X, file)...)
		rs = append(rs, f.parseExprForCall(e.Sel, file)...)

	case *ast.IndexExpr: // 索引表达式
		rs = append(rs, f.parseExprForCall(e.X, file)...)
		rs = append(rs, f.parseExprForCall(e.Index, file)...)

	case *ast.SliceExpr: // 切片表达式
		rs = append(rs, f.parseExprForCall(e.X, file)...)

	case *ast.CompositeLit: // 复合字面量
		for _, elt := range e.Elts {
			if kv, ok := elt.(*ast.KeyValueExpr); ok {
				rs = append(rs, f.parseExprForCall(kv.Value, file)...)
			} else {
				rs = append(rs, f.parseExprForCall(elt, file)...)
			}
		}
	}
	return rs
}

// parseFunctionInfo 解析函数标识信息
func (f *Function) parseFunctionInfo(expr ast.Expr, file *File) []*Relation {
	switch fun := expr.(type) {
	case *ast.Ident:
		function := file.pkg.GetFunction(fun.Name)
		if function == nil {
			return nil
		}
		return []*Relation{{Type: Call, SourceID: f.ID, TargetID: function.ID}}
	case *ast.SelectorExpr:
		if ident, ok := fun.X.(*ast.Ident); ok {
			if ident.Obj == nil { //其他包的方法调用
				function := file.GetFunctionForImport(ident.Name, fun.Sel.Name)
				if function == nil {
					return nil
				}
				return []*Relation{{Type: Call, SourceID: f.ID, TargetID: function.ID}}

			}
			//该实体的方法之间调用
			typeName := ""
			if field, ok := ident.Obj.Decl.(*ast.Field); ok {
				switch t := field.Type.(type) {
				case *ast.Ident:
					typeName = t.Name
				case *ast.StarExpr:
					if tident, ok := t.X.(*ast.Ident); ok {
						typeName = tident.Name
					}

				}
			}
			if value, ok := ident.Obj.Decl.(*ast.ValueSpec); ok { //函数内的变量方法
				switch t := value.Type.(type) {
				case *ast.SelectorExpr:
					pkg := ""
					if tident, ok := t.X.(*ast.Ident); ok {
						pkg = tident.Name
					}
					if start, ok := t.X.(*ast.StarExpr); ok {
						if tident, ok := start.X.(*ast.Ident); ok {
							pkg = tident.Name
						}
					}
					entityName := t.Sel.Name
					entity := file.GetEntityForImport(pkg, entityName)
					if entity == nil {
						return nil
					}
					function := entity.functionMap[fun.Sel.Name]
					if function == nil {
						return nil
					}
					return []*Relation{{Type: Call, SourceID: f.ID, TargetID: function.ID}}

				}
			}
			entity := file.pkg.GetEntity(typeName)
			if entity == nil {
				return nil
			}
			function := entity.FindFunctionByName(fun.Sel.Name)
			if function == nil {
				return nil
			}
			return []*Relation{{Type: Call, SourceID: f.ID, TargetID: function.ID}}
		}
		//调用该实体的属性的方法
		if se, ok := fun.X.(*ast.SelectorExpr); ok {
			fieldName := se.Sel.Name
			method := fun.Sel.Name
			typeName := ""
			if ident, ok := se.X.(*ast.Ident); ok {
				if ident.Obj == nil {
					return nil
				}
				if field, ok := ident.Obj.Decl.(*ast.Field); ok {
					switch t := field.Type.(type) {
					case *ast.Ident:
						typeName = t.Name
					case *ast.StarExpr:
						if tident, ok := t.X.(*ast.Ident); ok {
							typeName = tident.Name
						}

					}
				}
			}
			entity := file.pkg.GetEntity(typeName)
			if entity == nil {
				return nil
			}
			field := entity.fieldMap[fieldName]
			if field == nil {
				return nil
			}
			function := field.findFunction(method, file)
			if function == nil {
				return nil
			}
			return []*Relation{{Type: Call, SourceID: f.ID, TargetID: function.ID}}
		}
	default:
		fmt.Printf("unhandled expr type: %T\n,file:%s", expr, file.ID)
		return nil
	}
	return nil
}

func findReceiverType() *Entity {
	return nil
}

type Field struct {
	Name     string `json:"name"`
	StructID string `json:"struct_id"`
	EntityID string `json:"entity_id"`
	Document string `json:"document"`
	Comment  string `json:"comment"`
	expr     ast.Expr
	Scope    ScopeType `json:"scope"`
	ObjType  string    `json:"obj_type"`
	ID       string    `json:"id"`
	file     *File
}

func buildField(field *ast.Field, scope ScopeType) *Field {
	var pField *Field
	if len(field.Names) < 1 {
		pField = &Field{
			Document: TextWarp(field.Doc),
			expr:     field.Type,
			Scope:    scope,
			ObjType:  types.ExprString(field.Type),
			Comment:  TextWarp(field.Comment),
		}
	} else {
		pField = &Field{
			Name:     field.Names[0].Name,
			Document: TextWarp(field.Doc),
			expr:     field.Type,
			Scope:    scope,
			ObjType:  types.ExprString(field.Type),
			Comment:  TextWarp(field.Comment),
		}
	}

	return pField
}

func (field *Field) IsSameType(f *Field) bool {
	if f.EntityID == field.EntityID && len(field.EntityID) > 0 {
		return true
	}
	objType1 := field.ObjType
	objType2 := f.ObjType
	for _, i := range field.file.Imports {
		objType1 = strings.Replace(objType1, fmt.Sprintf("%s.", i.GetRef()), "", 1)
	}
	for _, i := range f.file.Imports {
		objType2 = strings.Replace(objType2, fmt.Sprintf("%s.", i.GetRef()), "", 1)
	}
	if objType1 == objType2 {
		return true
	}

	return false
}

func (field *Field) findFunction(methodName string, file *File) *Function {
	if field.expr == nil {
		return nil
	}
	switch fun := field.expr.(type) {
	case *ast.StarExpr:
		if se, ok := fun.X.(*ast.SelectorExpr); ok {
			if ident, ok := se.X.(*ast.Ident); ok {
				entity := file.GetEntityForImport(ident.Name, se.Sel.Name)
				if entity == nil {
					return nil
				}
				return entity.FindFunctionByName(methodName)
			}

		}
	case *ast.SelectorExpr:
		if ident, ok := fun.X.(*ast.Ident); ok {
			entity := file.GetEntityForImport(ident.Name, fun.Sel.Name)
			if entity == nil {
				return nil
			}
			return entity.FindFunctionByName(methodName)

		}
	}
	return nil

}
