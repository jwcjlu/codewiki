package llm

import "fmt"

type PromptsType string

const (
	Architecture  PromptsType = "architecture"
	BusinessLogic PromptsType = "business_logic"
	CodeQuality   PromptsType = "code_quality"
)

var analysisPrompts = map[PromptsType]string{
	Architecture: `请分析以下%s代码的架构设计。请回答以下方面:
1. 项目的主要组件和模块划分
2. 组件之间的交互方式
3. 使用的设计模式
4. 数据流和控制流
5. 外部依赖和集成点

代码:
%s`,

	BusinessLogic: `请从以下%s代码中提取核心业务逻辑。请回答:
1. 项目解决的主要业务问题
2. 关键业务流程
3. 核心业务规则
4. 重要业务实体及其关系
5. 业务异常处理机制

代码:
%s`,

	CodeQuality: `请评估以下%s代码的质量。请回答:
1. 代码风格和规范性
2. 错误处理机制
3. 测试覆盖率(根据测试文件推断)
4. 潜在的性能问题
5. 可维护性建议
6. 安全性考虑

代码:
%s`,
}

func GetAnalysisCodePrompts(pt PromptsType, language, code string) string {
	prompt, ok := analysisPrompts[pt]
	if !ok {
		return ""
	}
	return fmt.Sprintf(prompt, language, code)
}
