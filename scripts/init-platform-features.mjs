import 'dotenv/config'
import { createClient } from '@libsql/client'

const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env

if (!TURSO_DATABASE_URL) {
  console.error('❌ 缺少 TURSO_DATABASE_URL')
  process.exit(1)
}

const client = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })

// 平台功能定義
const features = [
  {
    slug: 'plus-booking',
    name: 'Plus 基本會員預約系統',
    tier: 'PLUS',
    description: '完整的場館預約、會員管理與訂單系統',
    monthlyPrice: 500000, // 5000 元
    yearlyPrice: 5400000, // 54000 元
    features: ['場地預約', '會員管理', '訂單管理', '財務報表'],
  },
  {
    slug: 'pro-unattended',
    name: 'Pro 無人營運包',
    tier: 'PRO',
    description: '自動化場館管理、電力控制與門禁系統',
    monthlyPrice: 800000, // 8000 元
    yearlyPrice: 8640000, // 86400 元
    features: ['無人營運管理', '電力控制系統', '門禁管理', '24/7 監控'],
  },
  {
    slug: 'pro-ai-monitoring',
    name: 'PRO AI 即時監控',
    tier: 'PRO',
    description: '實時 AI 場館監控、異常檢測與自動告警',
    monthlyPrice: 800000,
    yearlyPrice: 8640000,
    features: ['AI 即時監控', '異常檢測', '自動告警', '數據分析'],
  },
  {
    slug: 'pro-ai-growth',
    name: 'PRO AI 營運成長',
    tier: 'PRO',
    description: 'AI 驅動的營運優化與業務增長建議',
    monthlyPrice: 800000,
    yearlyPrice: 8640000,
    features: ['AI 營運分析', '成長建議', '會員洞察', '定價優化'],
  },
  {
    slug: 'pro-ai-ambiance',
    name: 'PRO AI 情境營造包',
    tier: 'PRO',
    description: '智能燈光、音樂與環境控制，營造場館氛圍',
    monthlyPrice: 300000,
    yearlyPrice: 3240000,
    features: ['智能燈光控制', '背景音樂系統', '環境溫度控制', '場景預設'],
  },
]

console.log('🔄 開始初始化平台功能...\n')

