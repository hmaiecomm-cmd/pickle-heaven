/**
 * 把指定的 SQL 檔套用到 TURSO_DATABASE_URL 指向的資料庫。
 *   node scripts/apply-sql.mjs <sql 檔路徑>
 *
 * 用途：套用 prisma/migrations-manual/ 內的手動遷移。
 * 要套用到正式庫時，先在同一行 shell 指定正式庫的 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN，
 * dotenv 不會覆蓋已存在的環境變數，.env 內的開發庫設定不受影響。
 */
import { readFileSync } from 'node:fs'
import 'dotenv/config'
import { createClient } from '@libsql/client'

const [, , sqlPath] = process.argv
if (!sqlPath) {
  console.error('用法：node scripts/apply-sql.mjs <sql 檔路徑>')
  process.exit(1)
}
const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env
if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

// 先去掉整行註解再以分號切句，註解裡的分號才不會被當成語句分隔
const statements = readFileSync(sqlPath, 'utf8')
  .split(/\r?\n/)
  .filter((line) => !/^\s*--/.test(line))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)

const head = (sql) => sql.split('\n')[0].slice(0, 80)
console.log(`目標：${TURSO_DATABASE_URL.replace(/^libsql:\/\//, '').split('.')[0]}`)
const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })
let ok = 0
for (const sql of statements) {
  try {
    await client.execute(sql)
    ok++
    console.log(`✅ ${head(sql)}`)
  } catch (err) {
    const msg = String(err.message ?? err)
    if (/duplicate column name/i.test(msg)) {
      console.log(`↩️  已存在，略過：${head(sql)}`)
    } else {
      console.error(`❌ ${head(sql)}\n   ${msg}`)
      process.exit(1)
    }
  }
}
console.log(`\n完成，執行 ${ok} 句，略過 ${statements.length - ok} 句。`)
