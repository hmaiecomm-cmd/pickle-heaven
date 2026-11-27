import 'dotenv/config'
import { createClient } from '@libsql/client'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env

if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

try {
  const { rows } = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('FeatureModule', 'FeatureSubscription', 'PlatformPayment') ORDER BY name"
  )

  console.log('\n✅ 資料庫表檢查結果：\n')

  if (rows.length === 0) {
    console.log('❌ 關鍵表不存在！')
    console.log('   - FeatureModule')
    console.log('   - FeatureSubscription')
    console.log('   - PlatformPayment')
  } else {
    console.log('✅ 已存在的表：')
    rows.forEach(r => console.log(`   - ${r.name}`))

    if (rows.length < 3) {
      console.log('\n⚠️ 缺少以下表：')
      const existing = rows.map(r => r.name)
      const required = ['FeatureModule', 'FeatureSubscription', 'PlatformPayment']
      required.forEach(t => {
        if (!existing.includes(t)) console.log(`   - ${t}`)
      })
    }
  }

  // 檢查總表數
  const { rows: allTables } = await client.execute(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  )
  console.log(`\n📊 資料庫總表數：${allTables[0].count}`)
} catch (err) {
  console.error('❌ 查詢失敗：', err.message)
  process.exit(1)
}
