#!/bin/bash
cd "$(dirname "$0")"

# 關閉舊程序
pkill -f "node" 2>/dev/null
pkill -f "serve" 2>/dev/null
sleep 1

# 啟動後端
osascript -e 'tell app "Terminal" to do script "cd ~/Downloads/psych-system-v3/backend && npm run start:dev"'

# 等後端啟動
sleep 3

# 啟動前端
osascript -e 'tell app "Terminal" to do script "cd ~/Downloads/psych-system-v3/frontend/dist && npx serve -l 5173 -s"'

# 啟動 Cloudflare Tunnel
osascript -e 'tell app "Terminal" to do script "cloudflared tunnel run psych-system"'

echo "✅ 已啟動所有服務"
echo "🌐 外部網址: https://psych.ruki-ai.com"
