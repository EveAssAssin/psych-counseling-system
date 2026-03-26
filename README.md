# 心理輔導管理系統 (Psych Counseling System)

企業員工心理狀態管理系統，供主管、HR、授權管理者使用。

## 技術架構

- **後端**: NestJS + TypeScript
- **資料庫**: Supabase (PostgreSQL)
- **AI 分析**: Claude (Anthropic)
- **前端**: React + TypeScript + Vite

## 功能模組

### 核心功能
- 員工主檔管理（支援外部 API 同步）
- 對話 Intake（文字輸入、PDF/DOCX/圖片 OCR）
- AI 心理狀態分析
- 風險標記與追蹤
- 員工狀態快照

### 整合功能
- Google OAuth 登入
- 心橋/OpenClaw 問答 API
- 工單系統對話同步
- 排程任務（每月員工同步、每日資料整合）

## 目錄結構

```
psych-system/
├── backend/                 # NestJS 後端
│   ├── src/
│   │   ├── modules/
│   │   │   ├── supabase/    # Supabase 服務
│   │   │   ├── auth/        # 認證模組
│   │   │   ├── employees/   # 員工管理
│   │   │   ├── stores/      # 門市管理
│   │   │   ├── conversations/ # 對話管理
│   │   │   ├── analysis/    # AI 分析
│   │   │   ├── risk-flags/  # 風險標記
│   │   │   ├── sync/        # 資料同步
│   │   │   ├── query/       # 問答服務
│   │   │   └── scheduler/   # 排程任務
│   │   ├── config/
│   │   └── main.ts
│   ├── package.json
│   └── Dockerfile
├── frontend/                # React 前端（待建立）
├── database/                # 資料庫 Schema
│   └── 001_initial_schema.sql
├── docker-compose.yml
└── README.md
```

## 快速開始

### 1. 設定環境變數

```bash
cd backend
cp .env.example .env
# 編輯 .env 填入必要的 API 金鑰
```

### 2. 建立資料庫

1. 登入 Supabase Dashboard
2. 前往 SQL Editor
3. 執行 `database/001_initial_schema.sql`

### 3. 啟動後端

```bash
cd backend
npm install
npm run start:dev
```

### 4. API 文件

啟動後訪問: http://localhost:3000/api/docs

## API 端點

### 認證
- `GET /api/auth/google` - Google OAuth 登入
- `GET /api/auth/me` - 取得當前使用者

### 員工
- `GET /api/employees` - 搜尋員工
- `GET /api/employees/:id` - 取得員工
- `POST /api/employees` - 建立員工
- `POST /api/employees/bulk-upsert` - 批量同步

### 對話
- `POST /api/conversations` - 建立對話（文字）
- `POST /api/conversations/upload` - 建立對話（檔案）
- `GET /api/conversations/employee/:id` - 取得員工對話

### 分析
- `POST /api/analysis/run/:conversationId` - 執行 AI 分析
- `GET /api/analysis/employee/:id` - 取得員工分析
- `GET /api/analysis/high-risk` - 取得高風險列表

### 風險標記
- `GET /api/risk-flags` - 取得開放的風險標記
- `PATCH /api/risk-flags/:id/acknowledge` - 確認風險
- `PATCH /api/risk-flags/:id/resolve` - 解決風險

### 問答
- `POST /api/query` - 問答查詢
- `GET /api/query/employee-status` - 取得員工狀態

### 同步
- `POST /api/sync/employees` - 同步員工主檔
- `POST /api/sync/daily` - 每日資料同步

## AI 分析輸出

```json
{
  "current_psychological_state": "目前心理狀態描述",
  "stress_level": "low|moderate|high|critical",
  "risk_level": "low|moderate|high|critical",
  "summary": "對話摘要",
  "key_topics": ["議題1", "議題2"],
  "observations": ["觀察1", "觀察2"],
  "suggested_actions": ["建議1", "建議2"],
  "taboo_topics": ["避雷議題"],
  "interviewer_question_suggestions": ["建議問題"],
  "followup_needed": true,
  "supervisor_involvement": "持續觀察|主動關心|立即約談|通報HR",
  "next_talk_focus": "下次談話重點",
  "risk_flags": [
    {
      "type": "self_harm|resignation|conflict|burnout|breakdown",
      "severity": "high|critical",
      "title": "標題",
      "description": "描述",
      "evidence": "依據"
    }
  ]
}
```

## 資料治理

- **主鍵**: `employeeappnumber` (APP 員工編號)
- **輔助鍵**: `employeeerpid` (ERP 員工編號)
- **敏感資料**: Token、密碼、AES key 不進共用層

## 部署

### Docker Compose

```bash
docker-compose up -d
```

### 環境變數

必要的環境變數：
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `JWT_SECRET`

## License

UNLICENSED - 僅供內部使用
