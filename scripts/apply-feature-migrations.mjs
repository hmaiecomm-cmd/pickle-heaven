import 'dotenv/config'
import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env

if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

// 應用特定 migration 文件
const migrations = [
  '20261124123219_add_feature_subscription_system',
  '20261125163117_add_payment_webhook_and_renewal_fields',
  '20261128000000_add_renewal_states',
]

console.log('🔄 開始應用 Feature 相關 migration...\n')

for (const migration of migrations) {
  const migrationPath = path.join('./prisma/migrations', migration, 'migration.sql')

  try {
    const sql = readFileSync(migrationPath, 'utf8')
    const statements = sql
      .split(';')
      .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
      .filter(Boolean)

    console.log(`📝 應用 ${migration}`)
    console.log(`   ${statements.length} 條語句...`)

    await client.batch(statements, 'write')

    console.log(`✅ ${migration} 完成\n`)
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('UNIQUE constraint')) {
      console.log(`⚠️ ${migration} 已存在，略過\n`)
    } else {
      console.error(`❌ ${migration} 失敗：`, err.message)
      process.exit(1)
    }
  }
}

// 驗證表存在
console.log('\n🔍 驗證表已建立...\n')

const { rows } = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('FeatureModule', 'FeatureSubscription', 'PlatformPayment') ORDER BY name"
)

if (rows.length === 3) {
  console.log('✅ 所有表已成功建立：')
  rows.forEach(r => console.log(`   - ${r.name}`))
} else {
  console.error(`❌ 只有 ${rows.length}/3 個表存在`)
  process.exit(1)
}

console.log('\n✅ Migration 應用完成！')
