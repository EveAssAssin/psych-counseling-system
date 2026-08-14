-- ============================================
-- Migration 027：逾期管理（Phase 1）
-- ============================================
-- 1) 擴充 calendar_schedules.status 為七種案件狀態（保留舊值相容）
-- 2) 新增 overdue_reason（逾期原因）
-- 3) 新表 schedule_reschedules（改期歷史，原始不覆蓋）
-- 4) 新表 schedule_monitor_photos（監控證明照片，走 Supabase Storage）
-- 皆為新增，不影響既有資料。可安全重複執行。
-- ============================================

-- 1) status 擴充
ALTER TABLE calendar_schedules DROP CONSTRAINT IF EXISTS calendar_schedules_status_check;
ALTER TABLE calendar_schedules
  ADD CONSTRAINT calendar_schedules_status_check
  CHECK (status IN (
    'pending',            -- 待處理
    'in_progress',        -- 處理中
    'awaiting_followup',  -- 待追蹤
    'overdue',            -- 已逾期
    'completed',          -- 已完成（當次排程完成）
    'closed',             -- 已結案（整個事件無需再追蹤）
    'cancelled',          -- 已取消
    'no_show',            -- 舊值相容
    'follow_up'           -- 舊值相容
  ));

-- 2) 逾期原因
ALTER TABLE calendar_schedules ADD COLUMN IF NOT EXISTS overdue_reason TEXT;

-- 3) 改期歷史（原始資料不得覆蓋）
CREATE TABLE IF NOT EXISTS schedule_reschedules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id              UUID REFERENCES calendar_schedules(id) ON DELETE CASCADE,
  new_schedule_id          UUID,
  original_date            DATE,
  original_start_time      TEXT,
  original_duration_minutes INT,
  new_date                 DATE,
  new_start_time           TEXT,
  new_duration_minutes     INT,
  reason                   TEXT,
  changed_by               TEXT,
  changed_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reschedule_schedule ON schedule_reschedules(schedule_id, changed_at DESC);

-- 4) 監控證明照片
CREATE TABLE IF NOT EXISTS schedule_monitor_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id  UUID REFERENCES calendar_schedules(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  image_path   TEXT,
  note         TEXT,
  uploaded_by  TEXT,
  uploaded_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monitor_schedule ON schedule_monitor_photos(schedule_id, uploaded_at DESC);

NOTIFY pgrst, 'reload schema';
