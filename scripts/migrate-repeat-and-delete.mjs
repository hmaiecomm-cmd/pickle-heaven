/**
 * 2026-09-23：為「球敘重複設定」與「刪除球敘」補上兩個欄位。
 *   SessionTemplate.weekdays  TEXT NOT NULL DEFAULT ''
 *   Session.deletedAt         DATETIME
 *
 * 用法：
 *   node scripts/migrate-repeat-and-delete.mjs                 → 套用到 .env 的 TURSO_DATABASE_URL（開發）
 *   MIGRATE_TARGET=production node scripts/migrate-repeat-and-delete.mjs
 *     → 套用到正式庫，需另外提供 PRODUCTION_DATABASE_URL 與 PRODUCTION_AUTH_TOKEN
 *
 * 只做 ADD COLUMN，不刪資料；重複執行時已存在的欄位會跳過。
 * 不能用 db:turso:init——它是「從空白建立」，對已有資料表的資料庫會失敗。
 */
import 'dotenv/config'
import { createClient } from '@libsql/client'

const production = process.env.MIGRATE_TARGET === 'production'
const url = production ? process.env.PRODUCTION_DATABASE_URL : process.env.TURSO_DATABASE_URL
const authToken = production ? process.env.PRODUCTION_AUTH_TOKEN : process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error(`❌ .env 缺少 ${production ? 'PRODUCTION_DATABASE_URL' : 'TURSO_DATABASE_URL'}`)
  process.exit(1)
}

const COLUMNS = [
  { table: 'SessionTemplate', column: 'weekdays', ddl: "TEXT NOT NULL DEFAULT ''" },
  { table: 'Session', column: 'deletedAt', ddl: 'DATETIME' },
]

const client = createClient({ url, authToken })
console.log(`→ 目標：${production ? '正式庫' : '開發庫'}（${url}）`)

try {
  for (const { table, column, ddl } of COLUMNS) {
    const { rows } = await client.execute(`PRAGMA table_info("${table}")`)
    if (rows.some((r) => r.name === column)) {
      console.log(`   ${table}.${column} 已存在，略過`)
      continue
    }
    await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${ddl}`)
    console.log(`   ✅ 已新增 ${table}.${column}`)
  }
} catch (err) {
  console.error('❌ 套用失敗：', err.message)
  process.exit(1)
}
