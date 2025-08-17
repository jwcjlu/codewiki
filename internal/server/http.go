package server

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/conf"
	"codewiki/internal/server/middleware"
	"codewiki/internal/service"
	"strings"

	"github.com/go-kratos/aegis/ratelimit/bbr"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/middleware/validate"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/cors"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/http"
)

// NewHTTPServer new an HTTP server.
func NewHTTPServer(c *conf.Server, codeWikiService *service.CodeWikiService, logger log.Logger) *http.Server {
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000", // React开发服务器
			"http://localhost:3001", // React备用端口
			"http://localhost:5173", // Vite开发服务器
			"http://localhost:8080", // 其他前端开发端口
			"http://localhost:9000", // 流式API端口
			"http://127.0.0.1:3000", // 本地IP访问
			"http://127.0.0.1:3001",
			"http://127.0.0.1:5173",
			"http://127.0.0.1:8080",
			"http://127.0.0.1:9000", // 流式API端口
		},
		AllowedMethods: []string{
			"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH",
		},
		AllowedHeaders: []string{
			"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With",
			"Cache-Control", "Pragma", "X-CSRF-Token", "X-API-Key",
			"Accept-Encoding", "Accept-Language", "DNT", "User-Agent",
		},
		ExposedHeaders: []string{
			"Content-Length", "Content-Type", "X-Total-Count",
			"X-Request-ID", "X-Response-Time",
		},
		AllowCredentials: true,
		MaxAge:           86400, // 24小时
		AllowOriginFunc: func(origin string) bool {
			// 允许无origin的请求（如curl、Postman等）
			if origin == "" {
				return true
			}

			// 允许null origin（某些浏览器扩展）
			if origin == "null" {
				return true
			}

			// 开发环境允许所有localhost来源
			if strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1") {
				return true
			}

			// 允许file://协议（本地文件访问）
			if strings.HasPrefix(origin, "file://") {
				return true
			}

			// 生产环境可以在这里添加允许的域名
			// 例如：strings.HasPrefix(origin, "https://yourdomain.com")

			return false
		},
		// 调试模式
		Debug: false,
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
	srv.Handle("/v1/api/project/{id}/answer", service.NewAnswerHandler(codeWikiService))
	return srv
}
