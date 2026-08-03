-- ============================================
-- Migration 016：行事曆與工作排程（calendar schedules）
-- ============================================
-- 目的：
--   管理人員在行事曆上安排員工關懷 / 面談 / 流程佈達 / 專案追蹤 /
--   新人輔導 / 緊急案件等工作，以「週」為單位、以「時間」定位。
--
-- 兩張新表（皆為新增，不動任何既有表）：
--   A. calendar_subcategories — 標籤小分類字典（可新增自訂、停用、計次）
--   B. calendar_schedules     — 排程主表（含開始時間、時長、結束時間、狀態…）
--
-- 設計重點：
--   * 大分類（category_key）為固定 5 項，寫在 CHECK 內，不另設表。
--   * 員工以 employee_app_number 為主要關聯依據（避免同名），並冗餘存
--     employee_name / store_name 方便顯示，employee_id 保留 FK。
--   * 小分類允許自訂：同一大分類下 name 唯一；已被排程使用者改停用不刪。
--   * 排程不實體刪除，取消改為 status='cancelled' + cancel_reason。
--   * attendance_check 記錄「建立當下」的排班檢查結果，供事後追溯。
-- ============================================


-- ============================================================
-- A. 標籤小分類字典
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_subcategories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key  TEXT NOT NULL                              -- 對應固定大分類
                CHECK (category_key IN ('routine','announce','project','newcomer','urgent')),
  name          TEXT NOT NULL,                             -- 小分類名稱（上限 20 字，由後端驗證）
  usage_count   INT DEFAULT 0,                             -- 被排程使用次數
  is_active     BOOLEAN DEFAULT true,                      -- 停用（不再出現於新增選單）
  created_by    TEXT,                                      -- 建立者顯示名
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category_key, name)                              -- 同大分類下不可重複
);

CREATE INDEX IF NOT EXISTS idx_calendar_subcat_active
  ON calendar_subcategories(category_key, is_active);

COMMENT ON TABLE calendar_subcategories IS '行事曆標籤小分類字典（可後台維護 / 使用者自訂）';
COMMENT ON COLUMN calendar_subcategories.category_key IS '固定大分類：routine 例行性關懷 / announce 流程佈達 / project 專案焦點 / newcomer 新人輔導 / urgent 緊急案件';


-- ============================================================
-- B. 排程主表
-- ============================================================
CREATE TABLE IF NOT EXISTS calendar_schedules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 時間
  schedule_date        DATE NOT NULL,                      -- 排程日期
  start_time           TIME NOT NULL,                      -- 開始時間
  duration_minutes     INT  NOT NULL                       -- 談話時長
                       CHECK (duration_minutes IN (5,10,15,30,60)),
  end_time             TIME NOT NULL,                      -- 結束時間（後端依開始+時長計算後存入）

  -- 對象（以 app_number 為主，冗餘存顯示欄位）
  employee_id          UUID REFERENCES employees(id) ON DELETE RESTRICT,
  employee_app_number  TEXT NOT NULL,
  employee_name        TEXT NOT NULL,
  store_name           TEXT,

  -- 標籤
  category_key         TEXT NOT NULL
                       CHECK (category_key IN ('routine','announce','project','newcomer','urgent')),
  subcategory_id       UUID REFERENCES calendar_subcategories(id) ON DELETE SET NULL,
  subcategory_name     TEXT NOT NULL,                      -- 冗餘存名稱，避免字典異動影響歷史

  -- 內容
  note                 TEXT NOT NULL,                      -- 談話主題 / 備註

  -- 排班檢查結果（建立當下）
  attendance_check     TEXT,                               -- 例如 '上班' / 原始 attendanceResult

  -- 狀態
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','completed','cancelled','no_show','follow_up')),
  cancel_reason        TEXT,
  completed_at         TIMESTAMPTZ,

  -- 稽核
  created_by           TEXT,                               -- 建立人顯示名
  created_by_id        TEXT,                               -- 建立人識別（app_number / supervisor id）
  updated_by           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_sched_date
  ON calendar_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_calendar_sched_emp_date
  ON calendar_schedules(employee_app_number, schedule_date);
CREATE INDEX IF NOT EXISTS idx_calendar_sched_creator_date
  ON calendar_schedules(created_by_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_calendar_sched_status
  ON calendar_schedules(status);

COMMENT ON TABLE calendar_schedules IS '行事曆排程主表（週檢視 / 時間定位）';
COMMENT ON COLUMN calendar_schedules.status IS 'pending 待進行 / completed 已完成 / cancelled 已取消 / no_show 未執行 / follow_up 需後續追蹤';
COMMENT ON COLUMN calendar_schedules.attendance_check IS '建立當下由 HRM 出勤 API 取得的排班檢查結果（保守：非「上班」不允許建立）';


-- ============================================================
-- updated_at 自動更新（沿用 PostgreSQL trigger 慣例）
-- ============================================================
CREATE OR REPLACE FUNCTION set_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_schedules_updated ON calendar_schedules;
CREATE TRIGGER trg_calendar_schedules_updated
  BEFORE UPDATE ON calendar_schedules
  FOR EACH ROW EXECUTE FUNCTION set_calendar_updated_at();

DROP TRIGGER IF EXISTS trg_calendar_subcat_updated ON calendar_subcategories;
CREATE TRIGGER trg_calendar_subcat_updated
  BEFORE UPDATE ON calendar_subcategories
  FOR EACH ROW EXECUTE FUNCTION set_calendar_updated_at();


-- ============================================================
-- 預設小分類種子（可日後於後台增修）
-- ============================================================
INSERT INTO calendar_subcategories (category_key, name, created_by) VALUES
  ('routine',  '月度關懷',       'system'),
  ('routine',  '狀態追蹤',       'system'),
  ('routine',  '滿意度確認',     'system'),
  ('announce', '公告佈達',       'system'),
  ('announce', '政策說明',       'system'),
  ('announce', '流程變更',       'system'),
  ('project',  '專案啟動',       'system'),
  ('project',  '進度檢視',       'system'),
  ('project',  '結案回顧',       'system'),
  ('newcomer', '第一週關懷',     'system'),
  ('newcomer', '工作適應',       'system'),
  ('newcomer', '教學進度確認',   'system'),
  ('newcomer', '系統操作問題',   'system'),
  ('urgent',   '情緒事件',       'system'),
  ('urgent',   '衝突處理',       'system'),
  ('urgent',   '緊急約談',       'system')
ON CONFLICT (category_key, name) DO NOTHING;
