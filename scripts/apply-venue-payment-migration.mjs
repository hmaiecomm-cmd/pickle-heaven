import 'dotenv/config'
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env

if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

const sql = readFileSync('./prisma/migrations/20261127203038_add_venue_payment_method/migration.sql', 'utf8')
const statements = sql
  .split(';')
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean)

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

try {
  await client.batch(statements, 'write')
  console.log('✅ VenuePaymentMethod 表已建立至 Turso')

  // 驗證表存在
  const { rows } = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='VenuePaymentMethod'")
  if (rows.length > 0) {
    console.log('✅ 驗證成功：VenuePaymentMethod 表已確認存在')
  }
} catch (err) {
  if (err.message.includes('already exists')) {
    console.log('⚠️ VenuePaymentMethod 表已存在（無需重複建立）')
    process.exit(0)
  }
  console.error('❌ 失敗：', err.message)
  process.exit(1)
}
