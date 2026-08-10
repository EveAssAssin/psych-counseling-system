# Database Migrations

用 Node-native migration runner 管理 Supabase 上的 schema 變更。所有 `NNN_xxx.sql` 檔案照檔名順序執行，每個檔案只跑一次（記錄在 `schema_migrations` 表）。

## 一次性設定（每台電腦第一次拉下來時）

### 1. 拿 Supabase Direct Connection String

Supabase Dashboard → 專案 → **Project Settings → Database → Connection string → URI**
選 **Transaction pooler** 那格，複製整段（含密碼）。

### 2. 寫進 `backend/.env`

```
SUPABASE_DB_URL=postgresql://postgres.xxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
```

⚠️ 這跟你原本的 `SUPABASE_URL`（REST API URL）**不一樣**，是 Postgres direct connection，可以直接跑任意 SQL。

### 3.（僅一次）初始化 baseline

現在 `database/` 已經有 20+ 個 .sql 檔案，且**已經手動在 Supabase 上跑過了**。第一次啟用 runner 時要先「告訴 runner 這些都跑過了」，避免它重跑導致 CREATE TABLE 衝突：

```
cd backend
npm install    # 裝 pg + dotenv
npm run db:migrate:baseline
```

看到 `🎉 完成，已註冊 N 個 migration 為已執行` 就 OK。

## 平常用法

### 新增一個 migration

```
# 建新檔（自己編號，接續現有）
touch database/027_my_change.sql

# 寫 SQL
cat > database/027_my_change.sql << 'SQL'
ALTER TABLE employees ADD COLUMN foo TEXT;
SQL

# 應用到 Supabase
cd backend
npm run db:migrate:up
```

### 看目前狀態

```
cd backend
npm run db:migrate:status
```

會列出：
- `database/` 資料夾中所有 .sql 檔案
- 哪些已跑過（✅）、哪些沒跑過（⏳）

### 應用未執行的 migration

```
cd backend
npm run db:migrate:up
```

- 依檔名字典序執行（`NNN_xxx.sql`）
- 每個檔案在獨立 transaction 內執行
- 失敗自動 rollback，中止後續執行

## 命名規則

- **必須** `NNN_描述.sql` 格式（3 位數字開頭 + 底線 + 描述）
- 編號**遞增不重複**，接續現有最大編號 +1
- 描述用簡短英文或中文皆可（例：`027_add_foo_column.sql`、`027_加訂單標籤欄位.sql`）

## 撞號怎麼辦（多人 / 多電腦同時開發）

若 A、B 兩人同時建了 `027_xxx.sql`，pull 下來時會 conflict：

- 把後 push 的那個改成下一個編號（例如 `028_yyy.sql`）
- 若對方那份已經跑過 Supabase 而你這份還沒，`db:migrate:up` 會處理正確順序

## 出錯時

### 某個 migration 你已經手動在 Supabase 貼上執行過了

`db:migrate:up` 執行到那個檔案會失敗（因為 CREATE TABLE 之類的重複）。手動把它標為已執行：

```sql
-- 在 Supabase SQL Editor 貼上執行
INSERT INTO schema_migrations (filename) VALUES ('027_my_change.sql');
```

然後重跑 `npm run db:migrate:up` 繼續下一個。

### migration 內容錯了要修

**已跑過的 migration 不能改內容**（會跟 DB 現況不一致）。要修就寫一個新的 migration 反轉／修正它。這是 migration 的鐵律。

## 未來擴充

若要在部署時自動 apply（例如 Render / Fly 上），加到啟動指令：

```
npm run db:migrate:up && npm run start:prod
```

若要 GitHub Actions 自動 apply，加到 `.github/workflows/*.yml`：

```yaml
- run: cd backend && npm ci && npm run db:migrate:up
  env:
    SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
```
