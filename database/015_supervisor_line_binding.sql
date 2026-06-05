-- ============================================
-- Migration 015：輔導員 LINE 綁定（給每日工作排程推播用）
-- ============================================
-- 目的：
--   每個輔導員可綁定一組 LINE userId，每天早上自動推送當日輔導排程。
--   首次綁定可由本人在 LINE 加好友後，後端透過 LINE webhook 接到 follow event
--   時填入；或臨時用後台手動填入（POST /counseling-cases/supervisors/bind-line）。
--
-- 變更：
--   * authorized_supervisors 新增 nullable line_user_id TEXT
--   * 加 unique index（避免一個 LINE 帳號綁多個輔導員）
-- ============================================

ALTER TABLE authorized_supervisors
  ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- 反向查詢：webhook 收到 LINE userId 時可快速找到對應輔導員
CREATE UNIQUE INDEX IF NOT EXISTS idx_authorized_supervisors_line_user_id
  ON authorized_supervisors(line_user_id)
  WHERE line_user_id IS NOT NULL;

COMMENT ON COLUMN authorized_supervisors.line_user_id IS 'LINE userId（U 開頭的 33 字元字串），用於每日工作排程推播';
