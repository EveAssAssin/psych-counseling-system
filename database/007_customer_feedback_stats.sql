-- ============================================================
-- Migration 007: customer_feedback_stats 表
-- 儲存從 review-system /psych-sync/reviews 同步來的
-- 每位員工客戶回報（投訴/建議/稱讚）統計摘要
-- 執行位置：Supabase Dashboard → SQL Editor
-- ============================================================

-- 主表：每位員工的客訴/回報統計（每次同步覆蓋）
CREATE TABLE IF NOT EXISTS customer_feedback_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_app_number TEXT NOT NULL,
  employee_name       TEXT,
  store_name          TEXT,

  -- 總量統計
  total_feedbacks     INTEGER NOT NULL DEFAULT 0,
  pending_count       INTEGER NOT NULL DEFAULT 0,
  processing_count    INTEGER NOT NULL DEFAULT 0,
  resolved_count      INTEGER NOT NULL DEFAULT 0,
  closed_count        INTEGER NOT NULL DEFAULT 0,

  -- 類型分佈（JSON 欄位，彈性儲存）
  by_type             JSONB DEFAULT '{}'::jsonb,
  -- 格式: {"complaint": 3, "suggestion": 1, "praise": 2, "inquiry": 0, "other": 0}

  -- 緊急度分佈
  by_urgency          JSONB DEFAULT '{}'::jsonb,
  -- 格式: {"urgent_plus": 1, "urgent": 2, "normal": 5}

  -- 最新回報時間
  latest_feedback_at  TIMESTAMPTZ,

  -- 原始回傳資料（保留完整 JSON 備用）
  raw_data            JSONB DEFAULT '{}'::jsonb,

  -- 同步時間
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_customer_feedback_stats_app_number UNIQUE (employee_app_number)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cfs_employee_id      ON customer_feedback_stats(employee_id);
CREATE INDEX IF NOT EXISTS idx_cfs_synced_at        ON customer_feedback_stats(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_cfs_total_feedbacks  ON customer_feedback_stats(total_feedbacks DESC);
CREATE INDEX IF NOT EXISTS idx_cfs_pending_count    ON customer_feedback_stats(pending_count DESC);

-- 說明
COMMENT ON TABLE customer_feedback_stats IS '從 review-system /psych-sync/reviews 同步的每位員工客戶回報統計摘要';
COMMENT ON COLUMN customer_feedback_stats.by_type IS 'JSON 格式：{"complaint":3,"suggestion":1,"praise":2,"inquiry":0,"other":0}';
COMMENT ON COLUMN customer_feedback_stats.by_urgency IS 'JSON 格式：{"urgent_plus":1,"urgent":2,"normal":5}';
COMMENT ON COLUMN customer_feedback_stats.raw_data IS '原始 API 回傳資料，保留完整欄位供未來擴充';
