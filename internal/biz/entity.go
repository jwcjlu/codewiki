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

// 解析函数标识信息
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
			function := file.functionMap[ident.Name]
			if function == nil {
				return nil
			}
			return []*Relation{{Type: Call, SourceID: f.ID, TargetID: function.ID}}
		}
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
			entity := file.GetEntity(typeName)
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

		return nil
	}
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

func extractBasicInfo(fn *ast.FuncDecl) BasicInfo {
	info := BasicInfo{
		Name: fn.Name.Name,
	}

	// 提取参数信息
	for _, param := range fn.Type.Params.List {
		for _, name := range param.Names {
			info.Params = append(info.Params, Param{
				Name: name.Name,
				Type: exprToString(param.Type),
			})
		}
	}

	// 提取返回值信息
	if fn.Type.Results != nil {
		for _, result := range fn.Type.Results.List {
			info.Returns = append(info.Returns, Return{
				Type: exprToString(result.Type),
			})
		}
	}

	return info
}

func analyzeControlFlow(block *ast.BlockStmt) []ControlFlow {
	var flows []ControlFlow

	for _, stmt := range block.List {
		switch s := stmt.(type) {
		case *ast.IfStmt:
			flow := ControlFlow{
				Type:      "conditional",
				Condition: exprToString(s.Cond),
			}
			if s.Else != nil {
				flow.HasElse = true
			}
			flows = append(flows, flow)

		case *ast.ForStmt:
			flows = append(flows, ControlFlow{
				Type:      "loop",
				Init:      stmtToString(s.Init),
				Condition: exprToString(s.Cond),
				Post:      stmtToString(s.Post),
			})

		case *ast.RangeStmt:
			flows = append(flows, ControlFlow{
				Type:   "range-loop",
				Key:    exprToString(s.Key),
				Value:  exprToString(s.Value),
				Target: exprToString(s.X),
			})
		}
	}

	return flows
}

func analyzeDataFlow(block *ast.BlockStmt) DataFlow {
	df := DataFlow{
		Variables: make(map[string]VariableInfo),
	}

	ast.Inspect(block, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.AssignStmt:
			for i, lhs := range x.Lhs {
				if ident, ok := lhs.(*ast.Ident); ok {
					df.Variables[ident.Name] = VariableInfo{
						AssignedFrom: exprToString(x.Rhs[i]),
						LastUsed:     findLastUse(ident.Name, block),
					}
				}
			}
		}
		return true
	})

	return df
}

func generateComment(info BasicInfo, flows []ControlFlow, df DataFlow) string {
	var builder strings.Builder

	// 函数头注释
	builder.WriteString(fmt.Sprintf("// %s ", info.Name))

	// 参数描述
	if len(info.Params) > 0 {
		builder.WriteString("接收 ")
		for i, param := range info.Params {
			if i > 0 {
				builder.WriteString(", ")
			}
			builder.WriteString(fmt.Sprintf("%s(%s)", param.Name, param.Type))
		}
	}

	// 返回值描述
	if len(info.Returns) > 0 {
		builder.WriteString("，返回 ")
		for i, ret := range info.Returns {
			if i > 0 {
				builder.WriteString(", ")
			}
			builder.WriteString(ret.Type)
		}
	}
	builder.WriteString("\n")

	// 控制流描述
	if len(flows) > 0 {
		builder.WriteString("// 执行流程:\n")
		for _, flow := range flows {
			switch flow.Type {
			case "conditional":
				builder.WriteString(fmt.Sprintf("// - 如果 %s 则...", flow.Condition))
				if flow.HasElse {
					builder.WriteString("，否则...")
				}
				builder.WriteString("\n")

			case "loop":
				builder.WriteString(fmt.Sprintf("// - 循环执行: 初始化 %s; 条件 %s; 步进 %s\n",
					flow.Init, flow.Condition, flow.Post))

			case "range-loop":
				builder.WriteString(fmt.Sprintf("// - 遍历 %s", flow.Target))
				if flow.Key != "" || flow.Value != "" {
					builder.WriteString("，使用 ")
					if flow.Key != "" {
						builder.WriteString(flow.Key)
						if flow.Value != "" {
							builder.WriteString(", ")
						}
					}
					if flow.Value != "" {
						builder.WriteString(flow.Value)
					}
				}
				builder.WriteString("\n")
			}
		}
	}

	// 关键变量描述
	if len(df.Variables) > 0 {
		builder.WriteString("// 主要变量:\n")
		for name, info := range df.Variables {
			builder.WriteString(fmt.Sprintf("// - %s: 来自 %s", name, info.AssignedFrom))
			if info.LastUsed != "" {
				builder.WriteString(fmt.Sprintf("，最后用于 %s", info.LastUsed))
			}
			builder.WriteString("\n")
		}
	}

	return builder.String()
}

