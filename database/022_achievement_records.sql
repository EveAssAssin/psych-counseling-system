-- ============================================
-- Migration 022：事蹟紀錄（achievement records）
-- ============================================
-- 記錄員工的事蹟（表揚／懲處／事件／貢獻等），作為 AI 分析的資料來源之一。
-- 僅新增資料表，不影響既有資料。
-- ============================================

CREATE TABLE IF NOT EXISTS achievement_records (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID REFERENCES employees(id) ON DELETE CASCADE,
  employee_app_number TEXT,
  employee_name       TEXT,
  title               TEXT NOT NULL,              -- 標題
  content             TEXT NOT NULL,              -- 內容
  record_date         DATE NOT NULL,              -- 事蹟日期
  category            TEXT,                       -- 分類（可選）：表揚/懲處/事件/貢獻
  created_by          TEXT,                       -- 建立人
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_employee
  ON achievement_records(employee_id, record_date DESC);

COMMENT ON TABLE achievement_records IS '員工事蹟紀錄（表揚/懲處/事件/貢獻），供 AI 分析參考';
