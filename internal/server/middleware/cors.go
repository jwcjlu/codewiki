package middleware

import (
	"github.com/rs/cors"
	"net/http"
	"strings"
)

func CorsHandler() func(http.Handler) http.Handler {
	return cors.New(cors.Options{
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
	}).Handler
}
