-- ============================================
-- Migration 013：輔導案管理（counseling cases）
-- ============================================
-- 目的：
--   心理輔導員針對門市人員發生特定狀態時（想離職、爭執、負面、行為偏差、
--   服務狀態差等）開立「輔導案」，系統協助規劃時間軸、每日提醒、
--   執行紀錄、案件級 AI 討論。
--
-- 五張新表：
--   A. counseling_state_tags      — 員工狀態標籤字典（可後台維護）
--   B. counseling_holidays        — 假日表（排程扣除用，週末由程式判斷）
--   C. counseling_cases           — 輔導案主表
--   D. counseling_plan_items      — AI 生成的排程任務（時間軸節點）
--   E. counseling_executions      — 輔導員實作後的執行紀錄
--
-- 設計重點：
--   * counseling_cases.initial_insight_snapshot 凍結建案當下的 employee
--     insight，避免後續資料變動造成回溯困難。
--   * counseling_plan_items.original_scheduled_date 保留改期前的原日期，
--     供時間軸 UI 顯示「原排於 X / 已改至 Y」。
--   * counseling_executions.mood_score 1-5 量表，可餵回 insight 趨勢分析。
--   * Phase 4 會另在 supervisor_ai_sessions 加 case_id 欄（migration 014），
--     此處不動 supervisor-ai schema。
-- ============================================


-- ============================================================
-- A. 員工狀態標籤字典
-- ============================================================
CREATE TABLE IF NOT EXISTS counseling_state_tags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,                    -- 程式用 key，例如 'want_to_quit'
  label             TEXT NOT NULL,                           -- 顯示用，例如 '想離職'
  description       TEXT,                                    -- 該狀態的判斷說明
  ai_prompt_hint    TEXT,                                    -- 給排程 AI 的提示模板片段
  severity          TEXT DEFAULT 'moderate'                  -- low / moderate / high / critical
                    CHECK (severity IN ('low','moderate','high','critical')),
  default_duration_days INT DEFAULT 14,                      -- 此狀態建議的輔導期長度
  sort_order        INT DEFAULT 100,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_state_tags_active
  ON counseling_state_tags(is_active, sort_order)
  WHERE is_active = true;

COMMENT ON TABLE counseling_state_tags IS '員工狀態標籤字典（輔導案分類用，可後台維護）';
COMMENT ON COLUMN counseling_state_tags.ai_prompt_hint IS '此狀態給排程 AI 的特化提示，例如「想離職案應安排早期 1on1 探詢真實原因」';


