FROM golang:1.24 AS builder

# 设置工作目录
WORKDIR /src

# 复制go mod文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags "-X main.Version=$(git describe --tags --always 2>/dev/null || echo 'dev')" -o ./bin/server ./cmd/codewiki

FROM debian:stable-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
		ca-certificates  \
        netbase \
        && rm -rf /var/lib/apt/lists/ \
        && apt-get autoremove -y && apt-get autoclean -y

# 创建应用目录
RUN mkdir -p /app

# 复制构建产物
COPY --from=builder /src/bin/server /app/

WORKDIR /app

EXPOSE 8000
EXPOSE 9000
VOLUME /data/conf

CMD ["./server", "-conf", "/data/conf"]
