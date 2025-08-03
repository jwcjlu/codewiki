package server

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/conf"
	"codewiki/internal/server/middleware"
	"codewiki/internal/service"
	"github.com/go-kratos/aegis/ratelimit/bbr"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/middleware/validate"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/cors"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"strings"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/http"
)

// NewHTTPServer new an HTTP server.
func NewHTTPServer(c *conf.Server, codeWikiService *service.CodeWikiService, logger log.Logger) *http.Server {
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // 生产环境应指定具体域名
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		MaxAge:           86400,
		AllowOriginFunc: func(origin string) bool {
			if origin == "" { // 允许无origin的请求（如curl）
				return true
			}
			if origin == "null" {
				return true
			}

			// 开发环境允许所有来源
			if strings.Contains(origin, "http://localhost") {
				return true
			}

			// 生产环境只允许特定域名
			allowedDomains := []string{
				"http://localhost:8000",
			}

			for _, domain := range allowedDomains {
				if strings.HasPrefix(origin, domain) {
					return true
				}
			}

			return false
		},
	})
	var opts = []http.ServerOption{
		http.Middleware(
			recovery.Recovery(),
		),
		http.Filter(corsMiddleware.Handler),
	}
	if c.Http.Network != "" {
		opts = append(opts, http.Network(c.Http.Network))
	}
	if c.Http.Addr != "" {
		opts = append(opts, http.Address(c.Http.Addr))
	}
	if c.Http.Timeout != nil {
		opts = append(opts, http.Timeout(c.Http.Timeout.AsDuration()))
	}
	opts = append(opts, http.Middleware(
		recovery.Recovery(),
		tracing.Server(
			tracing.WithTracerProvider(otel.GetTracerProvider()),
			tracing.WithPropagator(
				propagation.NewCompositeTextMapPropagator(propagation.Baggage{}, propagation.TraceContext{}),
			),
		),
		middleware.TraceparentMiddleware(),
		logging.Server(logger),
		validate.Validator(),

		middleware.Metric(),
		ratelimit.Server(ratelimit.WithLimiter(bbr.NewLimiter())),
	))
	srv := http.NewServer(opts...)
	v1.RegisterCodeWikiServiceHTTPServer(srv, codeWikiService)
	srv.Handle("/metrics", promhttp.Handler())
	return srv
}
