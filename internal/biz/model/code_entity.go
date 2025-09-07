package model

import (
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
	ID           string     `json:"id"`
	Type         EntityType `json:"type"`
	Name         string     `json:"name"`
	FileID       string     `json:"file_id"`
	PkgID        string     `json:"pkg_id"`
	Position     token.Position
	Definition   string    `json:"definition"`
	Embeddings   []float64 `json:"-"`
	Comment      string    `json:"comment"`
	Document     string    `json:"document"` //根据语法树生成doc
	fieldManager *FieldManager
	// 函数管理
	functionManager *FunctionManager
	Extends         []*Entity  //继承
	rawExtends      []ast.Expr //继承
	vSpace          *ast.ValueSpec
}

func NewEntity(file *File, node *ast.TypeSpec, entityType EntityType) *Entity {
	return &Entity{
		ID:              fmt.Sprintf("%s:%s", file.ID, node.Name.Name),
		Type:            entityType,
		Name:            node.Name.Name,
		FileID:          file.ID,
		Comment:         TextWarp(node.Comment),
		Document:        TextWarp(node.Doc),
		PkgID:           file.PkgID,
		functionManager: NewFunctionManager(file),
		fieldManager:    NewFieldManager(),
	}
}

func (e *Entity) CountFunction() int {
	count := e.functionManager.CountMethod()
	for _, extend := range e.Extends {
		count += extend.functionManager.CountMethod()
	}
	return count

}
func (e *Entity) FindMethodByName(name string) *Function {
	if e == nil && e.functionManager == nil {
		return nil
	}
	return e.functionManager.GetMethodByName(name)
}

func (e *Entity) AddMethod(function *Function) {
	if e.Type == Struct || e.Type == Interface {
		e.functionManager.AddMethod(function)
	}

}
func (e *Entity) AddField(field *Field) {
	if e.Type == Struct || e.Type == Interface {
		e.fieldManager.AddField(field)
	}
}
func (e *Entity) FindFieldByName(fieldName string) *Field {
	if e.Type == Struct || e.Type == Interface {
		return e.fieldManager.GetFieldByName(fieldName)
	} else {
		if e.vSpace == nil {
			return nil
		}
		return &Field{expr: e.vSpace.Type}
	}
}
func (e *Entity) SetValueSpace(vSpace *ast.ValueSpec) {
	e.vSpace = vSpace
}

