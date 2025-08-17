package biz

import (
	"codewiki/internal/pkg/llm"
	"github.com/google/wire"
)

// ProviderSet is biz providers.
var ProviderSet = wire.NewSet(NewCodeWiki, NewQAEngine, llm.NewLLM, NewIndexer, NewConfig)
