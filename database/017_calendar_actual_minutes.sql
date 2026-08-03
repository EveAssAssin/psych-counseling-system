-- ============================================
-- Migration 017：行事曆排程新增「實際用時」欄位
-- ============================================
-- 在 calendar_schedules 增加 actual_minutes（事後填寫實際談話用時，分鐘）。
-- 僅新增欄位，不影響既有資料。
-- ============================================

ALTER TABLE calendar_schedules
  ADD COLUMN IF NOT EXISTS actual_minutes INT;

COMMENT ON COLUMN calendar_schedules.actual_minutes IS '實際談話用時（分鐘），事後由管理人員填寫';
