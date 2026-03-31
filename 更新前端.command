#!/bin/bash
cd ~/Downloads/psych-system-v3/frontend

echo "🔨 重新 build 前端..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build 成功！"
    
    echo "🔄 重啟前端伺服器..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null
    sleep 1
    
    cd dist && npx serve -l 5173 -s &
    
    echo "✅ 前端已更新！"
    echo "🌐 網址: https://psych.ruki-ai.com"
else
    echo "❌ Build 失敗，請檢查錯誤"
fi
