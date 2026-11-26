'use client'

import { CreditCard, AlertCircle, CheckCircle } from 'lucide-react'
import type { PlatformPayment } from '@prisma/client'

interface SubscriptionBillingTabProps {
  payments: PlatformPayment[]
  venueId: string
}

export function SubscriptionBillingTab({ payments, venueId }: SubscriptionBillingTabProps) {
  return (
    <div className="p-6 space-y-6">
      {/* 付款方式設定 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">付款方式</h2>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <CreditCard className="w-12 h-12 text-gray-400" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">目前尚未設定付款方式</p>
              <p className="text-sm text-gray-600 mt-1">設定付款方式後才能開啟自動續訂功能</p>
            </div>
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm transition-colors whitespace-nowrap">
              新增付款方式
            </button>
          </div>
        </div>
      </div>

      {/* 發票資訊 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">發票資訊</h2>
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
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

          <div className="bg-white border border-gray-200 rounded-lg p-4">
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

          <div className="bg-white border border-gray-200 rounded-lg p-4">
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
            <button className="mt-3 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium text-sm transition-colors">
              編輯發票資訊
            </button>
          </div>
        </div>
      </div>

      {/* 自動續訂 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">自動續訂</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900">尚未啟用自動續訂</p>
              <p className="text-sm text-amber-800 mt-1">
                請先設定付款方式，方可啟用自動續訂功能
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 最近付款紀錄預覽 */}
      {payments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">最近付款紀錄</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">日期</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">金額</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">狀態</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 5).map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">{new Date(payment.createdAt).toLocaleDateString('zh-TW')}</td>
                    <td className="py-3 px-4">$0.00</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {payment.status === 'COMPLETED' ? '已完成' : '待處理'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 示範資料提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 font-medium text-sm">ℹ️ 目前顯示示範設定頁面</p>
        <p className="text-blue-700 text-xs mt-1">
          正式金流與發票設定尚未串接。
        </p>
      </div>
    </div>
  )
}
