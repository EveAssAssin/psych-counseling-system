-- ============================================
-- Migration 023：事蹟分類改為「事實 / 感受」兩大類 + 感受標籤字典
-- ============================================
-- record_type：事實 / 感受
--   事實 子標籤（固定）：表揚 / 懲處 / 事件 / 貢獻 / 爭議（存於 category）
--   感受 子標籤：使用者自訂、可重用（字典表 achievement_feeling_tags；存於 category）
-- 事實防呆：內容需含數據（由後端判斷），此處不需欄位。
-- 僅新增欄位/表，不影響既有資料。
-- ============================================

ALTER TABLE achievement_records
  ADD COLUMN IF NOT EXISTS record_type TEXT;   -- 事實 / 感受

COMMENT ON COLUMN achievement_records.record_type IS '大分類：事實 / 感受';

-- 感受標籤字典（可累積重用）
CREATE TABLE IF NOT EXISTS achievement_feeling_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN DEFAULT true,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE achievement_feeling_tags IS '事蹟「感受」自訂標籤字典（可重用）';
