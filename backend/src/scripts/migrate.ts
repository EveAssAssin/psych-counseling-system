/**
 * Migration runner
 *
 * 用法：
 *   npm run db:migrate:up       — 執行所有未執行過的 database/*.sql
 *   npm run db:migrate:status   — 列出已執行 vs 未執行清單
 *   npm run db:migrate:baseline — 一次性：把 database/ 所有 sql 標為已執行（不真的跑）
 *                                 適用於：現有 schema 已存在，第一次啟用 runner 時
 *
 * 環境變數（backend/.env）：
 *   SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 *   注意這是「Direct connection string」，不是 REST API URL。
 *   Supabase Dashboard → Project Settings → Database → Connection string → URI → 選 "Transaction pooler" 複製過來
 *
 * 追蹤機制：
 *   在 Supabase 建 schema_migrations 表記錄哪些 sql 檔案跑過
 *   跑 up 時只執行沒被記錄的檔案，依檔名字典序排序（NNN_xxx.sql）
 *   每個檔案在獨立 transaction 內執行，失敗自動 rollback
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 載入 backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database');
const SCHEMA_TABLE = 'schema_migrations';

type Mode = 'up' | 'status' | 'baseline';

async function main() {
  const arg = process.argv[2];
  const mode: Mode =
    arg === 'status' ? 'status' : arg === 'baseline' ? 'baseline' : 'up';

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error(
      '❌ 缺少 SUPABASE_DB_URL 環境變數\n\n' +
        '   請到 Supabase Dashboard → Project Settings → Database →\n' +
        '   Connection string → URI（Transaction pooler）複製到 backend/.env：\n\n' +
        '   SUPABASE_DB_URL=postgresql://postgres.xxx:PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres\n',
    );
    process.exit(1);
  }

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ 找不到 migration 資料夾: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. 確保 schema_migrations 表存在
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${SCHEMA_TABLE} (
        filename TEXT PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        applied_by TEXT DEFAULT current_user
      );
    `);

    // 2. 撈已執行清單
    const { rows: executedRows } = await client.query(
      `SELECT filename FROM ${SCHEMA_TABLE} ORDER BY filename`,
    );
    const executedSet = new Set<string>(executedRows.map((r: any) => r.filename));

    // 3. 讀 database/*.sql 依檔名排序
    const allFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = allFiles.filter((f) => !executedSet.has(f));

    // === Mode: status ===
    if (mode === 'status') {
      console.log(`📁 資料夾：${MIGRATIONS_DIR}`);
      console.log(`📊 統計：${allFiles.length} 個 .sql 檔 / ${executedSet.size} 個已執行 / ${pending.length} 個待執行\n`);

      console.log(`✅ 已執行（${executedSet.size}）:`);
      for (const f of allFiles.filter((f) => executedSet.has(f))) {
        console.log(`   ${f}`);
      }
      console.log(`\n⏳ 待執行（${pending.length}）:`);
      for (const f of pending) {
        console.log(`   ${f}`);
      }
      return;
    }

    // === Mode: baseline ===
    if (mode === 'baseline') {
      if (executedSet.size > 0) {
        console.log(
          `⚠️  schema_migrations 已有 ${executedSet.size} 筆紀錄，baseline 只補標未記錄的部份。`,
        );
      }
      const toRegister = allFiles.filter((f) => !executedSet.has(f));
      if (toRegister.length === 0) {
        console.log('✅ 所有 migration 都已註冊，無需 baseline');
        return;
      }
      console.log(`📋 將把 ${toRegister.length} 個檔案標為「已執行」（不會真的跑 SQL）:`);
      toRegister.forEach((f) => console.log(`   ${f}`));

      // 批次 insert
      const values = toRegister.map((_, i) => `($${i + 1}, NOW(), 'baseline')`).join(', ');
      await client.query(
        `INSERT INTO ${SCHEMA_TABLE} (filename, executed_at, applied_by) VALUES ${values}`,
        toRegister,
      );
      console.log(`\n🎉 完成，已註冊 ${toRegister.length} 個 migration 為已執行`);
      return;
    }

    // === Mode: up ===
    if (pending.length === 0) {
      console.log('✅ 沒有未執行的 migration');
      return;
    }

    console.log(`📋 找到 ${pending.length} 個待執行 migration:`);
    pending.forEach((f) => console.log(`   - ${f}`));
    console.log('');

    for (const filename of pending) {
      console.log(`▶️  執行 ${filename} ...`);
      const sqlPath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(sqlPath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${SCHEMA_TABLE} (filename) VALUES ($1)`,
          [filename],
        );
        await client.query('COMMIT');
        console.log(`   ✓ 完成\n`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`   ❌ 失敗（已 rollback）: ${err.message}`);
        console.error(`\n   若這個檔案已在 DB 中手動跑過，可用：`);
        console.error(`     echo "INSERT INTO ${SCHEMA_TABLE} (filename) VALUES ('${filename}');" | psql \\$SUPABASE_DB_URL`);
        console.error(`   直接把它標為已執行，然後重跑 db:migrate:up 繼續下一個。\n`);
        throw err;
      }
    }

    console.log(`🎉 完成，執行了 ${pending.length} 個 migration`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n❌ Migration 錯誤:', err.message);
  process.exit(1);
});
