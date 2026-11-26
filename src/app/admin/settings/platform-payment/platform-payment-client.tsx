'use client'

import { useState } from 'react'
import type { PlatformPayment } from '@prisma/client'

interface PlatformPaymentClientProps {
  initialPayments: PlatformPayment[]
}

export default function PlatformPaymentClient({ initialPayments }: PlatformPaymentClientProps) {
  const [environment, setEnvironment] = useState<'test' | 'production'>('test')
  const [provider, setProvider] = useState('mock')

  const statusColors = {
    PENDING: { badge: 'bg-blue-100 text-blue-800', text: '待付款' },
    COMPLETED: { badge: 'bg-green-100 text-green-800', text: '已完成' },
    FAILED: { badge: 'bg-red-100 text-red-800', text: '失敗' },
    REFUNDED: { badge: 'bg-gray-100 text-gray-800', text: '已退款' },
  }

  return (
    <div className="space-y-6">
      {/* 環境與提供商配置 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">環境設定</h2>

        {/* 環境選項 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">執行環境</label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="environment"
                value="test"
                checked={environment === 'test'}
                onChange={(e) => setEnvironment(e.target.value as 'test' | 'production')}
                className="w-4 h-4"
              />
              <span className="ml-2 text-sm text-gray-700">測試環境</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="environment"
                value="production"
                checked={environment === 'production'}
                onChange={(e) => setEnvironment(e.target.value as 'test' | 'production')}
                className="w-4 h-4 disabled:opacity-50"
                disabled
              />
              <span className="ml-2 text-sm text-gray-700 opacity-50">正式環境 (Phase 2)</span>
            </label>
          </div>
        </div>

        {/* 金流提供商選擇 */}
        <div className="mb-6">
          <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-3">
            金流提供商
          </label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700"
          >
            <option value="mock">模擬金流 (開發用)</option>
            <option value="tappay" disabled>
              TapPay (Phase 2)
            </option>
            <option value="newebpay" disabled>
              新網銀行 (Phase 2)
            </option>
            <option value="linepay" disabled>
              LINE Pay (Phase 2)
            </option>
          </select>
        </div>

        {/* 配置欄位 */}
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="merchant-id" className="block text-sm font-medium text-gray-700 mb-2">
              商戶 ID
            </label>
            <input
              id="merchant-id"
              type="text"
              placeholder="••••••••"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <div className="text-xs text-gray-500 mt-1">[已配置]</div>
          </div>

          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 mb-2">
              API 金鑰
            </label>
            <input
              id="api-key"
              type="password"
              placeholder="••••••••••••••••"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <div className="text-xs text-gray-500 mt-1">[已配置]</div>
          </div>

          <div>
            <label htmlFor="secret-key" className="block text-sm font-medium text-gray-700 mb-2">
              祕密金鑰
            </label>
            <input
              id="secret-key"
              type="password"
              placeholder="••••••••••••••••"
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
            />
            <div className="text-xs text-gray-500 mt-1">[已配置]</div>
          </div>
        </div>

        {/* 信息提示 */}
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <p className="text-sm text-amber-800">
            ⚠️ <strong>金鑰屬於伺服器環境變數</strong>，不在此畫面上顯示或修改。如需更新金鑰，請聯絡系統管理員。
          </p>
        </div>
      </div>

      {/* 連線測試 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">連線測試</h2>
        <button className="bg-gray-300 text-gray-600 cursor-not-allowed px-4 py-2 rounded font-medium text-sm">
          測試連線 (Phase 2)
        </button>
      </div>

      {/* 付款歷史 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">付款歷史</h2>

        {initialPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">尚無付款紀錄</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">日期</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">金額</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">狀態</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">提供商</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">交易編號</th>
                </tr>
              </thead>
              <tbody>
                {initialPayments.map((payment) => {
                  const statusConfig =
                    statusColors[payment.status as keyof typeof statusColors] || statusColors.PENDING
                  return (
                    <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-700">
                        {new Date(payment.createdAt).toLocaleDateString('zh-TW', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-gray-900">
                        ${(payment.amount / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${statusConfig.badge}`}>
                          {statusConfig.text}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{payment.provider}</td>
                      <td className="py-3 px-4 text-gray-600">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{payment.providerRef || '-'}</code>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
