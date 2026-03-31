#!/bin/bash

# 等待網路
sleep 10

# 啟動後端
cd ~/Downloads/psych-system-v3/backend
npm run start:dev &

# 等後端啟動
sleep 5

# 啟動前端
cd ~/Downloads/psych-system-v3/frontend/dist
npx serve -l 5173 -s &

# 啟動 Cloudflare Tunnel
cloudflared tunnel run psych-system &

echo "✅ 心理輔導系統已啟動"
