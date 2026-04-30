-- 人評會記錄資料表
-- 每筆記錄可關聯多個分類標籤，全主管共享可查閱

CREATE TABLE IF NOT EXISTS personnel_review_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_app_number TEXT,
  employee_name TEXT,
  -- 多標籤：[{id, name, color}]
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,          -- supervisor identifier
  created_by_name TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prr_employee ON personnel_review_records(employee_app_number);
CREATE INDEX IF NOT EXISTS idx_prr_created_by ON personnel_review_records(created_by);
CREATE INDEX IF NOT EXISTS idx_prr_created_at ON personnel_review_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prr_is_deleted ON personnel_review_records(is_deleted);

-- RLS（同 supervisor_notes）
ALTER TABLE personnel_review_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON personnel_review_records
  FOR ALL TO service_role USING (true) WITH CHECK (true);