try {
  // 1. 插入或更新 FeatureModule
  console.log('📦 創建功能模組...')

  const moduleIds = {}
  for (const feature of features) {
    // 先嘗試查詢
    const { rows: existing } = await client.execute(
      'SELECT id FROM FeatureModule WHERE slug = ?',
      [feature.slug]
    )

    let moduleId
    if (existing.length > 0) {
      moduleId = existing[0].id
      console.log(`   ✓ ${feature.slug} (已存在)`)
    } else {
      // 新建
      const { rows: inserted } = await client.execute(
        `INSERT INTO FeatureModule
         (id, slug, name, tier, description, monthlyPrice, yearlyPrice, features, isAvailable, launchedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [
          `fm_${Math.random().toString(36).substring(7)}`,
          feature.slug,
          feature.name,
          feature.tier,
          feature.description,
          feature.monthlyPrice,
          feature.yearlyPrice,
          JSON.stringify(feature.features),
          true,
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      )
      moduleId = inserted[0].id
      console.log(`   ✓ ${feature.slug} (新建)`)
    }
    moduleIds[feature.slug] = moduleId
  }

  // 2. 取得有效場館
  console.log('\n🏢 查詢有效場館...')
  const { rows: venues } = await client.execute(
    'SELECT id, name FROM Venue WHERE active = 1 LIMIT 1'
  )

  if (venues.length === 0) {
    console.log('❌ 找不到有效場館')
    process.exit(1)
  }

  const venueId = venues[0].id
  const venueName = venues[0].name
  console.log(`   ✓ ${venueName} (ID: ${venueId})`)

  // 3. 創建訂閱和支付
  console.log('\n📋 創建訂閱和支付紀錄...')

  const now = new Date()
  const startsAt = new Date(now)
  const expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
  const nextRenewalAt = new Date(expiresAt)
  nextRenewalAt.setDate(nextRenewalAt.getDate() - 7)

  const subscriptionIds = []
  let totalAmount = 0

  for (const feature of features) {
    const moduleId = moduleIds[feature.slug]

    // 檢查是否已存在此訂閱
    const { rows: existingSub } = await client.execute(
      'SELECT id FROM FeatureSubscription WHERE venueId = ? AND featureModuleId = ?',
      [venueId, moduleId]
    )

    let subscriptionId
    if (existingSub.length > 0) {
      subscriptionId = existingSub[0].id

      // 更新為 ACTIVE 並延長到期日
      await client.execute(
        `UPDATE FeatureSubscription
         SET status = ?, expiresAt = ?, autoRenew = ?, nextRenewalAt = ?, activatedAt = ?, updatedAt = ?
         WHERE id = ?`,
        ['ACTIVE', expiresAt.toISOString(), true, nextRenewalAt.toISOString(), startsAt.toISOString(), now.toISOString(), subscriptionId]
      )
      console.log(`   ✓ ${feature.slug} (已更新為 ACTIVE)`)
    } else {
      // 新建訂閱
      const { rows: inserted } = await client.execute(
        `INSERT INTO FeatureSubscription
         (id, venueId, featureModuleId, status, startsAt, expiresAt, autoRenew, activatedAt, gracePeriodDays, nextRenewalAt, renewalAttempts, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [
          `fs_${Math.random().toString(36).substring(7)}`,
          venueId,
          moduleId,
          'ACTIVE',
          startsAt.toISOString(),
          expiresAt.toISOString(),
          true,
          startsAt.toISOString(),
          7,
          nextRenewalAt.toISOString(),
          0,
          now.toISOString(),
          now.toISOString(),
        ]
      )
      subscriptionId = inserted[0].id
      console.log(`   ✓ ${feature.slug} (新建)`)
    }

    subscriptionIds.push(subscriptionId)
    totalAmount += feature.yearlyPrice
  }

  // 4. 創建支付紀錄
  console.log('\n💳 創建支付紀錄...')

  const { rows: existingPayment } = await client.execute(
    `SELECT id FROM PlatformPayment WHERE venueId = ? AND status = ? AND provider = ? ORDER BY createdAt DESC LIMIT 1`,
    [venueId, 'COMPLETED', 'mock']
  )

  if (existingPayment.length > 0) {
    console.log(`   ✓ 支付紀錄已存在`)
  } else {
    const { rows: inserted } = await client.execute(
      `INSERT INTO PlatformPayment
       (id, venueId, amount, status, provider, subscriptionIds, paidAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        `pp_${Math.random().toString(36).substring(7)}`,
        venueId,
        totalAmount,
        'COMPLETED',
        'mock',
        subscriptionIds.join(','),
        now.toISOString(),
        now.toISOString(),
      ]
    )
    console.log(`   ✓ 支付紀錄已建立 (金額: NT$${(totalAmount / 100).toLocaleString('zh-TW')})`)
  }

  // 更新訂閱關聯支付
  if (existingPayment.length > 0) {
    const paymentId = existingPayment[0].id
    for (const subId of subscriptionIds) {
      await client.execute(
        'UPDATE FeatureSubscription SET platformPaymentId = ? WHERE id = ?',
        [paymentId, subId]
      )
    }
  }

  console.log('\n✅ 初始化完成！')
  console.log(`\n📊 統計：`)
  console.log(`   - 功能模組：${features.length}`)
  console.log(`   - 場館訂閱：${subscriptionIds.length}`)
  console.log(`   - 年度總額：NT$${(totalAmount / 100).toLocaleString('zh-TW')}`)
  console.log(`   - 有效期：${startsAt.toLocaleDateString('zh-TW')} ~ ${expiresAt.toLocaleDateString('zh-TW')}`)
  console.log(`   - 自動續約：已啟用`)
  console.log(`   - 下次續約：${nextRenewalAt.toLocaleDateString('zh-TW')}`)

} catch (err) {
  console.error('❌ 初始化失敗：', err.message)
  console.error(err)
  process.exit(1)
}
