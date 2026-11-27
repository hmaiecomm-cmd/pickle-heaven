'use client'

import { AlertCircle, CheckCircle } from 'lucide-react'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'

interface SubscriptionOverviewTabProps {
  modules: FeatureModuleDisplay[]
  subscriptions: (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[]
  venueId: string
}

export function SubscriptionOverviewTab({
  modules,
  subscriptions,
  venueId,
}: SubscriptionOverviewTabProps) {
  // 舊資料以「功能模組」記錄訂閱，不一定有 plan-* 方案記錄。
  // 因此只要所有可販售模組都已啟用，就顯示為全功能方案。
  const availableModules = modules.filter((m) => m.isAvailable)
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE')
  const allFeaturesSubscribed = availableModules.length > 0 && availableModules.every((m) =>
    activeSubscriptions.some((s) => s.featureModuleId === m.id),
  )
  const planModules = modules.filter((m) => m.tier === 'PLUS' && m.slug.startsWith('plan-'))
  const currentPlan = subscriptions.find((s) => s.featureModule.slug.startsWith('plan-'))
  const representativeSubscription = currentPlan || activeSubscriptions[0]

  const currentStatus = currentPlan?.status || (allFeaturesSubscribed ? 'ACTIVE' : 'DRAFT')
  const statusConfig = {
    ACTIVE: { badge: 'bg-green-100 text-green-800', text: '使用中', icon: CheckCircle },
    PENDING_PAYMENT: {
      badge: 'bg-blue-100 text-blue-800',
      text: '待付款',
      icon: AlertCircle,
    },
    EXPIRED: { badge: 'bg-gray-100 text-gray-800', text: '已過期', icon: AlertCircle },
    CANCELLED: { badge: 'bg-red-100 text-red-800', text: '已取消', icon: AlertCircle },
    DRAFT: { badge: 'bg-amber-100 text-amber-800', text: '尚未訂購', icon: AlertCircle },
  }

  const config = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.DRAFT

  return (
    <div className="p-6 space-y-8">
      {/* 目前方案卡片 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">目前平台方案</h2>
        {currentPlan || allFeaturesSubscribed ? (
          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {allFeaturesSubscribed && !currentPlan ? '全功能訂閱方案' : currentPlan?.featureModule.name}
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  {allFeaturesSubscribed && !currentPlan
                    ? `已包含 ${activeSubscriptions.length} 項平台功能，全部功能皆可使用`
                    : currentPlan?.featureModule.description}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-medium text-sm ${config.badge}`}
              >
                <config.icon className="w-4 h-4" />
                {config.text}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600 font-medium">訂閱開始</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {representativeSubscription?.startsAt.toLocaleDateString('zh-TW') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">下次扣款</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {representativeSubscription?.expiresAt.toLocaleDateString('zh-TW') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">付款週期</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {representativeSubscription && representativeSubscription.daysRemaining >= 300 ? '年度' : '月度'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">自動續訂</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {representativeSubscription?.autoRenew ? '已啟用' : '已停用'}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium">本期費用</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {allFeaturesSubscribed && !currentPlan
                      ? '已訂購'
                      : `$${((currentPlan?.featureModule.monthlyPrice || 0) / 100).toFixed(2)}`}
                  </p>
                </div>
                <a href="?tab=billing" className="inline-block px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium text-sm transition-colors">管理方案</a>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-amber-900">尚未訂購平台方案</p>
                <p className="text-sm text-amber-800 mt-1">
                  選擇適合的方案開始使用完整功能
                </p>
                <a href="?tab=addons" className="inline-block mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-medium text-sm transition-colors">
                  立即升級
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 方案選擇卡片 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">可用方案</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planModules.map((plan) => {
            const isCurrent = currentPlan?.featureModuleId === plan.id
            const isActive = currentStatus === 'ACTIVE'

            return (
              <div
                key={plan.id}
                className={`border-2 rounded-lg p-6 transition-all ${
                  isCurrent
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300 bg-white'
                }`}
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>

                <div className="mb-4">
                  <p className="text-3xl font-bold text-gray-900">
                    ${(plan.monthlyPrice / 100).toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">月費</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.slice(0, 3).map((feature, idx) => (
                    <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                  {plan.features.length > 3 && (
                    <li className="text-xs text-gray-500">
                      +{plan.features.length - 3} 項功能
                    </li>
                  )}
                </ul>

                <button
                  disabled={isCurrent && isActive}
                  className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                    isCurrent && isActive
                      ? 'bg-green-100 text-green-800 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isCurrent && isActive ? '目前方案' : '選擇方案'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 示範資料提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 font-medium text-sm">ℹ️ 目前顯示示範訂購資料</p>
        <p className="text-blue-700 text-xs mt-1">
          正式付款功能尚未連接。實際方案與定價以正式簽約為準。
        </p>
      </div>
    </div>
  )
}
