#!/bin/bash

# 心理輔導系統 - 一鍵啟動腳本
# 使用方式: 在專案根目錄執行 ./start.sh

echo "🚀 心理輔導系統啟動中..."
echo ""

# 取得腳本所在目錄
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 找不到 Node.js，請先安裝 Node.js${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js 版本: $(node -v)${NC}"

# 檢查並安裝後端依賴
echo ""
echo -e "${YELLOW}📦 檢查後端依賴...${NC}"
if [ ! -d "backend/node_modules" ]; then
    echo "安裝後端依賴中..."
    cd backend && npm install
    cd ..
else
    echo -e "${GREEN}✓ 後端依賴已存在${NC}"
fi

# 檢查並安裝前端依賴
echo ""
echo -e "${YELLOW}📦 檢查前端依賴...${NC}"
if [ ! -d "frontend/node_modules" ]; then
    echo "安裝前端依賴中..."
    cd frontend && npm install
    cd ..
else
    echo -e "${GREEN}✓ 前端依賴已存在${NC}"
fi

# 檢查 .env 檔案
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ 找不到 backend/.env 檔案${NC}"
    echo "請複製 backend/.env.example 為 backend/.env 並填入設定"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   啟動服務中...${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "後端: ${YELLOW}http://localhost:3000${NC}"
echo -e "前端: ${YELLOW}http://localhost:5173${NC}"
echo -e "API 文件: ${YELLOW}http://localhost:3000/api/docs${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止所有服務${NC}"
echo ""

# 使用 trap 捕捉 Ctrl+C，同時關閉前後端
trap 'echo ""; echo "正在停止服務..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0' INT

# 啟動後端 (背景執行)
cd backend
npm run start:dev &
BACKEND_PID=$!
cd ..

# 等待後端啟動
sleep 3

# 啟動前端 (背景執行)
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# 等待子程序
wait
