-- ============================================
-- 心理輔導系統 - 完整資料庫 Schema
-- Version: 2.0
-- Database: Supabase (PostgreSQL)
-- ============================================

-- 啟用必要擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. 門市表 (stores)
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_code VARCHAR(50) UNIQUE,
    store_erp_id VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    region VARCHAR(100),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    source_payload JSONB,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_code ON stores(store_code);
CREATE INDEX idx_stores_erp_id ON stores(store_erp_id);
CREATE INDEX idx_stores_active ON stores(is_active);

COMMENT ON TABLE stores IS '門市主檔';
COMMENT ON COLUMN stores.store_code IS '門市代碼';
COMMENT ON COLUMN stores.store_erp_id IS 'ERP 門市編號';
COMMENT ON COLUMN stores.source_payload IS '原始同步資料';

-- ============================================
-- 2. 員工主檔表 (employees)
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employeeappnumber VARCHAR(100) UNIQUE NOT NULL,
    employeeerpid VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    role VARCHAR(100),
    title VARCHAR(200),
    store_id UUID REFERENCES stores(id),
    store_name VARCHAR(200),
    department VARCHAR(200),
    email VARCHAR(255),
    phone VARCHAR(50),
    hire_date DATE,
    is_active BOOLEAN DEFAULT true,
    is_leave BOOLEAN DEFAULT false,
    leave_type VARCHAR(50),
    leave_start_date DATE,
    leave_end_date DATE,
    source_payload JSONB,
    source_updated_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_employees_appnumber ON employees(employeeappnumber);
CREATE INDEX idx_employees_erpid ON employees(employeeerpid);
CREATE INDEX idx_employees_store ON employees(store_id);
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_employees_name ON employees(name);

COMMENT ON TABLE employees IS '正式員工主檔 - 以 employeeappnumber 為主鍵';
COMMENT ON COLUMN employees.employeeappnumber IS '主要對人鍵 (APP員工編號)';
COMMENT ON COLUMN employees.employeeerpid IS '輔助對人鍵 (ERP員工編號)';

-- ============================================
-- 3. 系統使用者表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(200),
    avatar_url TEXT,
    google_id VARCHAR(255) UNIQUE,
    employee_id UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);

COMMENT ON TABLE users IS '系統登入使用者';

-- ============================================
-- 4. 角色與權限表 (user_roles)
-- ============================================
CREATE TYPE user_role_enum AS ENUM ('admin', 'hr_manager', 'supervisor', 'counselor', 'reviewer', 'agent');

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role_enum NOT NULL,
    scope_type VARCHAR(50), -- 'all', 'store', 'department', 'employee_list'
    scope_value JSONB, -- store_ids, department_names, employee_ids
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role, scope_type)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

COMMENT ON TABLE user_roles IS '使用者角色與權限範圍';

