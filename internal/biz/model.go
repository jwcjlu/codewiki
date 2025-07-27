package biz

const (
	Contains  = "Contains"  //包含
	Declare   = "Declare"   //声明
	HasFields = "HasFields" //有某字段
	HasMethod = "HasMethod" //有某方法
	Implement = "Implement" //实现
	Call      = "Call"      //调用
	Extends   = "Extends"   //继承
)

type Relation struct {
	Type       string
	TargetID   string
	Confidence float64
	SourceID   string
}
