-- ============================================================
-- Migration 005: Create employee_ticket_history & ticket_conversations
-- 用於儲存從工單系統同步的員工工單歷史紀錄
-- ============================================================

-- 1. employee_ticket_history: 員工工單紀錄主表
CREATE TABLE IF NOT EXISTS employee_ticket_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL,
  ticket_no TEXT NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_app_number TEXT NOT NULL,
  employee_erp_id TEXT,
  employee_name TEXT,
  store_name TEXT,
  issue_title TEXT,
  issue_desc TEXT,
  category TEXT,
  parent_category TEXT,
  sub_category TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  review_status TEXT,
  priority TEXT DEFAULT 'medium',
  customer_name TEXT,
  customer_code TEXT,
  assigned_engineer TEXT,
  attachment_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  ticket_created_at TIMESTAMPTZ,
  ticket_updated_at TIMESTAMPTZ,
  ticket_closed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 唯一索引：防止重複匯入同一張工單
CREATE UNIQUE INDEX IF NOT EXISTS idx_eth_ticket_id
  ON employee_ticket_history (ticket_id);

CREATE INDEX IF NOT EXISTS idx_eth_ticket_no
  ON employee_ticket_history (ticket_no);

CREATE INDEX IF NOT EXISTS idx_eth_employee_id
  ON employee_ticket_history (employee_id);

CREATE INDEX IF NOT EXISTS idx_eth_employee_app_number
  ON employee_ticket_history (employee_app_number);

CREATE INDEX IF NOT EXISTS idx_eth_status
  ON employee_ticket_history (status);

CREATE INDEX IF NOT EXISTS idx_eth_priority
  ON employee_ticket_history (priority);

CREATE INDEX IF NOT EXISTS idx_eth_parent_category
  ON employee_ticket_history (parent_category);

CREATE INDEX IF NOT EXISTS idx_eth_ticket_created_at
  ON employee_ticket_history (ticket_created_at DESC);

-- RLS
ALTER TABLE employee_ticket_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_eth"
  ON employee_ticket_history FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "authenticated_read_eth"
  ON employee_ticket_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_eth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_eth_updated_at
  BEFORE UPDATE ON employee_ticket_history
  FOR EACH ROW
  EXECUTE FUNCTION update_eth_updated_at();


-- 2. ticket_conversations: 工單對話事件時間軸
CREATE TABLE IF NOT EXISTS ticket_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_history_id UUID REFERENCES employee_ticket_history(id) ON DELETE CASCADE,
  ticket_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_name TEXT,
  actor_role TEXT,
  content TEXT,
  event_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tc_ticket_history_id
  ON ticket_conversations (ticket_history_id);

CREATE INDEX IF NOT EXISTS idx_tc_ticket_id
  ON ticket_conversations (ticket_id);

CREATE INDEX IF NOT EXISTS idx_tc_event_created_at
  ON ticket_conversations (event_created_at);

-- RLS
ALTER TABLE ticket_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_tc"
  ON ticket_conversations FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "authenticated_read_tc"
  ON ticket_conversations FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- 完成！
-- ============================================================
