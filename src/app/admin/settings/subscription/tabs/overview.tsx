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
  // 所有功能都已架構完成 - 檢查是否所有功能模組都是 ACTIVE
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'ACTIVE')
  const featureModules = modules.filter((m) => m.isAvailable)
  const allFeaturesSubscribed = featureModules.length > 0 && featureModules.every((m) =>
    activeSubscriptions.some((s) => s.featureModuleId === m.id),
  )

  const currentStatus = allFeaturesSubscribed ? 'ACTIVE' : 'DRAFT'
  const representativeSubscription = activeSubscriptions[0]

  const statusConfig = {
    ACTIVE: { badge: 'bg-green-100 text-green-800', text: '使用中', icon: CheckCircle },
    DRAFT: { badge: 'bg-amber-100 text-amber-800', text: '尚未訂購', icon: AlertCircle },
  }

  const config = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.DRAFT

  return (
    <div className="p-6 space-y-8">
      {/* 目前方案卡片 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">目前平台方案</h2>
        {allFeaturesSubscribed ? (
          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">全功能平台方案</h3>
                <p className="text-gray-600 text-sm mt-1">
                  已包含全部 {activeSubscriptions.length} 項平台功能，所有功能均已架構完成
                </p>
              </div>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-medium text-sm ${config.badge}`}>
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
                <p className="text-sm font-semibold text-gray-900 mt-1">年度</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">自動續訂</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">已啟用</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium">年度費用</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">已訂購</p>
                </div>
                <div className="flex gap-2">
                  <a href="?tab=billing#payment-methods" className="inline-block px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium text-sm transition-colors">設定付款</a>
                  <a href="?tab=billing" className="inline-block px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium text-sm transition-colors">管理方案</a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-amber-900">尚未訂購平台方案</p>
                <p className="text-sm text-amber-800 mt-1">選擇適合的方案開始使用完整功能</p>
                <a href="?tab=addons" className="inline-block mt-4 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-medium text-sm transition-colors">
                  立即升級
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 已架構功能清單 */}
      {allFeaturesSubscribed && (
        <div>
          <h2 className="text-lg font-semibold mb-4">已架構功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className="border-2 border-green-300 rounded-lg p-6 bg-green-50 transition-all">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 flex-1">{sub.featureModule.name}</h3>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                </div>
                <p className="text-sm text-gray-600 mb-4">{sub.featureModule.description}</p>

                <div className="mb-4">
                  <p className="text-xs text-gray-600 mb-2">年度費用</p>
                  <p className="text-2xl font-bold text-gray-900">
                    NT${(sub.featureModule.yearlyPrice / 100).toLocaleString('zh-TW')}
                  </p>
                </div>

                {sub.featureModule.features && sub.featureModule.features.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {sub.featureModule.features.slice(0, 2).map((feature: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                    {sub.featureModule.features.length > 2 && (
                      <li className="text-xs text-gray-500">+{sub.featureModule.features.length - 2} 項功能</li>
                    )}
                  </ul>
                )}

                <button disabled className="w-full py-2 rounded-lg font-medium text-sm bg-green-100 text-green-800 cursor-default">
                  已架構
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 font-medium text-sm">✅ 全功能平台方案已架構完成</p>
        <p className="text-blue-700 text-xs mt-1">所有功能均已部署，您可以在功能加購頁查看每項功能的詳情。</p>
      </div>
    </div>
  )
}
