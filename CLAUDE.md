# CLAUDE.md — 給 AI 助手看的專案指引

心理輔導系統。給下一個接手的 Claude session 快速上手用。看完就照著做，不要重複盤點。

---

## Stack 一句話總結

- **Backend**：NestJS 10 (TypeScript) + Supabase (Postgres) + Anthropic SDK (Claude) + OpenAI SDK (Whisper)
- **Frontend**：React + TypeScript + Vite + Zustand + Tailwind + Headless UI
- **部署**：Backend 跑在 **Render**（本機不啟動 backend runtime，只做開發）
- **DB**：Supabase Postgres，用 `@supabase/supabase-js` SDK 存取（走 REST，不直連 Postgres）

---

## Migration Workflow（重要！）

**不要**手動去 Supabase Dashboard SQL Editor 貼 SQL。系統有內建 Node migration runner：

- 位置：`backend/src/scripts/migrate.ts`（含 baseline / status / up 三模式）
- 追蹤表：Supabase 上的 `schema_migrations`（已用 baseline 建好，記錄 001~026 為已執行）
- SQL 檔位置：`database/NNN_描述.sql`（3 位數字排序）
- 詳細說明：`database/README.md`

**新增 migration 流程：**
1. 建 `database/NNN_描述.sql`（NNN 接續現有最大編號 +1）
2. 寫 SQL
3. `git push` → **Render 部署時自動跑 `npm run db:migrate:up`** → 應用到 Supabase
4. 已跑過的檔案 skip，只跑新的

**開發時你（Claude）不需要跑 migration** — 只要寫檔 + push，Render 會處理。若要在本機測試 SQL 語法，Supabase SQL Editor 貼上跑（**不要 commit `schema_migrations` 記錄**）。

**鐵律：已跑過的 migration 不能改內容。** 要修就寫新的 migration 反轉/修正。

---

## Git 同步（跨電腦開發）

使用者在多台電腦切換開發。**每次開工前先 pull、收工前先 push**，GitHub 是唯一真理。

參考使用者的 `git-sync-workflow` skill。開工前必跑：
```
git pull --ff-only
```

若使用 Cowork sandbox（掛載點 `/sessions/*/mnt/psych`），**掛載點的 `.git` 有 unlink 限制無法用 git 操作**。標準做法：
1. 在 `/tmp/psych-*` 建臨時 git repo（partial clone `--filter=blob:none --depth=1` 快速）
2. 從掛載點 rsync 檔案進去
3. commit + push
4. rsync 需要的檔案（例如 dist）回掛載點

**Sandbox 重啟後 `/tmp` 會清空**，記得每次 session 開始重建。

---

## 環境變數

Backend `.env`（在 Render Environment 設，本機不需要跑 backend runtime）：
- `SUPABASE_URL` — REST API URL
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` — Postgres 直連字串（給 migration runner 用，Session pooler port 5432）
- `ANTHROPIC_API_KEY` — Claude 分析
- `OPENAI_API_KEY` — Whisper 音檔轉錄（選用，沒設的話音檔上傳會失敗但其他不影響）
- `JWT_SECRET` — 使用者 auth
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth（現已改為 app_number 登入為主，Google login 保留備用）
- `E0123_TOKEN` / `E0123_COMPANY_ID` — 樂活訂單系統
- `REVIEW_SYSTEM_API_URL` / `REVIEW_SYSTEM_API_KEY` — 評價系統
- `TICKET_SYSTEM_API_URL` / `TICKET_SYSTEM_API_KEY` — 工單系統

---

## 權限模型

- 兩種角色：`admin`（超級管理者，可管理權限）/ `counselor`（輔導人員，一般使用）
- 登入方式：**樂活統一入口跳轉** `?app_number=員工編號` → 系統查 `employees` → `users` → `user_roles` 三張表驗證
- 「員工管理」頁面的「權限管理」分頁（僅 admin 可見）給你操作
- 相關 code：`backend/src/modules/permissions/`、`backend/src/modules/auth/`、`frontend/src/components/PermissionsTab.tsx`、`frontend/src/pages/EntryPage.tsx`

---

## 幾個常踩的坑

1. **`employees` 表欄位名是 `employeeappnumber`（無底線）**，但 `official_channel_messages` 是 `employee_app_number`（有底線）。寫 join / 查詢時特別注意。
2. **Supabase SDK 走 REST 不是 direct Postgres**，寫 `.from('table')` 時 field 名要跟 DB 完全一致。
3. **JWT 有 7 天有效期**，RolesGuard 從 DB 即時查 role，撤銷立即生效。
4. **Root `.gitignore` 是 UTF-16 編碼**（歷史遺留 bug），git 沒真的 ignore `node_modules/`。commit 時用明確路徑避免誤加。
5. **Backend 上傳處理**：PDF/DOCX/圖片用 `extraction.service.ts`；音檔用 `audio-transcription.service.ts` + Whisper；智慧預填用 `smart-fill.service.ts`。

---

## AI 服務讀取員工資料時要用共用 helper

不要各服務自己組員工對話上下文。用 `EmployeeContextService.buildConversationContext(employeeId, options)`（在 `backend/src/modules/conversations/employee-context.service.ts`），它會組出「近 N 筆完整對話 + 更早 M 筆分析摘要 + 每筆對應 analysis 結果」給 AI prompt 用。

已整合到：`employee-insight`、`supervisor-ai`、`query`、`line-assistant` 四個 AI 服務。加新 AI 服務時也用它。

---

## 對使用者的溝通風格

使用者是 Louis（樂活眼鏡），偏好：
- **簡短直接**，能刪的字都刪
- **少用 emoji**（除非使用者先用）
- **用選項題確認**（不要一路瞎猜）
- **不需要每次都重新盤點**，看 CLAUDE.md 直接動手
- 開工前先 pull，收工前先 push，都用 `git-sync-workflow` skill 的做法
