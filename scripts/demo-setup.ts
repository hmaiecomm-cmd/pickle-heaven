/**
 * 建立或重建展示資料庫（DEMO 帳號使用）。
 *
 *   npm run demo:setup
 *
 * 讀取 DEMO_DATABASE_URL / DEMO_DATABASE_AUTH_TOKEN（可在同一行指定，不必寫入檔案）。
 * - 資料庫是空的：先依 prisma/turso-init.sql 建立完整資料表
 * - 資料表已存在：補上後來新增的欄位（見 EXTRA_COLUMNS），可重複執行
 * - 接著清空並寫入虛構的展示資料（會員、訂單、活動、設備…）
 * 絕不會連到正式資料庫：DEMO_DATABASE_URL 與 TURSO_DATABASE_URL 相同時直接中止。
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { seedDemoData } from '../src/server/demo-seed'

/** 後來以 migrations-manual 新增的欄位；舊展示庫缺少時補上，已存在則略過 */
const EXTRA_COLUMNS: { table: string; column: string; ddl: string }[] = [
  { table: 'User', column: 'googleSub', ddl: 'ALTER TABLE "User" ADD COLUMN "googleSub" TEXT' },
  { table: 'Venue', column: 'bookingCutoffMinutes', ddl: 'ALTER TABLE "Venue" ADD COLUMN "bookingCutoffMinutes" INTEGER NOT NULL DEFAULT 0' },
]

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
    console.log('資料表已存在，檢查新增欄位…')
    for (const c of EXTRA_COLUMNS) {
      const info = await raw.execute(`PRAGMA table_info("${c.table}")`)
      if (info.rows.some((r) => r.name === c.column)) continue
      await raw.execute(c.ddl)
      console.log(`・已新增欄位 ${c.table}.${c.column}`)
    }
    await raw.execute('CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub")')
    // 之後的手動遷移逐句套用：欄位或資料表已存在的語句略過（可重複執行）
    for (const file of ['prisma/migrations-manual/2026-10-08b_hosts-maintenance.sql', 'prisma/migrations-manual/2026-10-08d_activity-reserved.sql', 'prisma/migrations-manual/2026-10-08e_people.sql', 'prisma/migrations-manual/2026-10-08f_roles.sql', 'prisma/migrations-manual/2026-10-08g_topup.sql', 'prisma/migrations-manual/2026-10-08h_expenses.sql']) {
      const stmts = readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((l) => !/^\s*--/.test(l))
        .join('\n')
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean)
      let applied = 0
      for (const sql of stmts) {
        try {
          await raw.execute(sql)
          applied++
        } catch (err) {
          if (!/duplicate column|already exists/i.test(String((err as Error).message))) throw err
        }
      }
      if (applied > 0) console.log(`・${file}：套用 ${applied} 句`)
    }
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
