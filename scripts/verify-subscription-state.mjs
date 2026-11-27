import 'dotenv/config'
import { createClient } from '@libsql/client'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env

if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

console.log('🔍 驗證訂閱狀態...\n')

try {
  // 1. 取得有效場館
  const { rows: venues } = await client.execute(
    'SELECT id, name FROM Venue WHERE active = 1 LIMIT 1'
  )

  if (venues.length === 0) {
    console.log('❌ 找不到有效場館')
    process.exit(1)
  }

  const venueId = venues[0].id
  const venueName = venues[0].name

  console.log(`✅ 場館：${venueName}`)
  console.log(`   ID：${venueId}\n`)

  // 2. 取得所有可用功能模組
  const { rows: modules } = await client.execute(
    'SELECT id, slug, name, monthlyPrice, yearlyPrice FROM FeatureModule WHERE isAvailable = 1 ORDER BY name'
  )

  console.log(`📦 可用功能模組：${modules.length} 個`)
  modules.forEach((m) => {
    console.log(`   - ${m.slug}: ${m.name}`)
  })

  if (modules.length === 0) {
    console.log('⚠️ 沒有可用功能模組')
  }

  // 3. 取得該場館的訂閱
  const { rows: subscriptions } = await client.execute(
    'SELECT id, featureModuleId, status, startsAt, expiresAt, autoRenew FROM FeatureSubscription WHERE venueId = ? ORDER BY createdAt',
    [venueId]
  )

  console.log(`\n📋 該場館的訂閱：${subscriptions.length} 個`)
  subscriptions.forEach((s) => {
    const module = modules.find((m) => m.id === s.featureModuleId)
    const daysRemaining = Math.ceil((new Date(s.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))
    console.log(`   - ${module?.slug || s.featureModuleId}`)
    console.log(`     狀態：${s.status}，自動續約：${s.autoRenew ? '是' : '否'}`)
    console.log(`     期間：${new Date(s.startsAt).toLocaleDateString('zh-TW')} ~ ${new Date(s.expiresAt).toLocaleDateString('zh-TW')}（剩餘 ${daysRemaining} 天）`)
  })

  // 4. 檢查是否全部功能都已訂購
  const activeModules = modules.filter((m) => m.isAvailable)
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE')

  console.log(`\n🔎 訂購檢查：`)
  console.log(`   可用功能：${activeModules.length} 個`)
  console.log(`   ACTIVE 訂閱：${activeSubscriptions.length} 個`)

  const allFeaturesSubscribed = activeModules.length > 0 && activeModules.every((m) =>
    activeSubscriptions.some((s) => s.featureModuleId === m.id)
  )

  if (allFeaturesSubscribed) {
    console.log(`\n✅ 所有功能都已 ACTIVE 訂購`)
    console.log(`   應顯示：「全功能平台方案」、「使用中」`)
  } else {
    console.log(`\n❌ 部分功能未訂購或非 ACTIVE 狀態`)

    // 列出缺失的功能
    const missingModules = activeModules.filter((m) =>
      !activeSubscriptions.some((s) => s.featureModuleId === m.id)
    )

    if (missingModules.length > 0) {
      console.log(`   缺失：${missingModules.map((m) => m.slug).join(', ')}`)
    }
  }

  // 5. 取得支付記錄
  const { rows: payments } = await client.execute(
    'SELECT id, amount, status, provider FROM PlatformPayment WHERE venueId = ? ORDER BY createdAt DESC LIMIT 1',
    [venueId]
  )

  if (payments.length > 0) {
    const p = payments[0]
    console.log(`\n💳 最新支付記錄：`)
    console.log(`   金額：NT$${(p.amount / 100).toLocaleString('zh-TW')}`)
    console.log(`   狀態：${p.status}`)
    console.log(`   提供者：${p.provider}`)
  }

} catch (err) {
  console.error('❌ 查詢失敗：', err.message)
  process.exit(1)
}
