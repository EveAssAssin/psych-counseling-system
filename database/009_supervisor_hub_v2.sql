-- ============================================================
-- 009_supervisor_hub_v2.sql
-- 擴充主管隨手記模組：附件、個人分類、分類排序、密碼登入
-- ============================================================

-- 1. supervisor_notes 加上 attachments 欄位
ALTER TABLE supervisor_notes
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- 2. note_categories 加上 supervisor_id（個人分類）
ALTER TABLE note_categories
  ADD COLUMN IF NOT EXISTS supervisor_id TEXT;

-- 個人分類索引
CREATE INDEX IF NOT EXISTS idx_note_categories_supervisor
  ON note_categories(supervisor_id);

-- 3. authorized_supervisors 加上密碼 hash + 分類排序
ALTER TABLE authorized_supervisors
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE authorized_supervisors
  ADD COLUMN IF NOT EXISTS category_order TEXT[] DEFAULT '{}';
