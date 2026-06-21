import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    allowedHosts: ['localhost', 'psych.ruki-ai.com', '.ruki-ai.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // 音檔轉錄 = Whisper + Claude smart-fill 可能跑 1-3 分鐘，
        // 預設 120s 太短會被代理層先 abort，前端看到的「卡住」其實是早就斷線
        timeout: 5 * 60 * 1000,
        proxyTimeout: 5 * 60 * 1000,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
