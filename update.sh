#!/bin/bash
echo "🔄 檢查更新中..."
cd "$(dirname "$0")"
git pull
echo ""
echo "🚀 啟動系統..."
./start.sh