-- ============================================================
-- B. 假日表（排程扣除用）
-- ============================================================
CREATE TABLE IF NOT EXISTS counseling_holidays (
  date              DATE PRIMARY KEY,
  name              TEXT NOT NULL,                           -- 例如 '元旦'、'公司尾牙休假'
  type              TEXT NOT NULL DEFAULT 'national'         -- national / company / makeup_workday
                    CHECK (type IN ('national','company','makeup_workday')),
  is_workday        BOOLEAN DEFAULT false,                   -- 補班日設 true，可覆蓋週末判斷
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_holidays_year
  ON counseling_holidays((EXTRACT(YEAR FROM date)));

COMMENT ON TABLE counseling_holidays IS '排程扣除用的假日 / 補班日表。週末由程式判斷，不入表。';


-- ============================================================
-- C. 輔導案主表
-- ============================================================
CREATE TABLE IF NOT EXISTS counseling_cases (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 對象
  employee_id                 UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  employee_app_number         TEXT NOT NULL,                 -- 冗餘存一份方便查詢/顯示
  employee_name               TEXT NOT NULL,

  -- 輔導員（建立者）
  supervisor_id               UUID NOT NULL REFERENCES authorized_supervisors(id) ON DELETE RESTRICT,
  supervisor_name             TEXT NOT NULL,

  -- 狀態 / 主訴
  state_tag_codes             TEXT[] NOT NULL DEFAULT '{}',  -- 多選，對 counseling_state_tags.code
  state_description           TEXT,                          -- 自由文字補充

  -- 輔導設定
  goal                        TEXT NOT NULL,                 -- 輔導目標
  start_date                  DATE NOT NULL,
  target_end_date             DATE NOT NULL,
  allowed_methods             TEXT[] NOT NULL DEFAULT '{}',  -- 例如 ['phone','face_to_face','line_text','observation']

  -- 狀態機
  status                      TEXT NOT NULL DEFAULT 'planning'
                              CHECK (status IN ('planning','active','paused','completed','archived')),
  closed_at                   TIMESTAMPTZ,
  closing_summary             TEXT,                          -- 結案時填

  -- AI 規劃產出
  initial_insight_snapshot    JSONB,                         -- 建案當下從 EmployeeInsightService 拉的快照
  ai_plan_summary             TEXT,                          -- AI 生成的整體計畫文字摘要
  ai_plan_meta                JSONB,                         -- AI 規劃的 meta（model、token usage、生成時間…）

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_target_end_date CHECK (target_end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_counseling_cases_employee
  ON counseling_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_counseling_cases_supervisor
  ON counseling_cases(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_counseling_cases_status
  ON counseling_cases(status, start_date);
CREATE INDEX IF NOT EXISTS idx_counseling_cases_active_window
  ON counseling_cases(status, start_date, target_end_date)
  WHERE status IN ('planning','active');

COMMENT ON TABLE counseling_cases IS '輔導案主表';
COMMENT ON COLUMN counseling_cases.initial_insight_snapshot IS '建案當下的 employee insight 快照，避免後續資料變動造成回溯困難';


-- ============================================================
-- D. 排程任務（AI 生成的時間軸節點）
-- ============================================================
CREATE TABLE IF NOT EXISTS counseling_plan_items (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                     UUID NOT NULL REFERENCES counseling_cases(id) ON DELETE CASCADE,

  -- 時間（工作日，已扣假日）
  scheduled_date              DATE NOT NULL,
  original_scheduled_date     DATE,                          -- 若有改期，留原排
  sequence                    INT NOT NULL,                  -- 在此案內第幾步

  -- 內容
  method                      TEXT NOT NULL,                 -- 必須屬於該案 allowed_methods
  objective                   TEXT NOT NULL,                 -- 這步要達成什麼（AI 生成）
  recommended_actions         JSONB,                         -- AI 建議的具體做法、開場白、注意事項
  estimated_minutes           INT DEFAULT 30,

  -- 狀態
  status                      TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','done','skipped','rescheduled')),
  reschedule_reason           TEXT,

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_plan_items_case_seq
  ON counseling_plan_items(case_id, sequence);
CREATE INDEX IF NOT EXISTS idx_counseling_plan_items_today
  ON counseling_plan_items(scheduled_date, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_counseling_plan_items_case_status
  ON counseling_plan_items(case_id, status);

COMMENT ON TABLE counseling_plan_items IS 'AI 生成的輔導排程節點（時間軸上的點）';


-- ============================================================
-- E. 執行紀錄
-- ============================================================
CREATE TABLE IF NOT EXISTS counseling_executions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_item_id                UUID REFERENCES counseling_plan_items(id) ON DELETE SET NULL,
  case_id                     UUID NOT NULL REFERENCES counseling_cases(id) ON DELETE CASCADE,

  executed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actual_method               TEXT NOT NULL,
  duration_minutes            INT,

  what_happened               TEXT NOT NULL,                 -- 經過描述
  employee_reaction           TEXT,                          -- 員工反應
  next_action_hint            TEXT,                          -- 輔導員自己的下一步想法

  mood_score                  INT CHECK (mood_score BETWEEN 1 AND 5),  -- 員工當下情緒 1-5

  attachments                 JSONB DEFAULT '[]'::jsonb,     -- [{type, url, name}]，連 upload 模組
  recorded_by                 UUID REFERENCES authorized_supervisors(id) ON DELETE SET NULL,
  recorded_by_name            TEXT,

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counseling_executions_case
  ON counseling_executions(case_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_counseling_executions_plan_item
  ON counseling_executions(plan_item_id)
  WHERE plan_item_id IS NOT NULL;

COMMENT ON TABLE counseling_executions IS '輔導員實作後填寫的執行紀錄';


-- ============================================================
-- updated_at trigger（沿用既有 schema 風格）
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    -- 既有 helper function 存在就直接用
    DROP TRIGGER IF EXISTS trg_counseling_cases_updated_at ON counseling_cases;
    CREATE TRIGGER trg_counseling_cases_updated_at
      BEFORE UPDATE ON counseling_cases
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_counseling_plan_items_updated_at ON counseling_plan_items;
    CREATE TRIGGER trg_counseling_plan_items_updated_at
      BEFORE UPDATE ON counseling_plan_items
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_counseling_executions_updated_at ON counseling_executions;
    CREATE TRIGGER trg_counseling_executions_updated_at
      BEFORE UPDATE ON counseling_executions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_counseling_state_tags_updated_at ON counseling_state_tags;
    CREATE TRIGGER trg_counseling_state_tags_updated_at
      BEFORE UPDATE ON counseling_state_tags
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


-- ============================================================
-- Helper view：今日任務（給 dashboard 用）
-- ============================================================
DROP VIEW IF EXISTS v_counseling_today;
CREATE VIEW v_counseling_today AS
SELECT
  pi.id                AS plan_item_id,
  pi.case_id,
  pi.scheduled_date,
  pi.sequence,
  pi.method,
  pi.objective,
  pi.recommended_actions,
  pi.estimated_minutes,
  pi.status            AS plan_item_status,
  c.employee_id,
  c.employee_app_number,
  c.employee_name,
  c.supervisor_id,
  c.supervisor_name,
  c.goal               AS case_goal,
  c.state_tag_codes,
  c.status             AS case_status,
  c.start_date         AS case_start_date,
  c.target_end_date    AS case_target_end_date
FROM counseling_plan_items pi
JOIN counseling_cases c ON c.id = pi.case_id
WHERE pi.status = 'pending'
  AND c.status IN ('active','planning');

COMMENT ON VIEW v_counseling_today IS '今日輔導任務（前端 dashboard 用，依 supervisor_id + scheduled_date 篩選）';


-- ============================================================
-- Seed：狀態標籤
-- ============================================================
INSERT INTO counseling_state_tags (code, label, description, ai_prompt_hint, severity, default_duration_days, sort_order)
VALUES
  ('want_to_quit',     '想離職',
   '員工表達或暗示離職意願、抱怨工作環境、頻繁請假找工作等',
   '此案重點在「探詢真實原因」與「降低焦慮」，避免直接挽留施壓。前期應安排 1on1 面談探查動機（個人 / 主管 / 薪酬 / 發展），中期評估留任條件，後期決定挽留方案或好聚好散。',
   'high', 14, 10),

  ('conflict',         '人際爭執',
   '與同事、主管、客戶發生爭執或對立',
   '此案應快速降溫並分階段處理：先個別釐清雙方視角、不評斷，再評估是否需要三方對談。注意保密與避免標籤化。',
   'moderate', 10, 20),

  ('negative',         '負面情緒',
   '長期情緒低落、抱怨、缺乏動力',
   '此案優先建立信任、提供情緒出口，避免立即解決問題的衝動。安排穩定頻率的傾聽會談，觀察是否有外部生活壓力或心理健康徵兆，必要時轉介專業資源。',
   'moderate', 21, 30),

  ('behavior_deviation','行為偏差',
   '出現遲到早退、不配合 SOP、誠信問題等行為',
   '此案需區分「能力 vs 意願」問題。前期事實核對與澄清預期、中期設定具體可衡量的行為目標、後期觀察是否改善。應有書面紀錄作為人評會佐證。',
   'high', 21, 40),

  ('service_quality',  '服務狀態差',
   '客訴增加、評分下降、銷售態度問題',
   '此案重點在能力或心態判斷。可從 reviews / customer feedback 切入具體案例討論，安排技能補強或心態調整，避免泛談「態度問題」。',
   'moderate', 14, 50),

  ('burnout',          '工作倦怠',
   '長期高負荷後出現疲憊、麻木、效率下降',
   '此案需先確認工作量是否客觀過載，再處理心理層面。可建議短期休假或工作內容調整。注意不要在倦怠期增加新任務。',
   'high', 21, 60),

  ('other',            '其他',
   '無法歸類於上述類型',
   '此案應在草稿後由輔導員補充具體狀態，AI 規劃較通則化，僅提供基礎面談頻率與紀錄建議。',
   'low', 14, 999)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- Seed：2026 台灣國定假日（如需 2027 後續手動補）
-- ============================================================
INSERT INTO counseling_holidays (date, name, type) VALUES
  ('2026-01-01', '元旦',         'national'),
  ('2026-02-16', '春節除夕',     'national'),
  ('2026-02-17', '春節初一',     'national'),
  ('2026-02-18', '春節初二',     'national'),
  ('2026-02-19', '春節初三',     'national'),
  ('2026-02-20', '春節初四',     'national'),
  ('2026-02-27', '和平紀念日彈性放假','national'),
  ('2026-02-28', '和平紀念日',   'national'),
  ('2026-04-03', '兒童節 / 民族掃墓節彈性放假','national'),
  ('2026-04-04', '兒童節',       'national'),
  ('2026-04-05', '民族掃墓節',   'national'),
  ('2026-04-06', '民族掃墓節補假','national'),
  ('2026-05-01', '勞動節',       'national'),
  ('2026-06-19', '端午節',       'national'),
  ('2026-09-25', '中秋節',       'national'),
  ('2026-10-09', '國慶日彈性放假','national'),
  ('2026-10-10', '國慶日',       'national')
ON CONFLICT (date) DO NOTHING;
