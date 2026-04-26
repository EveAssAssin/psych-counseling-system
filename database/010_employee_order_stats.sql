-- ============================================================
-- 010_employee_order_stats.sql
-- 員工訂單統計（月度業績趨勢）
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_order_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_app_number TEXT,
  erp_id              TEXT NOT NULL,   -- E0123 saleOpId = employees.employeeerpid
  period_year         INT NOT NULL,
  period_month        INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  label_name          TEXT NOT NULL DEFAULT '全部',  -- '全部' 或各訂單標籤
  order_count         INT NOT NULL DEFAULT 0,
  total_amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
  synced_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(erp_id, period_year, period_month, label_name)
);

CREATE INDEX IF NOT EXISTS idx_order_stats_employee
  ON employee_order_stats(employee_app_number);

CREATE INDEX IF NOT EXISTS idx_order_stats_erp_id
  ON employee_order_stats(erp_id);

CREATE INDEX IF NOT EXISTS idx_order_stats_period
  ON employee_order_stats(period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_order_stats_label
  ON employee_order_stats(label_name);
