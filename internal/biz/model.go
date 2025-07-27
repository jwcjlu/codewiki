package biz

const (
	Implement = "Implement" //实现
	Belong    = "Belong"    //属于
	Call      = "Call"      //调用
	Extended  = "Extended"  //继承
)

type Relation struct {
	Type       string
	TargetID   string
	Confidence float64
	SourceID   string
}
