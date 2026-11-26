'use client'

import { FileText, Download } from 'lucide-react'
import type { PlatformPayment } from '@prisma/client'
import type { SubscriptionDisplay, FeatureModuleDisplay } from '@/lib/feature-types'

interface SubscriptionOrdersTabProps {
  payments: PlatformPayment[]
  subscriptions: (SubscriptionDisplay & { featureModule: FeatureModuleDisplay })[]
  venueId: string
}

export function SubscriptionOrdersTab({
  payments,
  subscriptions,
  venueId,
}: SubscriptionOrdersTabProps) {
  // 合併訂單資料
  const allOrders = [
    ...subscriptions.map((sub) => ({
      type: 'subscription' as const,
      id: sub.id,
      date: sub.createdAt,
      description: `訂閱：${sub.featureModule.name}`,
      amount: sub.featureModule.monthlyPrice / 100,
      status: sub.status,
      invoiceStatus: 'pending' as const,
    })),
    ...payments.map((p) => ({
      type: 'payment' as const,
      id: p.id,
      date: p.createdAt,
      description: '平台訂購付款',
      amount: 0,
      status: p.status,
      invoiceStatus: 'pending' as const,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const getStatusColor = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-800', label: '已生效' },
      PENDING_PAYMENT: { bg: 'bg-blue-100', text: 'text-blue-800', label: '待付款' },
      EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-800', label: '已過期' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', label: '已取消' },
      COMPLETED: { bg: 'bg-green-100', text: 'text-green-800', label: '已完成' },
      PENDING: { bg: 'bg-blue-100', text: 'text-blue-800', label: '待處理' },
      FAILED: { bg: 'bg-red-100', text: 'text-red-800', label: '失敗' },
      REFUNDED: { bg: 'bg-gray-100', text: 'text-gray-800', label: '已退款' },
    }
    return config[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status }
  }

  if (allOrders.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">尚無訂購紀錄</p>
          <p className="text-sm text-gray-500 mt-1">
            選擇功能或方案後會產生訂購紀錄
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-4">訂購紀錄</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-700">日期</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">內容</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">金額</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">狀態</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">發票</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.map((order) => {
                const statusConfig = getStatusColor(order.status)
                return (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">
                      {order.date.toLocaleDateString('zh-TW')}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{order.description}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 text-right">
                      {order.amount > 0 ? `$${order.amount.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {order.invoiceStatus === 'pending' ? (
                        <span className="text-gray-500">未申請</span>
                      ) : (
                        <span className="text-green-700 font-medium">已開立</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        disabled={order.invoiceStatus === 'pending'}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-default transition-colors"
                        title="下載發票"
                      >
                        <Download className="w-3 h-3" />
                        下載
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 統計摘要 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">總訂單數</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{allOrders.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">待付款</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {allOrders.filter((o) => o.status === 'PENDING_PAYMENT').length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">已完成</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {allOrders.filter((o) => o.status === 'COMPLETED' || o.status === 'ACTIVE').length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">已過期</p>
          <p className="text-2xl font-bold text-gray-600 mt-2">
            {allOrders.filter((o) => o.status === 'EXPIRED' || o.status === 'CANCELLED').length}
          </p>
        </div>
      </div>

      {/* 示範資料提示 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 font-medium text-sm">ℹ️ 目前顯示示範訂購紀錄</p>
        <p className="text-blue-700 text-xs mt-1">
          正式訂單資料與發票功能尚未完全連接。
        </p>
      </div>
    </div>
  )
}
