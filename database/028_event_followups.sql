-- ============================================
-- Migration 028：事件後續（Phase 2）
-- ============================================
-- 完成電訪後的後續追蹤，需支援多次新增、時間軸呈現、歷史不覆蓋。
-- 以 schedule_id 關聯原排程，並冗餘 employee 資訊供個人頁彙整（Phase 4）。
-- 僅新增資料表，不影響既有資料。可安全重複執行。
-- ============================================

CREATE TABLE IF NOT EXISTS event_followups (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id          UUID REFERENCES calendar_schedules(id) ON DELETE CASCADE,
  employee_id          UUID,
  employee_app_number  TEXT,
  followup_status      TEXT NOT NULL,   -- 無需後續/持續關懷/需再次聯繫/需安排面談/需主管追蹤/轉其他單位處理/其他
  content              TEXT,            -- 後續內容
  result               TEXT,            -- 處理結果
  need_next            BOOLEAN DEFAULT false,  -- 是否需要再次追蹤
  next_followup_date   DATE,
  next_followup_time   TEXT,
  created_schedule_id  UUID,            -- 若自動建立行事曆排程，記其 id
  recorded_by          TEXT,
  recorded_by_id       TEXT,
  recorded_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_schedule ON event_followups(schedule_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_followup_employee ON event_followups(employee_id, recorded_at DESC);

COMMENT ON TABLE event_followups IS '事件後續（多次追蹤，時間軸；歷史不覆蓋）';

NOTIFY pgrst, 'reload schema';
