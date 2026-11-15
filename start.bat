@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo 未找到 Node.js。请先安装 Node.js 20 或更高版本。
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\psn-api" goto install
if not exist "node_modules\react" goto install
goto build

:install
echo 首次启动，正在安装依赖...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo 依赖安装失败，请检查网络后重试。
  pause
  exit /b 1
)

:build
echo 正在构建影境手札...
call npm run build
if errorlevel 1 (
  echo 构建失败，请检查上方错误信息。
  pause
  exit /b 1
)

node dist-server\server.js
pause
