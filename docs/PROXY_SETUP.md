# 代理層 Timeout / Body Size 設定指南

長時間 API（音檔轉錄、AI 分析）會經過多層代理，每一層都有自己的 timeout 與 body size 上限。**最嚴的那層決定上限**。

## 你目前的代理層（從外到內）

```
使用者瀏覽器
   ↓
Cloudflare (橙雲代理)           ← ⚠️ 100s 硬上限（Free/Pro）
   ↓ HTTPS
你的 VPS / 雲端伺服器
   ↓
[Nginx / Caddy / Apache?]       ← 若有，預設 60-120s
   ↓
Node.js (Nest) :3001            ← 我們程式碼控制
```

---

## ⚠️ 主要瓶頸：Cloudflare 橙雲 100 秒上限

| 方案 | 適用 Plan | timeout 上限 |
|---|---|---|
| Free | 免費 | **100s** |
| Pro | $25/月 | **100s** |
| Business | $250/月 | **100s** |
| Enterprise | $$$$ | 可調至 6000s |

**症狀**：請求剛好 ~100 秒後失敗，瀏覽器看到 **HTTP 524**（Cloudflare 自己回的）。後端 Whisper / Claude 其實還在跑，但前端已經斷線。

### 解法（按推薦度排序）

#### 解法 1：把 API 子網域改成「灰雲」(DNS only) — 最簡單，免費

在 Cloudflare 後台 DNS 頁面：
- 把 `api.psych.ruki-ai.com`（或你 API 用的網域）的橙雲點掉，變灰雲
- 直接 DNS 解析到你 VPS，**不走 Cloudflare 代理 → 沒有 100s 限制**

代價：失去 Cloudflare 的 DDoS / CDN / WAF 保護，但 API 端通常本來就不需要 CDN。前端網域維持橙雲即可。

```
psych.ruki-ai.com       橙雲 (前端 + 一般 API)
api.psych.ruki-ai.com   灰雲 (慢 API，例如 /api/conversations/transcribe)
```

前端設定 `VITE_API_URL=https://api.psych.ruki-ai.com/api` 指向灰雲子網域，
或在 `frontend/src/services/api.ts` 對 transcribe / 長 API 個別指定 baseURL。

#### 解法 2：把長 API 改成 async (job + polling) — 最正解

不要讓 HTTP 請求等 Whisper + Claude 跑完。改成：
1. `POST /conversations/transcribe-jobs` 即時回 `{ job_id }` 並背景開始處理
2. 前端 `GET /conversations/transcribe-jobs/:job_id` 每 2 秒 poll
3. 任一狀態回 `{ status: 'pending' | 'processing' | 'done' | 'failed', result?, error? }`

每個請求都 < 1 秒，永遠不會撞到任何 timeout。需要程式改動，但長遠最穩。

需要的話我可以做這個改動。

#### 解法 3：升級 Cloudflare Enterprise

不推薦。費用太高。

#### 解法 4：Cloudflare Tunnel (cloudflared) 取代橙雲

把 VPS 直接連到 Cloudflare（不開公網 port）。隧道層 timeout 寬鬆（默認沒明確上限，但仍受 Cloudflare 整體限制）。設定比較複雜，且 100s 限制不一定完全繞過。**不建議優先嘗試。**

---

## Nginx 設定（如果你有用）

若 Cloudflare 後面還有 nginx，請套用 `deploy/nginx.conf.example`。重點：

```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;

    # 給 Whisper + Claude smart-fill 跑完 (1-3 分鐘)
    proxy_read_timeout 360s;
    proxy_send_timeout 360s;
    proxy_connect_timeout 60s;

    # 音檔上傳 25MB+ 必須調大；nginx 預設只允許 1MB!
    client_max_body_size 100M;

    # WebSocket / 長連線 friendly
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # 把客戶端真實 IP 傳給 backend
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

改完 reload：
```bash
sudo nginx -t          # 檢查語法
sudo systemctl reload nginx
```

---

## 其他常見代理層快速對照

### Caddy 2

```caddyfile
psych.ruki-ai.com {
    reverse_proxy /api/* localhost:3001 {
        transport http {
            response_header_timeout 6m
            read_timeout 6m
        }
    }
    request_body {
        max_size 100MB
    }
}
```

### Apache 2.4 (mod_proxy)

```apache
<Location /api/>
    ProxyPass http://localhost:3001/
    ProxyPassReverse http://localhost:3001/
    ProxyTimeout 360
</Location>
LimitRequestBody 104857600  # 100MB
```

### Traefik

```yaml
http:
  middlewares:
    long-timeout:
      buffering:
        maxRequestBodyBytes: 104857600
    long-router-timeout:
      # Traefik 預設無 timeout，但若 entrypoint 有設要解除
```
而 entryPoint 加：
```yaml
entryPoints:
  websecure:
    address: ':443'
    transport:
      respondingTimeouts:
        readTimeout: 6m
        writeTimeout: 6m
        idleTimeout: 6m
```

---

## 快速診斷流程

部署完發現轉錄又卡住時，依序檢查：

```bash
# 1. 直接打後端 (繞過所有代理) — 證明後端本身沒問題
curl -X POST http://localhost:3001/api/health

# 2. 過 nginx 但不過 cloudflare
curl -X POST https://YOUR_VPS_IP/api/health -H "Host: psych.ruki-ai.com" -k

# 3. 完整路徑
curl -X POST https://psych.ruki-ai.com/api/health
```

看到差異就是該層的問題。**最常見的卡點順序：Cloudflare 100s → nginx 60s → app code**。

---

## 對應這個專案目前的修正

| 層 | 限制 | 我們已調 |
|---|---|---|
| Vite dev proxy | 預設 120s | ✅ 改 300s + maxBodyLength |
| Axios timeout | 預設 0 (沒) | ✅ 改 6 分鐘 |
| Multer | 預設不限 | ✅ 加 limits 25/50MB |
| NestJS body parser | 預設 100KB JSON | N/A (multipart 走 multer) |
| **Cloudflare 橙雲** | **100s 硬限制** | ❌ **需要灰雲或改 async 才能繞過** |
| Nginx (若有) | 預設 60s | 參考 `deploy/nginx.conf.example` |

