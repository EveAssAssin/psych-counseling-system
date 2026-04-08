-- ============================================
-- Migration 006: reviews 加入外部同步欄位
-- 支援從 review-system 外部 API 同步評價資料
-- ============================================

-- 加入 external_review_id：外部系統的評價 ID（用於 upsert 比對）
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS external_review_id TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NULL;

-- 建立唯一索引，確保同一筆外部評價不會重複匯入
CREATE UNIQUE INDEX IF NOT EXISTS reviews_external_review_id_idx
  ON reviews (external_review_id)
  WHERE external_review_id IS NOT NULL;

-- 建立索引加速同步查詢
CREATE INDEX IF NOT EXISTS reviews_deleted_at_idx ON reviews (deleted_at);
CREATE INDEX IF NOT EXISTS reviews_synced_at_idx ON reviews (synced_at);

-- 說明：
-- external_review_id: 對應到 review-system 的原始評價 ID
-- deleted_at:        來源刪除時間（NULL = 正常，有值 = 已刪除）
-- synced_at:         最後一次從來源同步的時間
