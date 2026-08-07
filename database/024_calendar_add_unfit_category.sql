-- ============================================
-- Migration 024：行事曆大分類新增「不適任評估」(unfit)
-- ============================================
-- 原 category_key CHECK 只允許 5 個，改為允許第 6 個 'unfit'。
-- 更新 calendar_schedules 與 calendar_subcategories 兩個約束。可安全重複執行。
-- ============================================

ALTER TABLE calendar_schedules   DROP CONSTRAINT IF EXISTS calendar_schedules_category_key_check;
ALTER TABLE calendar_schedules
  ADD CONSTRAINT calendar_schedules_category_key_check
  CHECK (category_key IN ('routine','announce','project','newcomer','urgent','unfit'));

ALTER TABLE calendar_subcategories DROP CONSTRAINT IF EXISTS calendar_subcategories_category_key_check;
ALTER TABLE calendar_subcategories
  ADD CONSTRAINT calendar_subcategories_category_key_check
  CHECK (category_key IN ('routine','announce','project','newcomer','urgent','unfit'));

NOTIFY pgrst, 'reload schema';
