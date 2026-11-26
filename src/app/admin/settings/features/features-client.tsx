'use client'

import { useMemo } from 'react'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'
import { getSubscriptionStatusLabel, calculateDaysRemaining } from '@/lib/feature-service'

interface FeaturesClientProps {
  initialModules: FeatureModuleDisplay[]
  initialSubscriptions: (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[]
}

export default function FeaturesClient({ initialModules, initialSubscriptions }: FeaturesClientProps) {
  const statusSummary = useMemo(() => {
    const active = initialSubscriptions.filter((s) => s.status === 'ACTIVE').length
    const expiringSoon = initialSubscriptions.filter(
      (s) => s.status === 'ACTIVE' && s.daysRemaining > 0 && s.daysRemaining <= 30
    ).length
    return { total: initialModules.length, active, expiringSoon }
  }, [initialModules.length, initialSubscriptions])

  const subscriptionMap = useMemo(() => {
    const map = new Map<string, (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })>()
    for (const sub of initialSubscriptions) {
      map.set(sub.featureModuleId, sub)
    }
    return map
  }, [initialSubscriptions])

  return (
    <div className="space-y-6">
      {/* 狀態總覽 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">功能總數</div>
          <div className="text-3xl font-bold mt-2 text-gray-900">{statusSummary.active}</div>
          <div className="text-xs text-gray-400 mt-1">/ {statusSummary.total} 個</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">即將到期</div>
          <div className="text-3xl font-bold mt-2 text-amber-600">{statusSummary.expiringSoon}</div>
          <div className="text-xs text-gray-400 mt-1">30 天內到期</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-medium text-gray-500">統計日期</div>
          <div className="text-sm mt-2 text-gray-700 font-mono">{new Date().toLocaleDateString('zh-TW')}</div>
          <div className="text-xs text-gray-400 mt-1">更新於 {new Date().toLocaleTimeString('zh-TW')}</div>
        </div>
      </div>

      {/* 功能卡片網格 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">所有功能模組</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialModules.map((module) => {
            const sub = subscriptionMap.get(module.id)
            const daysLeft = sub ? sub.daysRemaining : 0
            const isExpiringSoon = !!(sub && sub.status === 'ACTIVE' && daysLeft > 0 && daysLeft <= 30)

            return (
              <FeatureCard
                key={module.id}
                module={module}
                subscription={sub}
                daysRemaining={daysLeft}
                isExpiringSoon={isExpiringSoon}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface FeatureCardProps {
  module: FeatureModuleDisplay
  subscription?: SubscriptionDisplay & { featureModule: FeatureModuleDisplay }
  daysRemaining: number
  isExpiringSoon: boolean
}

function FeatureCard({ module, subscription, daysRemaining, isExpiringSoon }: FeatureCardProps) {
  const tierColors = {
    PLUS: 'bg-blue-50 border-blue-200',
    PRO: 'bg-purple-50 border-purple-200',
  }

  const statusColors = {
    ACTIVE: { badge: 'bg-green-100 text-green-800', text: '已開通' },
    DRAFT: { badge: 'bg-amber-100 text-amber-800', text: '建立中' },
    EXPIRED: { badge: 'bg-gray-100 text-gray-800', text: '已過期' },
    CANCELLED: { badge: 'bg-red-100 text-red-800', text: '已取消' },
    PENDING_PAYMENT: { badge: 'bg-blue-100 text-blue-800', text: '待付款' },
  }

  const status = subscription?.status || 'DRAFT'
  const statusConfig = statusColors[status as keyof typeof statusColors] || statusColors.DRAFT

  return (
    <div
      className={`rounded-lg border-2 p-4 ${tierColors[module.tier as keyof typeof tierColors]} transition-all hover:shadow-md`}
    >
      {/* 標題與層級 */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{module.name}</h3>
          <div className="text-xs font-semibold mt-1">
            <span className={`px-2 py-1 rounded ${module.tier === 'PLUS' ? 'bg-blue-200 text-blue-900' : 'bg-purple-200 text-purple-900'}`}>
              {module.tier === 'PLUS' ? '基礎版' : '進階版'}
            </span>
          </div>
        </div>
      </div>

      {/* 描述 */}
      {module.description && <p className="text-sm text-gray-600 mb-3">{module.description}</p>}

      {/* 功能列表 */}
      {module.features.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">功能：</div>
          <div className="flex flex-wrap gap-1">
            {module.features.slice(0, 3).map((f, idx) => (
              <span key={idx} className="text-xs bg-white bg-opacity-60 px-2 py-1 rounded">
                {f}
              </span>
            ))}
            {module.features.length > 3 && <span className="text-xs text-gray-500 px-2 py-1">+{module.features.length - 3}</span>}
          </div>
        </div>
      )}

      {/* 價格 */}
      <div className="mb-3 py-2 border-t border-current border-opacity-10">
        <div className="text-sm text-gray-700">
          <div className="flex justify-between">
            <span>月費</span>
            <span className="font-semibold">${(module.monthlyPrice / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>年費</span>
            <span>${(module.yearlyPrice / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 訂閱狀態 */}
      <div className="mb-3">
        <div className={`inline-block text-xs font-semibold px-2 py-1 rounded ${statusConfig.badge}`}>
          {statusConfig.text}
        </div>

        {subscription && subscription.status === 'ACTIVE' && (
          <div className="text-xs text-gray-600 mt-2">
            <div>有效期：{daysRemaining} 天</div>
            {isExpiringSoon && <div className="text-amber-600 font-semibold">即將到期</div>}
          </div>
        )}

        {subscription && subscription.status === 'DRAFT' && (
          <div className="text-xs text-gray-600 mt-2">建立中，尚未開通</div>
        )}
      </div>

      {/* 操作按鈕 */}
      <button className="w-full bg-gray-300 text-gray-600 cursor-not-allowed py-2 rounded text-sm font-medium">
        查看詳情 (Phase 2)
      </button>
    </div>
  )
}
