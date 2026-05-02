-- AI 訊息輔助回覆系統

-- 公司規範資料庫
CREATE TABLE IF NOT EXISTS company_guidelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '一般',
  content TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LINE 回覆記錄（草稿 + 已送出）
CREATE TABLE IF NOT EXISTS line_reply_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_app_number TEXT,
  employee_name TEXT,
  thread_id TEXT,
  original_message TEXT,          -- 觸發回覆的員工訊息
  ai_suggestion TEXT,             -- AI 建議回覆內容
  final_reply TEXT NOT NULL,      -- 實際送出的內容
  sent_by TEXT,                   -- 送出的主管 identifier
  sent_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft / sent / failed / auto
  line_send_status TEXT,          -- success / failed / manual
  error_message TEXT,
  is_auto_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- 自動回覆設定
CREATE TABLE IF NOT EXISTS line_auto_reply_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  start_hour INT NOT NULL DEFAULT 18,   -- 18:00 開始
  end_hour INT NOT NULL DEFAULT 9,      -- 隔天 09:00 結束
  days_of_week INT[] DEFAULT '{0,6}',   -- 0=日, 1=月, ..., 6=六
  ai_persona TEXT DEFAULT 'claude',
  delay_seconds INT DEFAULT 30,         -- 延遲幾秒再回（避免太即時）
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- 預設自動回覆設定（只有一筆）
INSERT INTO line_auto_reply_settings (is_enabled) VALUES (FALSE)
  ON CONFLICT DO NOTHING;

-- 初始公司規範範例
INSERT INTO company_guidelines (title, category, content, sort_order) VALUES
  ('回覆語氣規範', '溝通禮儀', '回覆同仁訊息時應保持專業、溫和的語氣，避免使用命令式語句。遇到情緒性問題，優先同理後再說明。', 1),
  ('上班時間定義', '工作制度', '正常班別上班時間為 09:00-18:00，請假、加班依公司規定辦理。', 2),
  ('請假申請流程', '人事規定', '請假需透過系統申請並由直屬主管審核，事假需提前 1 日申請，病假應附醫療證明。', 3)
  ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE company_guidelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON company_guidelines FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE line_reply_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON line_reply_log FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE line_auto_reply_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON line_auto_reply_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lrl_employee ON line_reply_log(employee_app_number);
CREATE INDEX IF NOT EXISTS idx_lrl_created_at ON line_reply_log(created_at DESC);
