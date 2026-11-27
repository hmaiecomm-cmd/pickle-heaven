'use client'

import { AlertCircle } from 'lucide-react'
import type { PlatformPayment, VenuePaymentMethod, FeatureSubscription, FeatureModule } from '@prisma/client'
import { PaymentMethodManager } from '../payment-method-manager'
import { RenewalInfoCard } from '../renewal-info-card'
import { RenewalHistory } from '../renewal-history'
import { useState } from 'react'

interface SubscriptionBillingTabProps {
  payments: PlatformPayment[]
  venueId: string
  paymentMethods?: VenuePaymentMethod[]
  subscriptions?: (FeatureSubscription & { featureModule: FeatureModule })[]
}

export function SubscriptionBillingTab({
  payments,
  venueId,
  paymentMethods = [],
  subscriptions = [],
}: SubscriptionBillingTabProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const handleUpdate = () => {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div key={refreshKey} className="p-6 space-y-6">
      {/* 支付方式管理 */}
      <div>
        <PaymentMethodManager paymentMethods={paymentMethods} onUpdate={handleUpdate} />
      </div>

      {/* 訂閱續約卡片 */}
      {subscriptions.length > 0 && (
        <div>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">訂閱續約管理</h2>
            <p className="text-sm text-gray-600 mt-1">管理所有方案的自動續約設定</p>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                📋 自動續約設定說明
              </summary>
              <div className="mt-2 p-3 rounded bg-blue-50 border border-blue-200 whitespace-pre-wrap text-gray-700">
{`✓ 步驟一：先在下方「支付方式管理」綁定有效的信用卡
✓ 步驟二：在各訂閱方案卡片上啟用「自動續約」開關
✓ 步驟三：系統將於訂閱到期前 7 天自動扣款
✓ 若扣款失敗，進入 7 天寬限期，每日自動重試
✓ 寬限期內若仍未支付，訂閱將停用`}
              </div>
            </details>
          </div>

          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <RenewalInfoCard key={sub.id} subscription={sub} onUpdate={handleUpdate} />
            ))}
          </div>
        </div>
      )}

      {/* 若沒有任何訂閱 */}
      {subscriptions.length === 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-900">尚無有效訂閱方案</p>
              <p className="text-sm text-orange-800 mt-1">
                請在「功能加購」標籤頁中購買方案，然後回到此頁設定自動續約。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 發票資訊 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">發票資訊</h2>

        <div className="rounded-lg border p-4">
          <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-2">
            公司名稱
          </label>
          <input
            id="company-name"
            type="text"
            placeholder="尚未設定"
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>

        <div className="rounded-lg border p-4">
          <label htmlFor="tax-id" className="block text-sm font-medium text-gray-700 mb-2">
            統一編號
          </label>
          <input
            id="tax-id"
            type="text"
            placeholder="尚未設定"
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>

        <div className="rounded-lg border p-4">
          <label htmlFor="invoice-email" className="block text-sm font-medium text-gray-700 mb-2">
            發票寄送 Email
          </label>
          <input
            id="invoice-email"
            type="email"
            placeholder="尚未設定"
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>
      </div>

      {/* 續約歷史紀錄 */}
      {payments.length > 0 && (
        <div>
          <RenewalHistory payments={payments} />
        </div>
      )}

      {/* 示範資料提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 font-medium text-sm">ℹ️ 自動續約系統已完成實裝</p>
        <p className="text-blue-700 text-xs mt-1">
          支付方式綁定、續約狀態監控、失敗重試等核心功能已就緒。發票管理功能將於下期實現。
        </p>
      </div>
    </div>
  )
}
