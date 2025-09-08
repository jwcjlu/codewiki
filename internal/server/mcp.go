package server

import (
	"codewiki/internal/conf"
	"codewiki/internal/service"
	"context"
	"fmt"
	"github.com/go-kratos/kratos/v2/log"
	mcp_golang "github.com/metoro-io/mcp-golang"
	"github.com/metoro-io/mcp-golang/transport/http"
)

func NewMCPServer(c *conf.Server, service *service.MCPService) *MCPServer {
	// Create an HTTP transport that listens on /mcp endpoint
	port := 8080
	if c.Mcp != nil && c.Mcp.GetPort() > 0 {
		port = int(c.Mcp.GetPort())
	}
	transport := http.NewHTTPTransport("/mcp").WithAddr(fmt.Sprintf(":%d", port))

	// Create a new server with the transport
	server := mcp_golang.NewServer(
		transport,
		mcp_golang.WithName("mcp-golang-stateless-http-example"),
		mcp_golang.WithInstructions("A simple example of a stateless HTTP server using mcp-golang"),
		mcp_golang.WithVersion("0.0.1"),
	)
	// 注册工具
	err := service.RegisterTools(server)
	if err != nil {
		panic(err)
	}
	// 注册提示
	err = service.RegisterPrompts(server)
	if err != nil {
		panic(err)
	}

	err = service.RegisterResources(server)
	if err != nil {
		panic(err)
	}
	return &MCPServer{server: server}
}

type MCPServer struct {
	server *mcp_golang.Server
	logger log.Logger
}

// Start 启动 MCP 服务器
func (m *MCPServer) Start(ctx context.Context) error {
	log.Info("Starting MCP server...")
	return m.server.Serve()
}
func (m *MCPServer) Stop(ctx context.Context) error {
	log.Info("Stopping MCP server...")
	return nil
}