type BasicInfo struct {
	Name    string
	Params  []Param
	Returns []Return
}

// 参数信息
type Param struct {
	Name string
	Type string
}

// 返回值信息
type Return struct {
	Name string // 可能为空（如匿名返回）
	Type string
}

// ControlFlow 控制流信息
type ControlFlow struct {
	Type      string // "conditional", "loop", "range-loop"
	Condition string // 条件表达式
	Init      string // 初始化语句（for循环）
	Post      string // 步进语句（for循环）
	HasElse   bool   // if语句是否有else分支
	Key       string // range循环的key
	Value     string // range循环的value
	Target    string // range循环的目标
}

// DataFlow 数据流信息
type DataFlow struct {
	Variables map[string]VariableInfo
}

// 变量信息
type VariableInfo struct {
	AssignedFrom string // 赋值来源
	LastUsed     string // 最后使用位置
	Type         string // 变量类型（如果可推断）
}

// 表达式类型信息
type ExprType struct {
	Expr string
	Type string
}

func exprToString(expr ast.Expr) string {
	if expr == nil {
		return ""
	}

	switch e := expr.(type) {
	case *ast.Ident:
		return e.Name

	case *ast.BasicLit:
		return e.Value

	case *ast.BinaryExpr:
		return exprToString(e.X) + " " + e.Op.String() + " " + exprToString(e.Y)

	case *ast.CallExpr:
		args := make([]string, len(e.Args))
		for i, arg := range e.Args {
			args[i] = exprToString(arg)
		}
		return exprToString(e.Fun) + "(" + strings.Join(args, ", ") + ")"

	case *ast.SelectorExpr:
		return exprToString(e.X) + "." + e.Sel.Name

	case *ast.IndexExpr:
		return exprToString(e.X) + "[" + exprToString(e.Index) + "]"

	case *ast.SliceExpr:
		s := exprToString(e.X) + "["
		if e.Low != nil {
			s += exprToString(e.Low)
		}
		s += ":"
		if e.High != nil {
			s += exprToString(e.High)
		}
		if e.Max != nil {
			s += ":" + exprToString(e.Max)
		}
		return s + "]"

	case *ast.ParenExpr:
		return "(" + exprToString(e.X) + ")"

	case *ast.UnaryExpr:
		return e.Op.String() + exprToString(e.X)

	case *ast.CompositeLit:
		typ := exprToString(e.Type)
		elts := make([]string, len(e.Elts))
		for i, elt := range e.Elts {
			elts[i] = exprToString(elt)
		}
		return typ + "{" + strings.Join(elts, ", ") + "}"

	case *ast.ArrayType:
		return "[]" + exprToString(e.Elt)

	case *ast.StarExpr:
		return "*" + exprToString(e.X)

	case *ast.KeyValueExpr:
		return exprToString(e.Key) + ":" + exprToString(e.Value)

	case *ast.FuncLit:
		return "func" + exprToString(e.Type) + " {...}"

	case *ast.StructType:
		return "struct{...}"

	case *ast.InterfaceType:
		return "interface{...}"

	case *ast.MapType:
		return "map[" + exprToString(e.Key) + "]" + exprToString(e.Value)

	case *ast.ChanType:
		switch e.Dir {
		case ast.SEND:
			return "chan<- " + exprToString(e.Value)
		case ast.RECV:
			return "<-chan " + exprToString(e.Value)
		default:
			return "chan " + exprToString(e.Value)
		}

	default:
		return fmt.Sprintf("%T", expr) // 未知类型回退
	}
}
func stmtToString(stmt ast.Stmt) string {
	if stmt == nil {
		return ""
	}

	switch s := stmt.(type) {
	case *ast.ExprStmt:
		return exprToString(s.X)

	case *ast.AssignStmt:
		lhs := make([]string, len(s.Lhs))
		for i, expr := range s.Lhs {
			lhs[i] = exprToString(expr)
		}

		rhs := make([]string, len(s.Rhs))
		for i, expr := range s.Rhs {
			rhs[i] = exprToString(expr)
		}

		op := ""
		if s.Tok != token.ASSIGN {
			op = " " + s.Tok.String() + " "
		}

		return strings.Join(lhs, ", ") + op + "= " + strings.Join(rhs, ", ")

	case *ast.DeclStmt:
		return declToString(s.Decl)

	case *ast.ReturnStmt:
		if len(s.Results) == 0 {
			return "return"
		}
		results := make([]string, len(s.Results))
		for i, expr := range s.Results {
			results[i] = exprToString(expr)
		}
		return "return " + strings.Join(results, ", ")

	case *ast.IfStmt:
		str := "if "
		if s.Init != nil {
			str += stmtToString(s.Init) + "; "
		}
		str += exprToString(s.Cond) + " { ... }"

		if s.Else != nil {
			str += " else "
			switch s.Else.(type) {
			case *ast.BlockStmt:
				str += "{ ... }"
			case *ast.IfStmt:
				str += stmtToString(s.Else)
			}
		}
		return str

	case *ast.ForStmt:
		str := "for "
		if s.Init != nil {
			str += stmtToString(s.Init)
		}
		str += "; "

		if s.Cond != nil {
			str += exprToString(s.Cond)
		}
		str += "; "

		if s.Post != nil {
			str += stmtToString(s.Post)
		}
		return str + "{ ... }"

	case *ast.RangeStmt:
		str := "for "
		if s.Key != nil {
			str += exprToString(s.Key)
			if s.Value != nil {
				str += ", " + exprToString(s.Value)
			}
			str += " := "
		}
		str += "range " + exprToString(s.X) + " { ... }"
		return str

	case *ast.BlockStmt:
		if len(s.List) == 0 {
			return "{}"
		}
		return "{ ... }" // 简化代码块

	case *ast.IncDecStmt:
		return exprToString(s.X) + s.Tok.String()

	case *ast.GoStmt:
		return "go " + exprToString(s.Call)

	case *ast.DeferStmt:
		return "defer " + exprToString(s.Call)

	case *ast.LabeledStmt:
		return s.Label.Name + ": " + stmtToString(s.Stmt)

	case *ast.BranchStmt:
		str := s.Tok.String()
		if s.Label != nil {
			str += " " + s.Label.Name
		}
		return str

	case *ast.CaseClause:
		list := make([]string, len(s.List))
		for i, expr := range s.List {
			list[i] = exprToString(expr)
		}
		str := "case " + strings.Join(list, ", ") + ":"
		if len(s.Body) > 0 {
			str += " ..."
		}
		return str

	case *ast.SwitchStmt:
		str := "switch "
		if s.Init != nil {
			str += stmtToString(s.Init) + "; "
		}
		if s.Tag != nil {
			str += exprToString(s.Tag) + " "
		}
		return str + "{ ... }"

	case *ast.TypeSwitchStmt:
		str := "switch "
		if s.Init != nil {
			str += stmtToString(s.Init) + "; "
		}
		str += stmtToString(s.Assign) + " { ... }"
		return str

	case *ast.CommClause:
		str := "case "
		if s.Comm != nil {
			str += stmtToString(s.Comm)
		} else {
			str += "default"
		}
		str += ": ..."
		return str

	case *ast.SelectStmt:
		return "select { ... }"

	case *ast.EmptyStmt:
		return ";" // 空语句

	default:
		return fmt.Sprintf("(%T)", stmt) // 未知类型回退
	}
}
func declToString(decl ast.Decl) string {
	switch d := decl.(type) {
	case *ast.GenDecl:
		specs := make([]string, len(d.Specs))
		for i, spec := range d.Specs {
			specs[i] = specToString(spec)
		}
		return d.Tok.String() + " " + strings.Join(specs, ", ")
	case *ast.FuncDecl:
		return "func " + d.Name.Name + "() { ... }"
	default:
		return fmt.Sprintf("(%T)", decl)
	}
}

