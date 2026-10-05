/** 清掉 Turso 上所有資料表（npm run db:reset 會用到）。 */
import 'dotenv/config'
import { createClient } from '@libsql/client'

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const listTables = async () => {
  const { rows } = await client.execute(
    "select name from sqlite_master where type='table' and name not like 'sqlite_%'",
  )
  return rows.map((r) => r.name)
}

// 資料表之間有外鍵相依，一次全刪會撞順序；逐張刪並重試直到清空。
let remaining = await listTables()
let dropped = 0

while (remaining.length > 0) {
  const before = remaining.length
  for (const name of remaining) {
    try {
      await client.execute(`DROP TABLE IF EXISTS "${name}"`)
      dropped++
    } catch {
      // 還有其他表參照它，下一輪再試
    }
  }
  remaining = await listTables()
  if (remaining.length === before) {
    console.error('❌ 無法刪除剩餘資料表：', remaining.join(', '))
    process.exit(1)
  }
}

console.log(dropped === 0 ? '[reset-turso] 資料庫已是空的。' : `[reset-turso] 已刪除 ${dropped} 張資料表。`)
