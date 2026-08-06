-- ============================================
-- Migration 019：行事曆標籤改多選
-- ============================================
-- 大分類、小分類都可複選，「第一個選的」為主要。
-- 主要值仍存在既有的 category_key / subcategory_name（驅動顏色、統計，不變）；
-- 完整多選存於新陣列欄位。僅新增欄位，不影響既有資料。
-- ============================================

ALTER TABLE calendar_schedules
  ADD COLUMN IF NOT EXISTS category_keys     TEXT[],
  ADD COLUMN IF NOT EXISTS subcategory_names TEXT[];

COMMENT ON COLUMN calendar_schedules.category_keys IS '大分類多選（第一個=主要，主要另存於 category_key）';
COMMENT ON COLUMN calendar_schedules.subcategory_names IS '小分類多選（第一個=主要，主要另存於 subcategory_name）';
