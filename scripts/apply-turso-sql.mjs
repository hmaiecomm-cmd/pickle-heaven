/**
 * 把 prisma/turso-init.sql 套用到 Turso 資料庫。
 * 用法：npm run db:turso:init
 *
 * 注意：Prisma 6.x 的 `db push` 不會走 driver adapter，會誤寫到本機檔案，
 * 所以改用官方建議的 migrate diff 產生 SQL、再由這支腳本送到 Turso。
 */
import { readFileSync } from 'node:fs'
import 'dotenv/config'
import { createClient } from '@libsql/client'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env
if (!TURSO_DATABASE_URL) {
  console.error('❌ .env 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

const sqlPath = new URL('../prisma/turso-init.sql', import.meta.url)
const statements = readFileSync(sqlPath, 'utf8')
  .split(';')
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean)

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

try {
  await client.batch(statements, 'write')
  const { rows } = await client.execute(
    "select name from sqlite_master where type='table' and name not like 'sqlite_%' order by name",
  )
  console.log(`✅ 已套用到 Turso，共 ${rows.length} 張資料表：`)
  console.log('   ' + rows.map((r) => r.name).join(', '))
} catch (err) {
  console.error('❌ 套用失敗：', err.message)
  process.exit(1)
}
