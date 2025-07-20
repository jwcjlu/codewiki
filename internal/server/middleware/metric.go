package middleware

import (
	prom "github.com/go-kratos/kratos/contrib/metrics/prometheus/v2"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/metrics"
	"github.com/prometheus/client_golang/prometheus"
	"sync"
)

var (
	_metricRequests = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "codewiki",
		Subsystem: "codewiki",
		Name:      "code_total",
		Help:      "The total number of processed requests",
	}, []string{"kind", "operation", "code", "reason"})

	_metricSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "codewiki",
		Subsystem: "codewiki",
		Name:      "duration_sec",
		Help:      "server requests duratio(sec).",
		Buckets:   []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 5},
	}, []string{"kind", "operation"})
)
var (
	serverMetricOnce     sync.Once
	serverMetricInstance middleware.Middleware
)

func Metric() middleware.Middleware {
	serverMetricOnce.Do(func() {
		prometheus.MustRegister(_metricRequests)
		prometheus.MustRegister(_metricSeconds)
		serverMetricInstance = metrics.Server(metrics.WithSeconds(prom.NewHistogram(_metricSeconds)),
			metrics.WithRequests(prom.NewCounter(_metricRequests)))
	})

	return serverMetricInstance
}
