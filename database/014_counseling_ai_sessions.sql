-- ============================================
-- Migration 014：輔導案 AI 討論
-- ============================================
-- 目的：
--   每個輔導案要能開 AI 討論視窗，所有討論被記錄。
--   採「擴充既有 supervisor_ai_sessions」策略，所有 AI 對話統一一張表，
--   只是案件級的多帶一個 case_id。
--
-- 變更：
--   * supervisor_ai_sessions 新增 nullable 欄位 case_id
--     - NULL  → 既有的通用快問對話
--     - UUID  → 該案件的專屬討論
--   * 加 index 方便「拿案 X 的所有 session」、「拿輔導員 Y 在案 X 的 session」
--
-- 不影響：
--   * supervisor_ai_messages 不動（仍然 cascade 跟著 session）
--   * 既有快問對話的 session 不受影響
-- ============================================

ALTER TABLE supervisor_ai_sessions
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES counseling_cases(id) ON DELETE SET NULL;

-- 拿案 X 的所有 session（按時間排序）
CREATE INDEX IF NOT EXISTS idx_supervisor_ai_sessions_case
  ON supervisor_ai_sessions(case_id, created_at DESC)
  WHERE case_id IS NOT NULL;

-- 拿輔導員 Y 在案 X 的 session（建 session 時用來去重 / 找既有 session）
CREATE INDEX IF NOT EXISTS idx_supervisor_ai_sessions_case_supervisor
  ON supervisor_ai_sessions(case_id, supervisor_id)
  WHERE case_id IS NOT NULL;

COMMENT ON COLUMN supervisor_ai_sessions.case_id IS '若此 session 為某輔導案的專屬討論，存對應 counseling_cases.id；NULL 表示通用快問對話';
