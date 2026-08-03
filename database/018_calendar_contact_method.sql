-- ============================================
-- Migration 018：行事曆排程新增「訪談方式」欄位
-- ============================================
-- 在 calendar_schedules 增加 contact_method：phone 電話 / face 面談 / line_text LINE文字。
-- 僅新增欄位，不影響既有資料（值域由後端 DTO 驗證）。
-- ============================================

ALTER TABLE calendar_schedules
  ADD COLUMN IF NOT EXISTS contact_method TEXT;

COMMENT ON COLUMN calendar_schedules.contact_method IS '訪談方式：phone 電話 / face 面談 / line_text LINE文字';
