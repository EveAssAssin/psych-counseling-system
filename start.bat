@echo off
chcp 65001 >nul
title 心理輔導系統

echo.
echo 🚀 心理輔導系統啟動中...
echo.

:: 取得腳本所在目錄
cd /d "%~dp0"

:: 檢查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ 找不到 Node.js，請先安裝 Node.js
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✓ Node.js 版本: %NODE_VERSION%

:: 檢查並安裝後端依賴
echo.
echo 📦 檢查後端依賴...
if not exist "backend\node_modules" (
    echo 安裝後端依賴中...
    cd backend
    call npm install
    cd ..
) else (
    echo ✓ 後端依賴已存在
)

:: 檢查並安裝前端依賴
echo.
echo 📦 檢查前端依賴...
if not exist "frontend\node_modules" (
    echo 安裝前端依賴中...
    cd frontend
    call npm install
    cd ..
) else (
    echo ✓ 前端依賴已存在
)

:: 檢查 .env 檔案
if not exist "backend\.env" (
    echo ❌ 找不到 backend\.env 檔案
    echo 請複製 backend\.env.example 為 backend\.env 並填入設定
    pause
    exit /b 1
)

echo.
echo ========================================
echo    啟動服務中...
echo ========================================
echo.
echo 後端: http://localhost:3000
echo 前端: http://localhost:5173
echo API 文件: http://localhost:3000/api/docs
echo.
echo 關閉此視窗可停止所有服務
echo.

:: 啟動後端 (新視窗)
start "後端服務" cmd /k "cd backend && npm run start:dev"

:: 等待後端啟動
timeout /t 5 /nobreak >nul

:: 啟動前端 (新視窗)
start "前端服務" cmd /k "cd frontend && npm run dev"

:: 等待一下再開瀏覽器
timeout /t 8 /nobreak >nul

:: 自動開啟瀏覽器
start http://localhost:5173

echo.
echo ✓ 服務已啟動！瀏覽器將自動開啟...
echo.
pause
