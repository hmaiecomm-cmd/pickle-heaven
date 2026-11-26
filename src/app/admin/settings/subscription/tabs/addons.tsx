'use client'

import { CheckCircle, AlertCircle, Zap } from 'lucide-react'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'

interface SubscriptionAddonsTabProps {
  modules: FeatureModuleDisplay[]
  subscriptions: (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[]
  venueId: string
}

export function SubscriptionAddonsTab({
  modules,
  subscriptions,
  venueId,
}: SubscriptionAddonsTabProps) {
  // 顯示所有功能模塊
  const addons = modules
  const subscriptionMap = new Map(subscriptions.map((s) => [s.featureModuleId, s]))

  const getStatusBadge = (status?: string) => {
    const statusConfig = {
      ACTIVE: { badge: 'bg-green-100 text-green-800', text: '已啟用', icon: CheckCircle },
      PENDING_PAYMENT: { badge: 'bg-blue-100 text-blue-800', text: '待付款', icon: AlertCircle },
      EXPIRED: { badge: 'bg-gray-100 text-gray-800', text: '已過期', icon: AlertCircle },
      INCLUDED: { badge: 'bg-purple-100 text-purple-800', text: '已包含', icon: CheckCircle },
      AVAILABLE: { badge: 'bg-amber-100 text-amber-800', text: '可加購', icon: Zap },
      DRAFT: { badge: 'bg-gray-50 text-gray-700', text: '尚未啟用', icon: AlertCircle },
    }
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">功能加購</h2>
        <p className="text-gray-600 text-sm mb-6">
          根據需求升級功能。已標記「已包含」的功能已包含在現有方案中。
        </p>

        {addons.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">暫無可用功能加購</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addons.map((addon) => {
              const subscription = subscriptionMap.get(addon.id)
              const status = subscription?.status || (addon.slug.includes('included') ? 'INCLUDED' : 'AVAILABLE')
              const config = getStatusBadge(status)

              return (
                <div
                  key={addon.id}
                  className={`border-2 rounded-lg p-5 transition-all ${
                    status === 'ACTIVE'
                      ? 'border-green-300 bg-green-50'
                      : status === 'INCLUDED'
                        ? 'border-purple-200 bg-purple-50'
                        : 'border-gray-200 hover:border-green-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex-1">{addon.name}</h3>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${config.badge}`}>
                      <config.icon className="w-3 h-3" />
                      {config.text}
                    </span>
                  </div>

                  {addon.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{addon.description}</p>
                  )}

                  {addon.features.length > 0 && (
                    <div className="mb-4 pb-4 border-b border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">包含功能：</p>
                      <div className="flex flex-wrap gap-1">
                        {addon.features.slice(0, 2).map((f, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {f}
                          </span>
                        ))}
                        {addon.features.length > 2 && (
                          <span className="text-xs text-gray-500 px-2 py-1">
                            +{addon.features.length - 2} 更多
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold text-gray-900">
                      ${(addon.monthlyPrice / 100).toFixed(0)}
                    </span>
                    <span className="text-xs text-gray-500">/月</span>
                  </div>

                  {subscription && subscription.status === 'ACTIVE' && (
                    <div className="text-xs text-gray-600 mb-3 pb-3 border-b border-gray-200">
                      <p>有效期：{subscription.daysRemaining} 天</p>
                      <p>到期日：{subscription.expiresAt.toLocaleDateString('zh-TW')}</p>
                    </div>
                  )}

                  <button
                    disabled={status === 'INCLUDED' || status === 'ACTIVE'}
                    className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                      status === 'INCLUDED'
                        ? 'bg-purple-100 text-purple-800 cursor-default'
                        : status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800 cursor-default'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {status === 'INCLUDED' ? '已包含' : status === 'ACTIVE' ? '已啟用' : '加購功能'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 示範資料提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 font-medium text-sm">ℹ️ 目前顯示示範功能</p>
        <p className="text-blue-700 text-xs mt-1">
          此功能目前為示範流程，尚未執行任何實際扣款。
        </p>
      </div>
    </div>
  )
}
