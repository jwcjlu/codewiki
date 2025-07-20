package biz

type RelationType int

const (
	Implement RelationType = iota
	Belong
	Call
)

type Relation struct {
	Type       string
	TargetID   string
	Confidence float64
	SourceID   string
}
