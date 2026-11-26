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
  let loadError: string | null = null

  try {
    const [fetchedModules, fetchedSubscriptions, fetchedPayments] = await Promise.all([
      getFeatureModules(),
      getVenueSubscriptions(venue.id),
      prisma.platformPayment.findMany({
        where: { venueId: venue.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    modules = fetchedModules || []
    subscriptions = fetchedSubscriptions || []
    payments = fetchedPayments || []

    // 若無功能資料，使用 mock
    if (!modules || modules.length === 0) {
      modules = getMockModules()
    }
  } catch (error) {
    console.error('[SubscriptionPage] 載入資料失敗：', error)
    loadError = error instanceof Error ? error.message : '未知錯誤'
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
      />
    </div>
  )
}

function getMockModules(): FeatureModuleDisplay[] {
  return [
    {
      id: 'plan-basic',
      slug: 'plan-basic',
      name: '基礎方案',
      tier: 'PLUS' as FeatureTier,
      description: '適合小型球館的基礎方案',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: ['場地預約', '訂單管理'],
      isAvailable: true,
      launchedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    {
      id: 'plan-growth',
      slug: 'plan-growth',
      name: '成長方案',
      tier: 'PLUS' as FeatureTier,
      description: '中型球館專用方案',
      monthlyPrice: 29900,
      yearlyPrice: 299900,
      features: ['場地預約', '財務報表', '會員管理'],
      isAvailable: true,
      launchedAt: new Date('2026-02-01'),
      createdAt: new Date('2026-02-01'),
      updatedAt: new Date('2026-02-01'),
    },
    {
      id: 'plan-pro',
      slug: 'plan-pro',
      name: '專業方案',
      tier: 'PRO' as FeatureTier,
      description: '完整功能的專業方案',
      monthlyPrice: 99900,
      yearlyPrice: 999900,
      features: [
        '場地預約',
        '財務報表',
        '會員管理',
        '無人營運管理',
        'AI 即時監控',
      ],
      isAvailable: true,
      launchedAt: new Date('2026-03-01'),
      createdAt: new Date('2026-03-01'),
      updatedAt: new Date('2026-03-01'),
    },
  ]
}
