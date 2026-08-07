-- ============================================
-- Migration 025：員工風險標記（人工維護）
-- ============================================
-- 新增 risk_tags（危險/準淘汰/高關注，可多選）。
-- 由人工於員工詳情頁設定；員工同步不會寫入此欄，故不會被覆蓋。
-- 僅新增欄位，不影響既有資料。可安全重複執行。
-- ============================================

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS risk_tags TEXT[];

COMMENT ON COLUMN employees.risk_tags IS '風險標記（人工維護，同步不覆蓋）：危險/準淘汰/高關注';

NOTIFY pgrst, 'reload schema';
