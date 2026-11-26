/**
 * 功能加購頁面
 */

import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden } from '@/components/admin/page-bits'
import { getFeatureModules, getVenueSubscriptions } from '@/lib/feature-service'
import FeaturesClient from './features-client'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'

// Mock 資料 - 當資料庫無真實功能時使用
const MOCK_MODULES: FeatureModuleDisplay[] = [
  {
    id: 'mock-1',
    slug: 'booking-plus',
    name: '場地預約 Plus',
    tier: 'PLUS',
    description: '完整的場地預約與管理功能',
    monthlyPrice: 29900, // $299
    yearlyPrice: 299900, // $2,999
    features: ['無限場地', '智能排程', '客戶通知'],
    isAvailable: true,
    launchedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  {
    id: 'mock-2',
    slug: 'finance-plus',
    name: '財務報表 Plus',
    tier: 'PLUS',
    description: '專業的財務與營收分析工具',
    monthlyPrice: 19900,
    yearlyPrice: 199900,
    features: ['營收報表', '成本分析', '稅務計算'],
    isAvailable: true,
    launchedAt: new Date('2026-02-01'),
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
  },
  {
    id: 'mock-3',
    slug: 'members-plus',
    name: '會員與教練 Plus',
    tier: 'PLUS',
    description: '會員資料與教練管理系統',
    monthlyPrice: 14900,
    yearlyPrice: 149900,
    features: ['會員檔案', '教練排班', '簽到管理'],
    isAvailable: true,
    launchedAt: new Date('2026-03-01'),
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  },
  {
    id: 'mock-4',
    slug: 'operations-pro',
    name: '無人營運管理 Pro',
    tier: 'PRO',
    description: '全自動營運與控制系統',
    monthlyPrice: 49900,
    yearlyPrice: 499900,
    features: ['自動燈光', '自動冷氣', '電力監控', '門禁管理'],
    isAvailable: true,
    launchedAt: new Date('2026-04-01'),
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
  },
]

export default async function FeaturesPage() {
  // 權限檢查：只有 SUPER_ADMIN 可以訪問
  const ctx = await pagePermission('settings')
  if (ctx === 'forbidden') return <Forbidden />

  // 獲取場館 ID
  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
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
  let useMockData = false
  let loadError: string | null = null

  try {
    const [fetchedModules, fetchedSubscriptions] = await Promise.all([
      getFeatureModules(),
      getVenueSubscriptions(venue.id),
    ])

    modules = fetchedModules
    subscriptions = fetchedSubscriptions

    // 若無功能資料，使用 mock
    if (!modules || modules.length === 0) {
      modules = MOCK_MODULES
      useMockData = true
    }
  } catch (error) {
    console.error('[FeaturesPage] 載入功能資料失敗：', error)
    loadError = error instanceof Error ? error.message : '未知錯誤'
    // 使用 mock 資料作為降級方案
    modules = MOCK_MODULES
    subscriptions = []
    useMockData = true
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">功能加購</h1>
        <p className="text-gray-500 mt-1">升級場館功能，解鎖更多專業工具</p>
      </div>

      {/* 錯誤提示 */}
      {loadError && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-orange-800 font-medium">⚠️ 資料載入異常</p>
          <p className="text-orange-700 text-sm mt-1">{loadError}</p>
          <p className="text-orange-600 text-xs mt-2">正使用示範資料顯示，請稍後重新整理頁面</p>
        </div>
      )}

      {/* Mock 資料提示 */}
      {useMockData && !loadError && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-blue-800 font-medium">ℹ️ 目前使用示範資料</p>
          <p className="text-blue-700 text-sm mt-1">正式功能資料尚未建立，以下為示範功能方案</p>
        </div>
      )}

      <FeaturesClient initialModules={modules} initialSubscriptions={subscriptions} venueId={venue.id} />
    </div>
  )
}
