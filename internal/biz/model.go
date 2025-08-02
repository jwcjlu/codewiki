package biz

import "fmt"

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
