package server

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/conf"
	"codewiki/internal/server/middleware"
	"codewiki/internal/service"
	"github.com/go-kratos/aegis/ratelimit/bbr"
	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/middleware/validate"
	"github.com/go-kratos/kratos/v2/transport/http"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	shttp "net/http"
	"reflect"
)

// NewHTTPServer new an HTTP server.
func NewHTTPServer(c *conf.Server,
	codeAnalyzerService *service.CodeAnalyzerService,
	qaService *service.QAService,
	repositoryService *service.RepositoryService,
	logger log.Logger) *http.Server {

	var opts = []http.ServerOption{
		http.Middleware(
			recovery.Recovery(),
		),
		http.Filter(middleware.CorsHandler()),
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
	opts = append(opts, http.ResponseEncoder(responseEncoder))
	opts = append(opts, http.ErrorEncoder(errorEncoder))
	srv := http.NewServer(opts...)
	v1.RegisterCodeAnalyzerServiceHTTPServer(srv, codeAnalyzerService)
	v1.RegisterRepoServiceHTTPServer(srv, repositoryService)
	srv.Handle("/metrics", promhttp.Handler())
	srv.Handle("/v1/api/project/{id}/answer", qaService)
	return srv
}

type BizResp interface {
	GetRet() *v1.BaseResp
}

func responseEncoder(w http.ResponseWriter, r *http.Request, v interface{}) error {
	if v == nil {
		return nil
	}
	if rd, ok := v.(http.Redirector); ok {
		url, code := rd.Redirect()
		shttp.Redirect(w, r, url, code)
		return nil
	}
	bizResp, ok := v.(BizResp)
	if ok && bizResp != nil && bizResp.GetRet() == nil {
		val := reflect.ValueOf(v).Elem()
		ret := val.FieldByName("Ret")
		if ret.CanSet() {
			ret.Set(reflect.ValueOf(&v1.BaseResp{Code: 0, Msg: ""}))
		}
	}
	codec, _ := http.CodecForRequest(r, "Accept")
	data, err := codec.Marshal(v)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write(data)
	return err
}

func errorEncoder(w shttp.ResponseWriter, r *shttp.Request, err error) {
	se := errors.FromError(err)
	codec, _ := http.CodecForRequest(r, "Accept")
	bizCode := v1.ErrorReason_value[se.Reason]
	if bizCode == 0 {
		bizCode = 500
	}

	rsp := v1.Response{
		Ret: &v1.BaseResp{
			Code:   bizCode,
			Reason: se.Reason,
			Msg:    se.Message,
		},
	}
	body, err := codec.Marshal(&rsp)
	if err != nil {
		w.WriteHeader(shttp.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(int(se.Code))
	_, _ = w.Write(body)
}
