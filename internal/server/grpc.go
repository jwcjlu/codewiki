package server

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/conf"
	"codewiki/internal/server/middleware"
	"codewiki/internal/service"
	"github.com/go-kratos/aegis/ratelimit/bbr"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/middleware/tracing"

	kgrpc "github.com/go-kratos/kratos/v2/transport/grpc"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

// NewGRPCServer new a gRPC server.
func NewGRPCServer(c *conf.Server, codeWikiService *service.CodeWikiService, logger log.Logger) *kgrpc.Server {
	var opts = []kgrpc.ServerOption{
		kgrpc.Middleware(
			recovery.Recovery(),
			tracing.Server(
				tracing.WithTracerProvider(otel.GetTracerProvider()),
				tracing.WithPropagator(
					propagation.NewCompositeTextMapPropagator(propagation.Baggage{}, propagation.TraceContext{}),
				),
			),
			logging.Server(logger),
			middleware.Metric(),
			middleware.TraceparentMiddleware(),
			ratelimit.Server(ratelimit.WithLimiter(bbr.NewLimiter())),
		),
	}
	if c.Grpc.Network != "" {
		opts = append(opts, kgrpc.Network(c.Grpc.Network))
	}
	if c.Grpc.Addr != "" {
		opts = append(opts, kgrpc.Address(c.Grpc.Addr))
	}
	if c.Grpc.Timeout != nil {
		opts = append(opts, kgrpc.Timeout(c.Grpc.Timeout.AsDuration()))
	}
	srv := kgrpc.NewServer(opts...)
	v1.RegisterCodeWikiServiceServer(srv, codeWikiService)

	return srv
}
