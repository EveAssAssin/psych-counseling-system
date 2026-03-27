-- 人員資料一致性規則 - 資料庫欄位更新
-- 執行於 Supabase SQL Editor

-- 新增 employees 表的欄位
ALTER TABLE employees ADD COLUMN IF NOT EXISTS person_type VARCHAR(20) DEFAULT 'store';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_store_staff BOOLEAN DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_displayed_on_website BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS groupname VARCHAR(200);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS grouperpid VARCHAR(100);

-- 加入 person_type 的 CHECK 約束
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_person_type_check'
  ) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_person_type_check 
    CHECK (person_type IN ('store', 'nonstore', 'special', 'excluded'));
  END IF;
END $$;

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_employees_person_type ON employees(person_type);
CREATE INDEX IF NOT EXISTS idx_employees_is_store_staff ON employees(is_store_staff);
CREATE INDEX IF NOT EXISTS idx_employees_is_active_person_type ON employees(is_active, person_type);

-- 更新 employees 表的註解
COMMENT ON COLUMN employees.person_type IS '人員類型: store=門市人員, nonstore=非門市人員, special=特殊帳號, excluded=排除';
COMMENT ON COLUMN employees.is_store_staff IS '是否為門市人員';
COMMENT ON COLUMN employees.is_displayed_on_website IS '是否在官網展示';
COMMENT ON COLUMN employees.groupname IS '群組/門市名稱';
COMMENT ON COLUMN employees.grouperpid IS '群組/門市 ERP ID';
