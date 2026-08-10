-- ============================================
-- Migration 026：員工到職日 / 預計離職日（人工維護）
-- ============================================
-- hire_date 多數版本已存在（初始 schema），以 IF NOT EXISTS 保險補上。
-- 新增 expected_resignation_date（預計離職日），由人工於員工詳情頁填寫。
-- 員工同步不會寫入這兩欄，故不會被覆蓋。可安全重複執行。
-- ============================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hire_date DATE;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS expected_resignation_date DATE;

COMMENT ON COLUMN employees.hire_date IS '到職日（人工維護，同步不覆蓋）';
COMMENT ON COLUMN employees.expected_resignation_date IS '預計離職日（人工維護，同步不覆蓋）';

NOTIFY pgrst, 'reload schema';
