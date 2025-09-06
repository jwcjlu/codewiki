package biz

import (
	"codewiki/internal/pkg/llm"

	"github.com/google/wire"
)

// ProviderSet is biz providers.
var ProviderSet = wire.NewSet(NewQAEngine, llm.NewLLM, NewIndexer, NewConfig, NewRepositoryBiz, NewCodeAnalyzer)
