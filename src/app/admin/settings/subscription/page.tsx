/**
 * 平台訂購整合頁面
 * 合併功能加購、金流設定、訂閱管理於單一頁面
 */

import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden } from '@/components/admin/page-bits'
import { getFeatureModules, getVenueSubscriptions } from '@/lib/feature-service'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'
import type { PlatformPayment, FeatureTier } from '@prisma/client'
import SubscriptionClient from './subscription-client'

export const metadata = { title: '平台訂購' }

export default async function PlatformSubscriptionPage() {
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return <Forbidden />

  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  if (!venue) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800 font-medium">無法載入場館資訊</p>
          <p className="text-red-700 text-sm mt-1">請聯絡系統管理員確認場館設定</p>
        </div>
      </div>
    )
  }

  let modules: FeatureModuleDisplay[] = []
  let subscriptions: (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[] = []
  let payments: PlatformPayment[] = []
  let paymentMethods: any[] = []
  let activeSubscriptions: any[] = []
  let loadError: string | null = null

  try {
    // 分別載入各項數據，單個失敗不影響整體
    console.info('[SubscriptionPage] 開始載入訂閱資料...')

    // 1. 功能模組 - 關鍵資料
    try {
      const fetchedModules = await getFeatureModules(true)
      modules = fetchedModules && fetchedModules.length > 0 ? fetchedModules : []
      console.info('[SubscriptionPage] 功能模組載入成功', { count: modules.length })
    } catch (err) {
      console.error('[SubscriptionPage] 功能模組載入失敗', err)
      modules = getMockModules()
      loadError = '部分資料無法載入'
    }

    // 2. 訂閱資料 - 關鍵資料
    try {
      const fetchedSubscriptions = await getVenueSubscriptions(venue.id)
      subscriptions = fetchedSubscriptions && fetchedSubscriptions.length > 0 ? fetchedSubscriptions : []
      console.info('[SubscriptionPage] 訂閱資料載入成功', { count: subscriptions.length })
    } catch (err) {
      console.error('[SubscriptionPage] 訂閱資料載入失敗', err)
      subscriptions = []
    }

    // 3. 支付記錄 - 非關鍵
    try {
      const fetchedPayments = await prisma.platformPayment.findMany({
        where: { venueId: venue.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      payments = fetchedPayments || []
      console.info('[SubscriptionPage] 支付記錄載入成功', { count: payments.length })
    } catch (err) {
      console.error('[SubscriptionPage] 支付記錄載入失敗', err)
      payments = []
    }

    // 4. 支付方式 - 非關鍵
    try {
      const fetchedMethods = await prisma.venuePaymentMethod.findMany({
        where: { venueId: venue.id, isActive: true },
        orderBy: { isDefault: 'desc' },
      })
      paymentMethods = fetchedMethods || []
      console.info('[SubscriptionPage] 支付方式載入成功', { count: paymentMethods.length })
    } catch (err) {
      console.error('[SubscriptionPage] 支付方式載入失敗', err)
      paymentMethods = []
    }

    // 5. 活躍訂閱 - 非關鍵
    try {
      const fetchedActive = await prisma.featureSubscription.findMany({
        where: { venueId: venue.id, status: 'ACTIVE' },
        include: { featureModule: true },
      })
      activeSubscriptions = fetchedActive || []
      console.info('[SubscriptionPage] 活躍訂閱載入成功', { count: activeSubscriptions.length })
    } catch (err) {
      console.error('[SubscriptionPage] 活躍訂閱載入失敗', err)
      activeSubscriptions = []
    }

    // 診斷日誌
    console.info('[SubscriptionPage] 資料載入完成', {
      modulesCount: modules.length,
      subscriptionsCount: subscriptions.length,
      paymentsCount: payments.length,
      activeSubscriptionsCount: activeSubscriptions.length,
    })
  } catch (error) {
    // 外層捕捉未預期的異常
    console.error('[SubscriptionPage] 未預期的錯誤', error)
    loadError = '訂閱系統遇到未預期的錯誤，請稍後重新整理。'
    modules = getMockModules()
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">平台訂購</h1>
        <p className="text-gray-500 mt-1">管理平台方案、功能加購、付款方式與訂閱狀態</p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-orange-800 font-medium">⚠️ 資料載入異常</p>
          <p className="text-orange-700 text-sm mt-1">{loadError}</p>
          <p className="text-orange-600 text-xs mt-2">正使用示範資料顯示，請稍後重新整理頁面</p>
        </div>
      )}

      <SubscriptionClient
        venueId={venue.id}
        venueName={venue.name}
        initialModules={modules}
        initialSubscriptions={subscriptions}
        initialPayments={payments}
        initialPaymentMethods={paymentMethods}
        activeSubscriptions={activeSubscriptions}
      />
    </div>
  )
}

function getMockModules(): FeatureModuleDisplay[] {
  return [
    {
      id: 'plus-booking',
      slug: 'plus-booking',
      name: 'Plus 基本會員預約系統',
      tier: 'PLUS' as FeatureTier,
      description: '完整的場館預約、會員管理與訂單系統',
      monthlyPrice: 500000, // 5000/月（單位：美分）
      yearlyPrice: 5400000, // 54000/年
      features: ['預約與訂單', '會員管理', '訂單管理', '財務報表'],
      isAvailable: true,
      launchedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    {
      id: 'pro-unattended',
      slug: 'pro-unattended',
      name: 'Pro 無人營運包',
      tier: 'PRO' as FeatureTier,
      description: '自動化場館管理、電力控制與門禁系統',
      monthlyPrice: 800000, // 8000/月
      yearlyPrice: 8640000, // 86400/年
      features: ['無人營運管理', '電力控制系統', '門禁管理', '24/7 監控'],
      isAvailable: true,
      launchedAt: new Date('2026-02-01'),
      createdAt: new Date('2026-02-01'),
      updatedAt: new Date('2026-02-01'),
    },
    {
      id: 'pro-ai-monitoring',
      slug: 'pro-ai-monitoring',
      name: 'PRO AI 即時監控',
      tier: 'PRO' as FeatureTier,
      description: '實時 AI 場館監控、異常檢測與自動告警',
      monthlyPrice: 800000, // 8000/月
      yearlyPrice: 8640000, // 86400/年
      features: ['AI 即時監控', '異常檢測', '自動告警', '數據分析'],
      isAvailable: true,
      launchedAt: new Date('2026-02-15'),
      createdAt: new Date('2026-02-15'),
      updatedAt: new Date('2026-02-15'),
    },
    {
      id: 'pro-ai-growth',
      slug: 'pro-ai-growth',
      name: 'PRO AI 營運成長',
      tier: 'PRO' as FeatureTier,
      description: 'AI 驅動的營運優化與業務增長建議',
      monthlyPrice: 800000, // 8000/月
      yearlyPrice: 8640000, // 86400/年
      features: ['AI 營運分析', '成長建議', '會員洞察', '定價優化'],
      isAvailable: true,
      launchedAt: new Date('2026-03-01'),
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-03-01'),
    },
    {
      id: 'pro-ai-ambiance',
      slug: 'pro-ai-ambiance',
      name: 'PRO AI 情境營造包',
      tier: 'PRO' as FeatureTier,
      description: '智能燈光、音樂與環境控制，營造場館氛圍',
      monthlyPrice: 300000, // 3000/月
      yearlyPrice: 3240000, // 32400/年
      features: ['智能燈光控制', '背景音樂系統', '環境溫度控制', '場景預設'],
      isAvailable: true,
      launchedAt: new Date('2026-03-10'),
      createdAt: new Date('2026-03-10'),
      updatedAt: new Date('2026-03-10'),
    },
  ]
}
