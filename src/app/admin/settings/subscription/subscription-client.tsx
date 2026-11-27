'use client'

import { useState, useEffect } from 'react'
import type { FeatureModuleDisplay, SubscriptionDisplay } from '@/lib/feature-types'
import type { PlatformPayment, VenuePaymentMethod, FeatureSubscription, FeatureModule } from '@prisma/client'
import { SubscriptionOverviewTab } from './tabs/overview'
import { SubscriptionAddonsTab } from './tabs/addons'
import { SubscriptionBillingTab } from './tabs/billing'
import { SubscriptionOrdersTab } from './tabs/orders'

type TabType = 'overview' | 'addons' | 'billing' | 'orders'

interface SubscriptionClientProps {
  venueId: string
  venueName: string
  initialModules: FeatureModuleDisplay[]
  initialSubscriptions: (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[]
  initialPayments: PlatformPayment[]
  initialPaymentMethods?: VenuePaymentMethod[]
  activeSubscriptions?: (FeatureSubscription & { featureModule: FeatureModule })[]
}

const TABS: { id: TabType; label: string; aria?: string }[] = [
  { id: 'overview', label: '方案總覽' },
  { id: 'addons', label: '功能加購' },
  { id: 'billing', label: '付款與訂閱' },
  { id: 'orders', label: '訂購紀錄' },
]

export default function SubscriptionClient({
  venueId,
  venueName,
  initialModules,
  initialSubscriptions,
  initialPayments,
  initialPaymentMethods = [],
  activeSubscriptions = [],
}: SubscriptionClientProps) {
  // 診斷日誌
  if (typeof window !== 'undefined') {
    console.log('[SubscriptionClient]', {
      modulesCount: initialModules.length,
      subscriptionsCount: initialSubscriptions.length,
      firstModule: initialModules[0]?.id,
      firstSubscription: initialSubscriptions[0]?.id,
    })
  }

  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // 保存 tab 狀態到 URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab') as TabType | null
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab)
    }
  }, [])

  // 當 tab 變化時更新 URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    window.history.replaceState(null, '', `?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      {/* Tab 導航 */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-label={tab.aria || tab.label}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 內容 */}
      <div className="bg-white rounded-lg">
        {activeTab === 'overview' && (
          <SubscriptionOverviewTab
            modules={initialModules}
            subscriptions={initialSubscriptions}
            venueId={venueId}
          />
        )}

        {activeTab === 'addons' && (
          <SubscriptionAddonsTab
            modules={initialModules}
            subscriptions={initialSubscriptions}
            venueId={venueId}
          />
        )}

        {activeTab === 'billing' && (
          <SubscriptionBillingTab
            payments={initialPayments}
            venueId={venueId}
            paymentMethods={initialPaymentMethods}
            subscriptions={activeSubscriptions}
          />
        )}

        {activeTab === 'orders' && (
          <SubscriptionOrdersTab
            payments={initialPayments}
            subscriptions={initialSubscriptions}
            venueId={venueId}
          />
        )}
      </div>
    </div>
  )
}