-- ============================================
-- 5. 對話 Intake 表 (conversation_intakes)
-- ============================================
CREATE TYPE intake_source_enum AS ENUM ('manual_text', 'pdf', 'docx', 'image_ocr', 'external_sync', 'official_channel');
CREATE TYPE intake_status_enum AS ENUM ('pending', 'extracting', 'extracted', 'analyzing', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS conversation_intakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    source_type intake_source_enum NOT NULL DEFAULT 'manual_text',
    conversation_date TIMESTAMPTZ,
    conversation_type VARCHAR(100), -- '一對一面談', '電話訪談', '訊息對話' 等
    interviewer_name VARCHAR(200),
    background_note TEXT,
    raw_text TEXT,
    extracted_text TEXT,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    need_followup BOOLEAN DEFAULT false,
    tags JSONB DEFAULT '[]'::jsonb,
    intake_status intake_status_enum DEFAULT 'pending',
    extraction_status VARCHAR(50),
    extraction_error TEXT,
    analysis_status VARCHAR(50),
    analysis_error TEXT,
    uploaded_by UUID REFERENCES users(id),
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intakes_employee ON conversation_intakes(employee_id);
CREATE INDEX idx_intakes_status ON conversation_intakes(intake_status);
CREATE INDEX idx_intakes_date ON conversation_intakes(conversation_date DESC);
CREATE INDEX idx_intakes_uploaded_by ON conversation_intakes(uploaded_by);
CREATE INDEX idx_intakes_priority ON conversation_intakes(priority);

COMMENT ON TABLE conversation_intakes IS '對話/訪談輸入記錄';

-- ============================================
-- 6. 對話附件表 (conversation_attachments)
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_intake_id UUID NOT NULL REFERENCES conversation_intakes(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    extracted_text TEXT,
    extraction_status VARCHAR(50) DEFAULT 'pending',
    extraction_error TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_intake ON conversation_attachments(conversation_intake_id);

COMMENT ON TABLE conversation_attachments IS '對話附件檔案';

-- ============================================
-- 7. 分析結果表 (analysis_results)
-- ============================================
CREATE TYPE stress_level_enum AS ENUM ('low', 'moderate', 'high', 'critical');
CREATE TYPE risk_level_enum AS ENUM ('low', 'moderate', 'high', 'critical');

CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_intake_id UUID NOT NULL REFERENCES conversation_intakes(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    
    -- 核心分析結果
    current_psychological_state TEXT,
    stress_level stress_level_enum,
    risk_level risk_level_enum,
    summary TEXT,
    
    -- JSON 結構化資料
    key_topics JSONB DEFAULT '[]'::jsonb,
    observations JSONB DEFAULT '[]'::jsonb,
    suggested_actions JSONB DEFAULT '[]'::jsonb,
    taboo_topics JSONB DEFAULT '[]'::jsonb,
    interviewer_question_suggestions JSONB DEFAULT '[]'::jsonb,
    
    -- 後續追蹤
    followup_needed BOOLEAN DEFAULT false,
    followup_suggested_at TIMESTAMPTZ,
    supervisor_involvement VARCHAR(100),
    next_talk_focus TEXT,
    
    -- 分析元資料
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    analysis_prompt_version VARCHAR(50),
    raw_response JSONB,
    confidence_score DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_intake ON analysis_results(conversation_intake_id);
CREATE INDEX idx_analysis_employee ON analysis_results(employee_id);
CREATE INDEX idx_analysis_risk ON analysis_results(risk_level);
CREATE INDEX idx_analysis_stress ON analysis_results(stress_level);
CREATE INDEX idx_analysis_created ON analysis_results(created_at DESC);

COMMENT ON TABLE analysis_results IS 'AI 分析結果';

-- ============================================
-- 8. 風險標記表 (risk_flags)
-- ============================================
CREATE TYPE risk_flag_status_enum AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved', 'false_positive');

CREATE TABLE IF NOT EXISTS risk_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_result_id UUID REFERENCES analysis_results(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    
    risk_type VARCHAR(100) NOT NULL, -- 'self_harm', 'resignation', 'conflict', 'burnout', 'breakdown'
    severity risk_level_enum NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    evidence_text TEXT,
    
    status risk_flag_status_enum DEFAULT 'open',
    assigned_to UUID REFERENCES users(id),
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_risk_flags_employee ON risk_flags(employee_id);
CREATE INDEX idx_risk_flags_status ON risk_flags(status);
CREATE INDEX idx_risk_flags_severity ON risk_flags(severity);
CREATE INDEX idx_risk_flags_type ON risk_flags(risk_type);
CREATE INDEX idx_risk_flags_created ON risk_flags(created_at DESC);

COMMENT ON TABLE risk_flags IS '高風險標記與追蹤';

-- ============================================
-- 9. 外部每日資料 Intake (external_daily_intakes)
-- ============================================
CREATE TYPE external_process_status_enum AS ENUM ('pending', 'processing', 'matched', 'unmatched', 'failed');

CREATE TABLE IF NOT EXISTS external_daily_intakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_name VARCHAR(100) NOT NULL, -- 'attendance', 'score', 'review', 'official_channel'
    source_record_id VARCHAR(255),
    
    -- 對人識別
    employeeappnumber VARCHAR(100),
    employeeerpid VARCHAR(100),
    matched_employee_id UUID REFERENCES employees(id),
    
    -- 原始資料
    payload JSONB NOT NULL,
    record_date DATE,
    
    -- 處理狀態
    process_status external_process_status_enum DEFAULT 'pending',
    process_error TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_external_source ON external_daily_intakes(source_name);
CREATE INDEX idx_external_employee ON external_daily_intakes(matched_employee_id);
CREATE INDEX idx_external_status ON external_daily_intakes(process_status);
CREATE INDEX idx_external_date ON external_daily_intakes(record_date);
CREATE INDEX idx_external_appnumber ON external_daily_intakes(employeeappnumber);

COMMENT ON TABLE external_daily_intakes IS '每日外部資料來源匯入';

-- ============================================
-- 10. 同步日誌表 (sync_logs)
-- ============================================
CREATE TYPE sync_status_enum AS ENUM ('started', 'running', 'completed', 'failed', 'partial');

CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type VARCHAR(50) NOT NULL, -- 'employee_full', 'employee_delta', 'external_daily', 'store'
    source_name VARCHAR(100),
    
    status sync_status_enum DEFAULT 'started',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    
    total_fetched INTEGER DEFAULT 0,
    total_created INTEGER DEFAULT 0,
    total_updated INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    
    error_message TEXT,
    error_details JSONB,
    
    triggered_by UUID REFERENCES users(id),
    trigger_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled', 'api'
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at DESC);

COMMENT ON TABLE sync_logs IS '資料同步日誌';

-- ============================================
-- 11. 員工目前狀態快照 (employee_current_status)
-- ============================================
CREATE TABLE IF NOT EXISTS employee_current_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID UNIQUE NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    
    -- 最新狀態
    latest_analysis_id UUID REFERENCES analysis_results(id),
    latest_intake_id UUID REFERENCES conversation_intakes(id),
    latest_analysis_at TIMESTAMPTZ,
    
    -- 彙總狀態
    current_psychological_state TEXT,
    current_stress_level stress_level_enum,
    current_risk_level risk_level_enum,
    
    -- 統計
    total_conversations INTEGER DEFAULT 0,
    total_high_risk_flags INTEGER DEFAULT 0,
    open_risk_flags INTEGER DEFAULT 0,
    
    -- 追蹤
    needs_followup BOOLEAN DEFAULT false,
    next_suggested_contact TIMESTAMPTZ,
    last_contacted_at TIMESTAMPTZ,
    
    -- 趨勢
    risk_trend VARCHAR(20), -- 'improving', 'stable', 'worsening'
    stress_trend VARCHAR(20),
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_current_status_employee ON employee_current_status(employee_id);
CREATE INDEX idx_current_status_risk ON employee_current_status(current_risk_level);
CREATE INDEX idx_current_status_followup ON employee_current_status(needs_followup);

COMMENT ON TABLE employee_current_status IS '員工目前狀態快照（供快速查詢）';

-- ============================================
-- 12. 查詢稽核日誌 (audit_logs)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    employee_id UUID REFERENCES employees(id),
    
    request_payload JSONB,
    response_summary TEXT,
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS '查詢與操作稽核紀錄';

-- ============================================
-- 13. 排程任務表 (scheduled_tasks)
-- ============================================
CREATE TYPE task_status_enum AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type VARCHAR(100) NOT NULL,
    task_name VARCHAR(200),
    cron_expression VARCHAR(100),
    
    status task_status_enum DEFAULT 'pending',
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    last_run_status task_status_enum,
    last_run_error TEXT,
    last_run_duration_ms INTEGER,
    
    is_enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_type ON scheduled_tasks(task_type);
CREATE INDEX idx_tasks_next_run ON scheduled_tasks(next_run_at);
CREATE INDEX idx_tasks_enabled ON scheduled_tasks(is_enabled);

COMMENT ON TABLE scheduled_tasks IS '排程任務設定與狀態';

-- ============================================
-- 14. 系統設定表 (system_settings)
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(200) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_settings_key ON system_settings(key);

COMMENT ON TABLE system_settings IS '系統設定';

-- ============================================
-- 更新時間觸發器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 套用到所有需要的表
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_intakes_updated_at BEFORE UPDATE ON conversation_intakes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_analysis_updated_at BEFORE UPDATE ON analysis_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_risk_flags_updated_at BEFORE UPDATE ON risk_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_current_status_updated_at BEFORE UPDATE ON employee_current_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON scheduled_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 初始排程任務
-- ============================================
INSERT INTO scheduled_tasks (task_type, task_name, cron_expression, next_run_at, config) VALUES
('employee_sync', '每月正式員工同步', '0 4 5 * *', NOW() + INTERVAL '1 month', '{"sync_type": "full"}'::jsonb),
('external_daily_sync', '每日多來源資料整合', '0 5 * * *', NOW() + INTERVAL '1 day', '{"sources": ["attendance", "score", "review", "official_channel"]}'::jsonb),
('status_snapshot_update', '員工狀態快照更新', '0 6 * * *', NOW() + INTERVAL '1 day', '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================
-- RLS 政策（Row Level Security）
-- ============================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 預設政策：需要登入才能存取
CREATE POLICY "Authenticated users can view employees" ON employees
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view intakes" ON conversation_intakes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view analysis" ON analysis_results
    FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- 完成
-- ============================================
