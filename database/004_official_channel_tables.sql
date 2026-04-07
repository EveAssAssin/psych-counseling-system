-- ============================================================
-- Migration 004: Create official_channel_messages & sync_cursors
-- 用於官方頻道訊息同步（LINE 訊息 + 工單留言）
-- ============================================================

-- 1. sync_cursors: 記錄各類同步的游標（最後同步位置）
CREATE TABLE IF NOT EXISTS sync_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL UNIQUE,
  last_synced_at TIMESTAMPTZ,
  last_record_time TEXT,
  total_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE sync_cursors ENABLE ROW LEVEL SECURITY;

-- 允許 service_role 完全存取
CREATE POLICY "service_role_full_access_sync_cursors"
  ON sync_cursors
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- updated_at 自動更新 trigger
CREATE OR REPLACE FUNCTION update_sync_cursors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sync_cursors_updated_at
  BEFORE UPDATE ON sync_cursors
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_cursors_updated_at();


-- 2. official_channel_messages: 儲存從工單系統同步的 LINE 訊息與工單留言
CREATE TABLE IF NOT EXISTS official_channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id TEXT NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'ticket-system',
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_app_number TEXT,
  employee_erp_id TEXT,
  employee_name TEXT,
  group_name TEXT,
  channel TEXT NOT NULL,               -- 'official-line' | 'ticket-comment'
  thread_id TEXT,
  direction TEXT NOT NULL,             -- 'inbound' | 'store' | 'engineer' | 'reviewer'
  message_time TIMESTAMPTZ NOT NULL,
  message_text TEXT,
  message_type TEXT DEFAULT 'text',    -- 'text' | 'image' | 'sticker' | etc.
  ticket_no TEXT,
  author_name TEXT,
  author_role TEXT,
  agent_type TEXT DEFAULT 'human',
  source_updated_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 唯一索引：防止重複匯入同一筆訊息
CREATE UNIQUE INDEX IF NOT EXISTS idx_ocm_source_record
  ON official_channel_messages (source_record_id);

-- 查詢索引
CREATE INDEX IF NOT EXISTS idx_ocm_employee_id
  ON official_channel_messages (employee_id);

CREATE INDEX IF NOT EXISTS idx_ocm_employee_app_number
  ON official_channel_messages (employee_app_number);

CREATE INDEX IF NOT EXISTS idx_ocm_channel
  ON official_channel_messages (channel);

CREATE INDEX IF NOT EXISTS idx_ocm_message_time
  ON official_channel_messages (message_time DESC);

CREATE INDEX IF NOT EXISTS idx_ocm_ticket_no
  ON official_channel_messages (ticket_no)
  WHERE ticket_no IS NOT NULL;

-- 啟用 RLS
ALTER TABLE official_channel_messages ENABLE ROW LEVEL SECURITY;

-- 允許 service_role 完全存取
CREATE POLICY "service_role_full_access_ocm"
  ON official_channel_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 允許已認證用戶讀取
CREATE POLICY "authenticated_read_ocm"
  ON official_channel_messages
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- updated_at 自動更新 trigger
CREATE OR REPLACE FUNCTION update_ocm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ocm_updated_at
  BEFORE UPDATE ON official_channel_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ocm_updated_at();

-- ============================================================
-- 完成！接下來可執行手動同步觸發：
-- POST /api/sync/trigger/official-channel
-- ============================================================
