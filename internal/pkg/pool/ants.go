package pool

import (
	"codewiki/internal/conf"
	"context"

	"fmt"
	"github.com/go-kratos/kratos/v2/log"

	"github.com/panjf2000/ants/v2"
)

type GoroutinePool interface {
	Start(context.Context) error
	Stop(context.Context) error
	Submit(task func()) error
}

func NewAntsPool(data *conf.Data, logger log.Logger) GoroutinePool {
	nonblocking := false
	var poolSize = 100
	config := data.PoolConfig
	if config.GetPoolSize() > 0 {
		poolSize = int(config.PoolSize)
	}
	if config.GetBlocking() {
		nonblocking = config.Blocking
	}
	pool, err := ants.NewPool(
		poolSize,
		ants.WithLogger(&antsLogger{logger: logger}),
		ants.WithNonblocking(nonblocking),
		ants.WithPanicHandler(func(err interface{}) {
			logger.Log(log.LevelError, "Recover from panic: %v\n", err)
		}),
	)
	if err != nil {
		panic(fmt.Sprintf("new pool failure %v", err))
	}
	return &antsPool{Pool: pool}
}

type antsPool struct {
	*ants.Pool
}

func (a *antsPool) Start(ctx context.Context) error {
	return nil
}

func (a *antsPool) Stop(ctx context.Context) error {
	a.Release()
	return nil
}

type antsLogger struct {
	logger log.Logger
}

func (l *antsLogger) Printf(format string, args ...interface{}) {
	l.logger.Log(log.LevelInfo, format, args)
}
