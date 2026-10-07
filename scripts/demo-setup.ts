/**
 * 建立或重建展示資料庫（DEMO 帳號使用）。
 *
 *   npm run demo:setup
 *
 * 讀取 DEMO_DATABASE_URL / DEMO_DATABASE_AUTH_TOKEN（可在同一行指定，不必寫入檔案）。
 * - 資料庫是空的：先依 prisma/turso-init.sql 建立完整資料表
 * - 接著清空並寫入虛構的展示資料（會員、訂單、活動、設備…）
 * 絕不會連到正式資料庫：DEMO_DATABASE_URL 與 TURSO_DATABASE_URL 相同時直接中止。
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { seedDemoData } from '../src/server/demo-seed'

async function main() {
  const url = process.env.DEMO_DATABASE_URL
  const authToken = process.env.DEMO_DATABASE_AUTH_TOKEN
  if (!url) throw new Error('缺少 DEMO_DATABASE_URL')
  if (url === process.env.TURSO_DATABASE_URL || url === process.env.PRODUCTION_DATABASE_URL) throw new Error('DEMO_DATABASE_URL 不可指向正式或開發資料庫')
  console.log('展示資料庫：', url.replace(/^libsql:\/\//, '').split('.')[0])

  const raw = createClient({ url, authToken })
  const exists = await raw.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Booking'")
  if (exists.rows.length === 0) {
    console.log('建立資料表…')
    const statements = readFileSync('prisma/turso-init.sql', 'utf8')
      .split(/\r?\n/)
      .filter((l) => !/^\s*--/.test(l))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const sql of statements) await raw.execute(sql)
    console.log(`已建立（${statements.length} 句）`)
  } else {
    console.log('資料表已存在，略過建立（結構異動請用 apply-sql 套用 migrations-manual）')
  }
  raw.close()

  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken }) })
  await seedDemoData(db, { log: (m) => console.log('・' + m) })
  const counts = await Promise.all([db.user.count(), db.booking.count(), db.session.count(), db.device.count()])
  console.log(`會員 ${counts[0]}、訂單 ${counts[1]}、活動場次 ${counts[2]}、設備 ${counts[3]}`)
  await db.$disconnect()
}

main().catch((err) => {
  console.error('❌', err.message ?? err)
  process.exit(1)
})
