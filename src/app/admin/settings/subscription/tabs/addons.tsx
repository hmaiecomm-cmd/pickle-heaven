'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Zap, X } from 'lucide-react'
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
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null)
  const [durationMonths, setDurationMonths] = useState<1 | 12>(12)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 顯示所有功能模塊
  const addons = modules
  const subscriptionMap = new Map(subscriptions.map((s) => [s.featureModuleId, s]))

  const getStatusBadge = (status?: string) => {
    const statusConfig = {
      ACTIVE: { badge: 'bg-green-100 text-green-800', text: '已架構', icon: CheckCircle },
      PENDING_PAYMENT: { badge: 'bg-blue-100 text-blue-800', text: '待付款', icon: AlertCircle },
      EXPIRED: { badge: 'bg-gray-100 text-gray-800', text: '已過期', icon: AlertCircle },
      INCLUDED: { badge: 'bg-green-100 text-green-800', text: '已架構', icon: CheckCircle },
      AVAILABLE: { badge: 'bg-amber-100 text-amber-800', text: '可加購', icon: Zap },
      DRAFT: { badge: 'bg-gray-50 text-gray-700', text: '尚未啟用', icon: AlertCircle },
    }
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.DRAFT
  }

  const handleAddonsClick = async (addonId: string) => {
    setSelectedAddon(addonId)
    setMessage(null)
  }

  const handlePurchaseConfirm = async (addon: FeatureModuleDisplay) => {
    setLoading(true)
    try {
      const { createFeatureSubscription } = await import('../../features/actions')
      const result = await createFeatureSubscription(venueId, addon.id, durationMonths, true)

      if (result.success) {
        setMessage({
          type: 'success',
          text: `加購成功！訂閱 ID: ${(result.data as any)?.newSubscriptionId?.substring(0, 8) || '...'}，請完成支付。`,
        })
        setSelectedAddon(null)
      } else {
        setMessage({
          type: 'error',
          text: result.message || '加購失敗，請稍後重試',
        })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '加購失敗',
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedAddonData = selectedAddon ? addons.find((a) => a.id === selectedAddon) : null

  return (
    <div className="p-6 space-y-6">
      {/* 訊息提示 */}
      {message && (
        <div
          className={`rounded-lg border-l-4 p-4 ${
            message.type === 'success'
              ? 'border-green-500 bg-green-50'
              : 'border-red-500 bg-red-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {message.text}
              </p>
            </div>
          </div>
        </div>
      )}

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
              // 如果訂閱是 ACTIVE，則顯示為「已架構」
              const isActive = subscription?.status === 'ACTIVE'
              const status = subscription?.status || 'AVAILABLE'
              const config = getStatusBadge(status)

              return (
                <div
                  key={addon.id}
                  className={`border-2 rounded-lg p-5 transition-all ${
                    isActive
                      ? 'border-green-300 bg-green-50'
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
                    onClick={() => handleAddonsClick(addon.id)}
                    disabled={isActive}
                    className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                      isActive
                        ? 'bg-green-100 text-green-800 cursor-default'
                        : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    }`}
                  >
                    {isActive ? '已架構' : '加購功能'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 購買 Modal */}
      {selectedAddonData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{selectedAddonData.name}</h3>
              <button
                onClick={() => setSelectedAddon(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-gray-600 text-sm">{selectedAddonData.description}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">訂閱期限</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDurationMonths(1)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    durationMonths === 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  1 個月
                </button>
                <button
                  onClick={() => setDurationMonths(12)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    durationMonths === 12
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  12 個月
                </button>
              </div>
            </div>

            <div className="mb-6 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-800">
                費用：${((selectedAddonData.monthlyPrice / 100) * durationMonths).toFixed(2)}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedAddon(null)}
                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => handlePurchaseConfirm(selectedAddonData)}
                disabled={loading}
                className="flex-1 py-2 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? '處理中...' : '確認購買'}
              </button>
            </div>
          </div>
        </div>
      )}

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
