'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'
import { getSubscriptionStatusLabel, calculateDaysRemaining } from '@/lib/feature-service'
import { createFeatureSubscription, renewSubscription, cancelSubscription } from './actions'

interface FeaturesClientProps {
  initialModules: FeatureModuleDisplay[]
  initialSubscriptions: (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[]
  venueId: string
}

export default function FeaturesClient({ initialModules, initialSubscriptions, venueId }: FeaturesClientProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [durationMonths, setDurationMonths] = useState<1 | 12>(12)
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
              <p className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>{message.text}</p>
            </div>
          </div>
        </div>
      )}

      {/* 功能卡片網格 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">所有功能模組</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialModules.map((module) => {
            const sub = subscriptionMap.get(module.id)
            const daysLeft = sub ? sub.daysRemaining : 0
            const isExpiringSoon = !!(sub && sub.status === 'ACTIVE' && daysLeft > 0 && daysLeft <= 30)
            const isModalOpen = selectedFeature === module.id

            return (
              <div key={module.id}>
                <FeatureCard
                  module={module}
                  subscription={sub}
                  daysRemaining={daysLeft}
                  isExpiringSoon={isExpiringSoon}
                  onUpgrade={() => {
                    setSelectedFeature(module.id)
                    setMessage(null)
                  }}
                  onRenew={() => {
                    setSelectedFeature(module.id)
                    setMessage(null)
                  }}
                  onCancel={() => {
                    setSelectedFeature(module.id)
                    setMessage(null)
                  }}
                />

                {/* 購買/續約 Modal */}
                {isModalOpen && (
                  <PurchaseModal
                    module={module}
                    subscription={sub}
                    durationMonths={durationMonths}
                    onDurationChange={setDurationMonths}
                    onConfirm={async () => {
                      setLoading(true)
                      try {
                        const result = sub
                          ? await renewSubscription(sub.id, durationMonths)
                          : await createFeatureSubscription(venueId, module.id, durationMonths, true)

                        if (result.success) {
                          const subId = 'newSubscriptionId' in (result.data || {})
                            ? (result.data as any).newSubscriptionId
                            : (result.data as any)?.subscriptionId
                          setMessage({
                            type: 'success',
                            text: `${sub ? '續約' : '購買'}成功，請完成支付。訂閱 ID: ${subId?.substring(0, 8)}...`,
                          })
                          setSelectedFeature(null)
                        } else {
                          setMessage({
                            type: 'error',
                            text: result.message,
                          })
                        }
                      } catch (err) {
                        setMessage({
                          type: 'error',
                          text: '操作失敗，請稍後重試',
                        })
                      } finally {
                        setLoading(false)
                      }
                    }}
                    onCancel={async () => {
                      if (sub) {
                        setLoading(true)
                        try {
                          const result = await cancelSubscription(sub.id)
                          if (result.success) {
                            setMessage({
                              type: 'success',
                              text: '訂閱已取消',
                            })
                          } else {
                            setMessage({
                              type: 'error',
                              text: result.message,
                            })
                          }
                        } finally {
                          setLoading(false)
                        }
                      }
                      setSelectedFeature(null)
                    }}
                    onClose={() => setSelectedFeature(null)}
                    isLoading={loading}
                  />
                )}
              </div>
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
  onUpgrade: () => void
  onRenew: () => void
  onCancel: () => void
}

function FeatureCard({ module, subscription, daysRemaining, isExpiringSoon, onUpgrade, onRenew, onCancel }: FeatureCardProps) {
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
      {!subscription || subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED' ? (
        <button
          onClick={onUpgrade}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors"
        >
          立即購買
        </button>
      ) : subscription.status === 'ACTIVE' ? (
        <div className="space-y-2">
          <button
            onClick={onRenew}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-medium transition-colors"
          >
            續約
          </button>
          <button
            onClick={onCancel}
            className="w-full bg-red-100 hover:bg-red-200 text-red-800 py-2 rounded text-sm font-medium transition-colors"
          >
            取消訂閱
          </button>
        </div>
      ) : subscription.status === 'PENDING_PAYMENT' ? (
        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
          ⏳ 等待支付確認...
        </div>
      ) : subscription.status === 'DRAFT' ? (
        <button
          onClick={onUpgrade}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors"
        >
          開始使用
        </button>
      ) : null}
    </div>
  )
}

interface PurchaseModalProps {
  module: FeatureModuleDisplay
  subscription?: SubscriptionDisplay & { featureModule: FeatureModuleDisplay }
  durationMonths: 1 | 12
  onDurationChange: (months: 1 | 12) => void
  onConfirm: () => Promise<void>
  onCancel: () => Promise<void>
  onClose: () => void
  isLoading: boolean
}

function PurchaseModal({
  module,
  subscription,
  durationMonths,
  onDurationChange,
  onConfirm,
  onCancel,
  onClose,
  isLoading,
}: PurchaseModalProps) {
  const monthlyPrice = module.monthlyPrice / 100
  const yearlyPrice = module.yearlyPrice / 100
  const selectedPrice = durationMonths === 1 ? monthlyPrice : yearlyPrice
  const savings = durationMonths === 12 ? (monthlyPrice * 12 - yearlyPrice).toFixed(2) : '0'

  const isRenewal = subscription && subscription.status === 'ACTIVE'
  const isCancel = subscription && (subscription.status === 'ACTIVE' || subscription.status === 'PENDING_PAYMENT')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="border-b p-6">
          <h2 className="text-xl font-bold">{module.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{isRenewal ? '續約' : '購買'} {module.tier === 'PLUS' ? '基礎版' : '進階版'}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* 計費周期選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">計費周期</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onDurationChange(1)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  durationMonths === 1
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">${monthlyPrice.toFixed(2)}</div>
                <div className="text-xs text-gray-600">1 個月</div>
              </button>

              <button
                onClick={() => onDurationChange(12)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  durationMonths === 12
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">${yearlyPrice.toFixed(2)}</div>
                <div className="text-xs text-gray-600">12 個月</div>
                {durationMonths === 12 && <div className="text-xs text-green-600 mt-1">節省 ${savings}</div>}
              </button>
            </div>
          </div>

          {/* 價格摘要 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-600">計費金額</span>
              <span className="font-bold text-lg">${selectedPrice.toFixed(2)}</span>
            </div>
            <div className="text-xs text-gray-500">含稅，自動續約（可取消）</div>
          </div>

          {/* 功能列表 */}
          {module.features.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">包含功能</label>
              <ul className="space-y-2">
                {module.features.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-gray-50 rounded-b-lg space-y-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition-colors"
          >
            {isLoading ? '處理中...' : isRenewal ? '確認續約' : '立即購買'}
          </button>

          {isCancel && (
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="w-full bg-red-50 hover:bg-red-100 disabled:bg-gray-200 text-red-800 py-2 rounded-lg font-medium transition-colors"
            >
              {isLoading ? '處理中...' : '取消訂閱'}
            </button>
          )}

          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )
}
