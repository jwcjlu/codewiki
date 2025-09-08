#!/usr/bin/env node

const http = require('http');
const readline = require('readline');

// MCP HTTP 服务器配置
const MCP_SERVER_HOST = 'localhost';
const MCP_SERVER_PORT = 8080;
const MCP_SERVER_PATH = '/mcp';

// 创建 HTTP 请求选项
const options = {
  hostname: MCP_SERVER_HOST,
  port: MCP_SERVER_PORT,
  path: MCP_SERVER_PATH,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// 处理输入数据
rl.on('line', (line) => {
  try {
    // 解析 JSON 输入
    const data = JSON.parse(line);
    
    // 发送 HTTP 请求
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          // 解析响应并输出
          const response = JSON.parse(responseData);
          console.log(JSON.stringify(response));
        } catch (e) {
          console.error('Error parsing response:', e.message);
          console.log(responseData);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('HTTP request error:', err.message);
    });
    
    // 发送请求数据
    req.write(JSON.stringify(data));
    req.end();
    
  } catch (e) {
    console.error('Error parsing input:', e.message);
  }
});

// 处理错误
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
