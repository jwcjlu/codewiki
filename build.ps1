# PowerShell build script for codewiki
Write-Host "Building codewiki for Windows..." -ForegroundColor Green

# 创建bin目录
if (!(Test-Path "bin")) {
    New-Item -ItemType Directory -Path "bin" | Out-Null
}

# 设置Go环境变量
$env:GOPROXY = "https://goproxy.cn"
$env:CGO_ENABLED = "0"
$env:GOOS = "windows"
$env:GOARCH = "amd64"

# 获取版本信息
try {
    $VERSION = git describe --tags --always 2>$null
    if (!$VERSION) { $VERSION = "dev" }
} catch {
    $VERSION = "dev"
}

Write-Host "Building version: $VERSION" -ForegroundColor Yellow

# 构建应用
try {
    go build -ldflags "-X main.Version=$VERSION" -o ./bin/server.exe ./cmd/codewiki
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Build successful! Binary created at: bin/server.exe" -ForegroundColor Green
    } else {
        Write-Host "Build failed with error code: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host "Build failed with error: $_" -ForegroundColor Red
    exit 1
}

