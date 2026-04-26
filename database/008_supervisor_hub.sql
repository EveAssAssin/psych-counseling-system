-- ============================================================
-- 008_supervisor_hub.sql
-- 主管隨手記 + AI 快問 模組
-- ============================================================

-- ============================================================
-- 1. 紀錄分類（可自訂）
-- ============================================================
CREATE TABLE IF NOT EXISTS note_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#6366f1',   -- hex color for UI badge
  sort_order  INT  DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_by  TEXT,                     -- supervisor identifier
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 預設分類
INSERT INTO note_categories (name, color, sort_order) VALUES
  ('工作態度', '#f59e0b', 1),
  ('客訴/糾紛', '#ef4444', 2),
  ('表現亮點', '#22c55e', 3),
  ('健康/情緒', '#8b5cf6', 4),
  ('其他',      '#6b7280', 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. 有權使用此模組的主管名單
-- ============================================================
CREATE TABLE IF NOT EXISTS authorized_supervisors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  identifier  TEXT NOT NULL UNIQUE,     -- app_number 或自訂登入 ID
  display_name TEXT,
  role        TEXT DEFAULT 'supervisor', -- supervisor | admin
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. 主管隨手記
-- ============================================================
CREATE TABLE IF NOT EXISTS supervisor_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id       TEXT NOT NULL,          -- authorized_supervisors.identifier
  supervisor_name     TEXT NOT NULL,
  -- 被記錄的對象（公司人員 or 外部）
  employee_id         UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_app_number TEXT,
  non_employee_name   TEXT,                   -- 非公司人員姓名
  non_employee_info   JSONB DEFAULT '{}',     -- 附加資訊（職稱、備註等）
  is_external         BOOLEAN DEFAULT false,  -- true = 非公司人員
  -- 內容
  category_id         UUID REFERENCES note_categories(id) ON DELETE SET NULL,
  category_name       TEXT,                   -- snapshot，避免分類被刪後失去資訊
  content             TEXT NOT NULL,
  images              TEXT[] DEFAULT '{}',    -- Supabase Storage URLs
  -- 狀態
  is_deleted          BOOLEAN DEFAULT false,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supervisor_notes_supervisor   ON supervisor_notes(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_notes_employee     ON supervisor_notes(employee_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_notes_app_number   ON supervisor_notes(employee_app_number);
CREATE INDEX IF NOT EXISTS idx_supervisor_notes_created_at   ON supervisor_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supervisor_notes_not_deleted  ON supervisor_notes(is_deleted) WHERE is_deleted = false;

-- ============================================================
-- 4. AI 機密名單（可記錄，但 AI 不得討論）
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_confidential_list (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_app_number TEXT,
  employee_name       TEXT,             -- snapshot
  reason              TEXT,             -- 列入原因
  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_app_number)
);

-- ============================================================
-- 5. AI 人格設定（Claude / OpenAI / Gemini）
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_personas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_type       TEXT NOT NULL CHECK (ai_type IN ('claude', 'openai', 'gemini')),
  persona_name  TEXT NOT NULL,          -- 顯示名稱，例如「心理顧問小安」
  system_prompt TEXT NOT NULL,          -- 人格系統提示詞
  model         TEXT,                   -- 模型版本，可為 null 使用預設
  is_active     BOOLEAN DEFAULT true,
  is_default    BOOLEAN DEFAULT false,  -- 每個 ai_type 只有一個 default
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ai_type, persona_name)
);

-- 預設人格
INSERT INTO ai_personas (ai_type, persona_name, system_prompt, model, is_active, is_default) VALUES
(
  'claude',
  '心理顧問（Claude）',
  '你是一位專業的職場心理顧問，協助主管深入了解員工的狀況。
你的特質：
- 客觀中立，不偏頗
- 善於從多角度分析問題
- 提供具體可行的建議
- 語氣溫和但直接
請根據提供的員工資料，給出深入的分析與建議。',
  'claude-opus-4-6',
  true,
  true
),
(
  'openai',
  '職場分析師（GPT）',
  '你是一位資深的職場心理分析師，擅長從數據與行為模式中發現問題。
你的特質：
- 邏輯清晰，善用結構化分析
- 注重數字與趨勢
- 提供多個解決方案供比較
- 語氣專業、條理分明
請根據員工資料，提供系統性的分析報告。',
  'gpt-4o',
  true,
  true
),
(
  'gemini',
  '員工關懷顧問（Gemini）',
  '你是一位關注員工整體幸福感的顧問，善於發現潛在的心理需求。
你的特質：
- 關懷導向，注重情感因素
- 善於發現字裡行間的訊號
- 建議以關懷為出發點
- 語氣溫暖、有同理心
請根據員工資料，從關懷角度提供洞察與建議。',
  'gemini-1.5-pro',
  true,
  true
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. AI 快問對話 Session
-- ============================================================
CREATE TABLE IF NOT EXISTS supervisor_ai_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id       TEXT NOT NULL,
  supervisor_name     TEXT NOT NULL,
  employee_id         UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_app_number TEXT,
  employee_name       TEXT,             -- snapshot
  ai_type             TEXT NOT NULL CHECK (ai_type IN ('claude', 'openai', 'gemini')),
  persona_id          UUID REFERENCES ai_personas(id) ON DELETE SET NULL,
  title               TEXT,             -- 自動生成或手動設定
  message_count       INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_supervisor  ON supervisor_ai_sessions(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_employee    ON supervisor_ai_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_created_at  ON supervisor_ai_sessions(created_at DESC);

-- ============================================================
-- 7. AI 快問對話訊息
-- ============================================================
CREATE TABLE IF NOT EXISTS supervisor_ai_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES supervisor_ai_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  ai_type     TEXT,                     -- 回應時用哪個 AI
  tokens_used INT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session    ON supervisor_ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON supervisor_ai_messages(created_at);
