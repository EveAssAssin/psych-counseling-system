-- ============================================
-- Migration 021：行事曆逾期「已重新安排」標記
-- ============================================
-- 逾期排程按「重新安排」並成功建立新排程後，於原排程記錄已重排。
-- 僅新增欄位，不影響既有資料。
-- ============================================

ALTER TABLE calendar_schedules
  ADD COLUMN IF NOT EXISTS rescheduled_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rescheduled_to_id UUID;

COMMENT ON COLUMN calendar_schedules.rescheduled_at IS '此逾期排程被重新安排的時間（有值＝已重新安排）';
COMMENT ON COLUMN calendar_schedules.rescheduled_to_id IS '重新安排後新建立的排程 id（可追溯）';
