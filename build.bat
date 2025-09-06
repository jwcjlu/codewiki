@echo off
echo Building codewiki for Windows...

REM 创建bin目录
if not exist "bin" mkdir bin

REM 设置Go环境变量
set GOPROXY=https://goproxy.cn
set CGO_ENABLED=0
set GOOS=windows
set GOARCH=amd64

REM 获取版本信息
for /f "tokens=*" %%i in ('git describe --tags --always 2^>nul') do set VERSION=%%i
if "%VERSION%"=="" set VERSION=dev

echo Building version: %VERSION%

REM 构建应用
go build -ldflags "-X main.Version=%VERSION%" -o ./bin/server.exe ./cmd/codewiki

if %ERRORLEVEL% EQU 0 (
    echo Build successful! Binary created at: bin/server.exe
) else (
    echo Build failed with error code: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

