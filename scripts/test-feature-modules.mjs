import 'dotenv/config'
import { createClient } from '@libsql/client'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env

if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

console.log('🔍 測試 getFeatureModules(true)...\n')

try {
  // 直接查詢資料庫
  const { rows: allModules } = await client.execute(
    'SELECT id, slug, name, isAvailable FROM FeatureModule ORDER BY name'
  )

  console.log(`📦 所有功能模組：${allModules.length} 個`)
  allModules.forEach(m => {
    console.log(`   - ${m.slug}: ${m.name} (isAvailable: ${m.isAvailable})`)
  })

  const { rows: availableModules } = await client.execute(
    'SELECT id, slug, name, isAvailable FROM FeatureModule WHERE isAvailable = 1 ORDER BY name'
  )

  console.log(`\n✅ 可用功能模組：${availableModules.length} 個`)
  availableModules.forEach(m => {
    console.log(`   - ${m.slug}: ${m.name} (isAvailable: ${m.isAvailable})`)
  })

} catch (err) {
  console.error('❌ 查詢失敗：', err.message)
  process.exit(1)
}
