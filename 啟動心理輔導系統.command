#!/bin/bash
cd "$(dirname "$0")"
echo "🔄 檢查更新中..."
git pull
echo ""
echo "🚀 啟動系統..."
./start.sh
