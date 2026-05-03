-- ============================================================
-- Migration 011: LINE 訊息補強
-- 1. 補入歷史主管回覆支援（is_manual_insert）
-- 2. 系統訊息標記支援（is_system_message）
--    - 用於過濾 LINE 自動回覆選單等訊息，減少 AI token 消耗
-- ============================================================

-- 新增欄位到 official_channel_messages
ALTER TABLE official_channel_messages
  ADD COLUMN IF NOT EXISTS is_system_message BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_manual_insert  BOOLEAN NOT NULL DEFAULT FALSE;

-- 索引（系統訊息過濾常用）
CREATE INDEX IF NOT EXISTS idx_ocm_system_message
  ON official_channel_messages (is_system_message)
  WHERE is_system_message = TRUE;

-- 刷新 PostgREST schema cache
NOTIFY pgrst, 'reload schema';
