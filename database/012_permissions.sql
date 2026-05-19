-- ============================================
-- Migration 012：權限管理（統一入口 app_number-based 登入）
-- ============================================
-- 設計：
--   1. 心理輔導系統由樂活統一入口透過 URL 帶 ?app_number=... 跳轉進來
--   2. 系統用 app_number 對應到 employees → users → user_roles 判斷權限
--   3. 兩種角色：'admin'（超級管理者，可改權限） / 'counselor'（輔導人員，一般使用）
--      （都是既有的 user_role_enum，不需改 schema）
--
-- 此 migration 主要做的事：
--   A. users.email 改為 nullable（app_number-based 的 user 可能沒有真實 email）
--      若已有 unique 約束，保留但允許 NULL
--   B. 加 users.employee_id 索引（之前只有 FK，沒索引），加速 app_number 登入查詢
--   C. 加 user_roles.is_active 與 role 的複合索引
--   D. 加 helper view：v_active_permissions（列出所有有效權限的人員）
-- ============================================

-- A. users.email 允許 NULL（向後相容：既有 user 都有 email，沒影響）
DO $$
BEGIN
  -- 移除 NOT NULL 約束（若存在）
  ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  -- 已經 nullable 或表不存在，無視
  NULL;
END $$;

-- B. employee_id 索引（FK 不會自動建索引，加速 join）
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id) WHERE employee_id IS NOT NULL;

-- C. user_roles 複合索引（加速「該 user 有沒有有效 role」查詢）
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON user_roles(user_id, is_active) WHERE is_active = true;

-- D. 有效權限視圖（給 admin 看「目前誰有權限」的彙整）
DROP VIEW IF EXISTS v_active_permissions;
CREATE VIEW v_active_permissions AS
SELECT
  ur.id                      AS user_role_id,
  u.id                       AS user_id,
  u.email,
  u.name                     AS user_name,
  u.is_active                AS user_is_active,
  u.last_login_at,
  e.id                       AS employee_id,
  e.employeeappnumber        AS app_number,
  e.employeeerpid            AS erp_id,
  e.name                     AS employee_name,
  e.department,
  e.store_name,
  e.title,
  e.is_active                AS employee_is_active,
  ur.role,
  ur.scope_type,
  ur.scope_value,
  ur.granted_by,
  ur.is_active               AS role_is_active,
  ur.created_at              AS granted_at,
  ur.expires_at
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
LEFT JOIN employees e ON e.id = u.employee_id
WHERE ur.role IN ('admin', 'counselor')   -- 心理輔導系統實際使用的兩種 role
ORDER BY ur.created_at DESC;

COMMENT ON VIEW v_active_permissions IS
  '心理輔導系統權限總覽：列出所有 admin（超級管理者）與 counselor（輔導人員），含對應員工資料';


-- ============================================
-- 雞生蛋解法：第一個 super_admin 的指派 SQL
-- ============================================
-- 替換 'A1234' 為第一個超級管理者的員工編號（employeeappnumber）後執行
--
-- 注意：執行前請先確認該員工已在 employees 表（透過 sync 同步進來）
-- ============================================
--
-- DO $$
-- DECLARE
--   v_employee_id UUID;
--   v_user_id UUID;
-- BEGIN
--   -- 1. 找到員工
--   SELECT id INTO v_employee_id FROM employees WHERE employeeappnumber = 'A1234';
--   IF v_employee_id IS NULL THEN
--     RAISE EXCEPTION '找不到員工編號 A1234，請先同步員工資料';
--   END IF;
--
--   -- 2. 建立或重用 user（用 dummy email，等本人首次 Google 登入時可改成真實 email）
--   INSERT INTO users (email, name, employee_id, is_active)
--   SELECT 'A1234@psych.internal', name, id, true
--     FROM employees WHERE id = v_employee_id
--   ON CONFLICT (email) DO UPDATE SET is_active = EXCLUDED.is_active
--   RETURNING id INTO v_user_id;
--
--   IF v_user_id IS NULL THEN
--     SELECT id INTO v_user_id FROM users WHERE employee_id = v_employee_id LIMIT 1;
--   END IF;
--
--   -- 3. 指派 admin role
--   INSERT INTO user_roles (user_id, role, scope_type, granted_by, is_active)
--   VALUES (v_user_id, 'admin', 'all', v_user_id, true)
--   ON CONFLICT (user_id, role, scope_type) DO UPDATE SET is_active = true;
--
--   RAISE NOTICE '✓ 已將員工 A1234 設為超級管理者，user_id=%', v_user_id;
-- END $$;