// HandlerExtends 处理继承问题
func (e *Entity) HandlerExtends(file *File, pkg *Package) {
	for _, rawExtendType := range e.rawExtends {
		switch extendType := rawExtendType.(type) {
		case *ast.Ident: //同报下继承
			entity := pkg.GetEntity(extendType.Name)
			if entity != nil {
				e.Extends = append(e.Extends, entity)
			}
		case *ast.SelectorExpr: //其他包下的继承
			var implName string
			et, ok := extendType.X.(*ast.Ident)
			if !ok {
				continue

			}
			implName = et.Name
			entity := pkg.GetCodeParse().GetEntity(implName, extendType.Sel.Name)
			if entity != nil {
				e.Extends = append(e.Extends, entity)
			}
		case *ast.StarExpr: //指针类型
			if ident, ok := extendType.X.(*ast.Ident); ok {
				entity := pkg.GetEntity(ident.Name)
				if entity != nil {
					e.Extends = append(e.Extends, entity)
				}
			}
		case *ast.IndexExpr: //指针+泛型
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

func (e *Entity) GetFields() []*Field {
	if e.Type == Struct || e.Type == Interface {
		return e.fieldManager.GetFields()
	}
	return nil
}

func (e *Entity) GetMethods() []*Function {
	if e.Type == Struct || e.Type == Interface {
		return e.functionManager.GetMethods()
	}
	return nil
}

// IsImplInterface 是否实现改接口
func (e *Entity) IsImplInterface(interfaceEntity *Entity) bool {
	if e.Type != Struct {
		return false
	}
	functions := interfaceEntity.GetMethods()
	//接口继承的方法也要加上
	for _, extend := range interfaceEntity.Extends {
		functions = append(functions, extend.GetMethods()...)
	}
	//实体继承的方法
	extendsFunctionMap := make(map[string]*Function)
	for _, extend := range e.Extends {
		for _, function := range extend.GetMethods() {
			extendsFunctionMap[function.Name] = function
		}
	}
	if len(e.GetMethods())+len(extendsFunctionMap) < len(functions) {
		return false
	}
	for _, function := range functions {
		fun := e.FindMethodByName(function.Name)
		if fun == nil {
			fun, _ = extendsFunctionMap[function.Name]
		}
		if fun != nil {
			if !fun.sameFunctionSignature(function) {
				return false
			}
		} else {
			return false
		}
	}
	return true
}

// Function 实例方法,结构体的方法
type Function struct {
	EntId   string         `json:"ent_id"`
	Name    string         `json:"name"`
	Params  []*Field       `json:"params"`
	Results []*Field       `json:"results"`
	Data    *ast.BlockStmt `json:"data"`

	Document string `json:"document"`
	Comment  string `json:"comment"`
	PkgID    string `json:"pkg_id"`
	FileId   string `json:"file_id"`
	expr     ast.Expr
	Scope    ScopeType `json:"scope"`
	Receiver string    `json:"receiver"`
	ID       string    `json:"id"`
	file     *File
	decl     *ast.FuncDecl
}

func (f *Function) GetEntity() *Entity {
	if len(f.Receiver) == 0 {
		return nil
	}
	return f.file.GetCurrentPkg().GetEntity(f.Receiver)
}

func (f *Function) readFileContent() ([]byte, error) {
	if f.file == nil {
		return nil, nil
	}
	return f.file.ReadFileContent()
}
func (f *Function) ReaderSourceCode() string {
	if f.decl == nil || f.file == nil || len(f.file.FilePath) == 0 {
		return ""
	}
	content, err := f.readFileContent()
	if err != nil || content == nil {
		return ""
	}
	start := f.file.fset.Position(f.decl.Pos()).Offset
	end := f.file.fset.Position(f.decl.End()).Offset
	if len(content) < end {
		return ""
	}
	return string(content[start:end])
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

func (f *Function) BuildRawCodeChunk() *CodeChunk {
	sourceCode := f.ReaderSourceCode()
	if len(sourceCode) == 0 {
		return nil
	}
	return &CodeChunk{
		Path:     f.FileId,
		Content:  f.ReaderSourceCode(),
		Document: f.Document,
		Scope:    ChunkFunctionScope,
		Id:       f.ID,
	}

}
func (f *Function) Parse(node *ast.FuncType) {
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

// FunctionManager 函数管理器
type FunctionManager struct {
	file        *File
	functions   []*Function
	methods     []*Function
	functionMap map[string]*Function
	methodMap   map[string]*Function
}

func NewFunctionManager(file *File) *FunctionManager {
	return &FunctionManager{
		file:        file,
		functionMap: make(map[string]*Function),
		methodMap:   make(map[string]*Function),
	}
}
func (fm *FunctionManager) CountFunction() int {
	return len(fm.functions)
}
func (fm *FunctionManager) CountMethod() int {
	return len(fm.methods)
}
func (fm *FunctionManager) AddFunction(fun *Function) {
	if _, ok := fm.functionMap[fun.Name]; ok {
		return
	}
	fm.functionMap[fun.Name] = fun
	fm.functions = append(fm.functions, fun)

}
func (fm *FunctionManager) AddMethod(fun *Function) {
	if _, ok := fm.methodMap[fun.Name]; ok {
		return
	}
	fm.methodMap[fun.Name] = fun
	fm.methods = append(fm.methods, fun)
}

func (fm *FunctionManager) GetMethodByName(methodName string) *Function {
	if fm == nil || fm.methodMap == nil {
		return nil
	}
	return fm.methodMap[methodName]
}

func (fm *FunctionManager) GetFunctions() []*Function {
	return fm.functions
}
func (fm *FunctionManager) GetMethods() []*Function {
	return fm.methods
}
func (fm *FunctionManager) GetFunctionByName(name string) *Function {
	return fm.functionMap[name]
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
	field    *ast.Field
}

func (field *Field) GetType() ast.Expr {
	return field.expr
}
func (field *Field) FieldName() string {
	if len(field.Name) > 0 {
		return field.Name
	}
	if field.field == nil {
		return field.ObjType
	}
	switch ft := field.field.Type.(type) {
	case *ast.StarExpr:
		ident, ok := ft.X.(*ast.Ident)
		if ok {
			return ident.Name
		}
	case *ast.Ident:
		return ft.Name
	}
	return field.ObjType
}

type FieldManager struct {
	fields    []*Field
	fieldsMap map[string]*Field
}

func NewFieldManager() *FieldManager {
	return &FieldManager{

		fieldsMap: make(map[string]*Field),
	}
}

func (fm *FieldManager) AddField(fd *Field) {
	fm.fieldsMap[fd.Name] = fd
	fm.fields = append(fm.fields, fd)
}

func (fm *FieldManager) GetFields() []*Field {
	return fm.fields
}

func (fm *FieldManager) GetFieldByName(name string) *Field {
	return fm.fieldsMap[name]
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
			field:    field,
		}
	} else {
		pField = &Field{
			Name:     field.Names[0].Name,
			Document: TextWarp(field.Doc),
			expr:     field.Type,
			Scope:    scope,
			ObjType:  types.ExprString(field.Type),
			Comment:  TextWarp(field.Comment),
			field:    field,
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
	for _, i := range field.file.GetImports() {
		objType1 = strings.Replace(objType1, fmt.Sprintf("%s.", i.GetRef()), "", 1)
	}
	for _, i := range f.file.GetImports() {
		objType2 = strings.Replace(objType2, fmt.Sprintf("%s.", i.GetRef()), "", 1)
	}
	if objType1 == objType2 {
		return true
	}
	return false
}

func (field *Field) FindFunctionByName(methodName string, file *File) *Function {
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
				return entity.FindMethodByName(methodName)
			}

		}
	case *ast.Ident:
		entity := file.GetEntityByNameInPackage(fun.Name)
		if entity == nil {
			return nil
		}
		return entity.FindMethodByName(methodName)

	case *ast.SelectorExpr:
		if ident, ok := fun.X.(*ast.Ident); ok {
			entity := file.GetEntityForImport(ident.Name, fun.Sel.Name)
			if entity == nil {
				return nil
			}
			return entity.FindMethodByName(methodName)
		}
	}
	return nil

}