func specToString(spec ast.Spec) string {
	switch s := spec.(type) {
	case *ast.ValueSpec:
		names := make([]string, len(s.Names))
		for i, name := range s.Names {
			names[i] = name.Name
		}
		str := strings.Join(names, ", ")
		if s.Type != nil {
			str += " " + exprToString(s.Type)
		}
		if len(s.Values) > 0 {
			values := make([]string, len(s.Values))
			for i, value := range s.Values {
				values[i] = exprToString(value)
			}
			str += " = " + strings.Join(values, ", ")
		}
		return str
	case *ast.TypeSpec:
		str := s.Name.Name
		/*	if s.TypeParams != nil {
			str += exprToString(s.TypeParams)
		}*/
		str += " " + exprToString(s.Type)
		return str
	case *ast.ImportSpec:
		if s.Name != nil {
			return s.Name.Name + " " + s.Path.Value
		}
		return s.Path.Value
	default:
		return fmt.Sprintf("(%T)", spec)
	}
}
func findLastUse(varName string, block *ast.BlockStmt) string {
	var lastUse ast.Node
	var lastUsePos token.Pos

	ast.Inspect(block, func(n ast.Node) bool {
		if n == nil {
			return true
		}

		// 检查变量使用情况
		switch expr := n.(type) {
		case *ast.Ident:
			if expr.Name == varName {
				if expr.Pos() > lastUsePos {
					lastUse = expr
					lastUsePos = expr.Pos()
				}
			}
		case *ast.AssignStmt:
			// 检查赋值语句右侧是否使用了变量
			for _, rhs := range expr.Rhs {
				ast.Inspect(rhs, func(n ast.Node) bool {
					if ident, ok := n.(*ast.Ident); ok && ident.Name == varName {
						if ident.Pos() > lastUsePos {
							lastUse = ident
							lastUsePos = ident.Pos()
						}
					}
					return true
				})
			}
		}

		return true
	})

	if lastUse == nil {
		return ""
	}

	// 根据最后使用位置返回描述
	switch n := lastUse.(type) {
	case *ast.Ident:
		// 尝试获取上下文信息
		parent := findParentNode(block, n)
		switch parent.(type) {
		case *ast.ReturnStmt:
			return "返回值"
		case *ast.CallExpr:
			return "函数调用参数"
		case *ast.BinaryExpr:
			return "表达式计算"
		case *ast.AssignStmt:
			return "赋值语句"
		default:
			return "代码位置:"
		}
	default:
		return fmt.Sprintf("使用位置:%T", lastUse)
	}
}

// 查找节点的直接父节点
func findParentNode(root ast.Node, target ast.Node) ast.Node {
	var parent ast.Node

	ast.Inspect(root, func(n ast.Node) bool {
		if n == target {
			return false
		}

		// 记录当前节点作为可能的父节点
		prevParent := parent
		parent = n

		ast.Inspect(n, func(child ast.Node) bool {
			if child == target {
				return false
			}
			return true
		})

		if parent == prevParent {
			parent = prevParent
		}

		return true
	})

	return parent
}
