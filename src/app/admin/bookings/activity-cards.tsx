'use client'

import React from 'react'
import { Calendar, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Pill } from '@/components/admin/page-bits'
import type { OrderListResult } from '@/server/admin-orders'

export const PAYMENT = { PENDING: ['待付款', 'amber'], PAID: ['已付款', 'green'], FAILED: ['付款失敗', 'red'], UNPAID: ['未付款', 'gray'] } as const
export const ORDER = { ACTIVE: ['有效', 'blue'], CANCELLED: ['已取消', 'gray'], EXPIRED: ['已過期', 'gray'], COMPLETED: ['已完成', 'green'], REFUND_PENDING: ['款項待退', 'red'] } as const
export const REFUND = { NONE: ['無退款', 'gray'], PROCESSING: ['處理中', 'blue'], PARTIAL: ['部分退款', 'amber'], FULL: ['全額退款', 'violet'], FAILED: ['退款失敗', 'red'], MANUAL: ['待人工退款', 'amber'] } as const

export function StatusPill({ map, value }: { map: Record<string, readonly [string, string]>; value: string }) {
  const [label, tone] = map[value] ?? [value, 'gray']
  return <Pill tone={tone as 'gray'}>{label}</Pill>
}

interface ActivityOrder {
  id: string
  code: string
  customer: {
    name: string
    phone: string
    email?: string
    memberRef: string
  }
  activityName?: string
  playDate: string
  paymentStatus: string
  orderStatus: string
  refundStatus: string
  total: number
  createdAt: Date
  summary?: string
}

export function ActivityCards({
  orders,
  loading,
  onViewDetails,
  amountsHidden,
}: {
  orders: OrderListResult['rows']
  loading: boolean
  onViewDetails: (orderId: string) => void
  amountsHidden: boolean
}) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <AlertCircle className="h-10 w-10 text-muted mx-auto mb-3" strokeWidth={1.5} aria-hidden />
        <p className="text-sm text-muted">沒有符合條件的活動訂單</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 transition-opacity', loading && 'opacity-60')}>
      {orders.map((order) => {
        // 解析訂單摘要提取活動資訊
        const isActivityOrder = order.summary?.includes('活動') || order.summary?.includes('報名')
        const paymentColor = order.paymentStatus === 'PAID' ? 'green' : order.paymentStatus === 'PENDING' ? 'amber' : 'red'
        const orderColor = order.orderStatus === 'ACTIVE' ? 'blue' : order.orderStatus === 'COMPLETED' ? 'green' : 'gray'

        return (
          <div
            key={order.id}
            className="rounded-xl border border-[#e3e8dc] bg-white shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col"
          >
            {/* 活動資訊頭部 */}
            <div className="bg-gradient-to-r from-[#eef7e6] to-[#f5faf0] p-4 border-b border-[#e3e8dc]">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-[#1f4d34] line-clamp-2">
                    {order.summary?.replace(/^活動報名：/, '').split('×')[0].trim() || '活動'}
                  </h3>
                  <p className="text-xs text-muted mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" strokeWidth={2} aria-hidden />
                    {order.playDate}
                  </p>
                </div>
                <Pill tone={paymentColor}>
                  {order.paymentStatus === 'PAID' ? '已付款' : order.paymentStatus === 'PENDING' ? '待付款' : '付款失敗'}
                </Pill>
              </div>

              {/* 狀態標籤 */}
              <div className="flex gap-2 flex-wrap">
                <Pill tone={orderColor}>
                  {order.orderStatus === 'ACTIVE' ? '有效' : order.orderStatus === 'COMPLETED' ? '已完成' : '已取消'}
                </Pill>
                {order.refundStatus !== 'NONE' && (
                  <Pill tone="red">退款中</Pill>
                )}
              </div>
            </div>

            {/* 內容區 */}
            <div className="p-4 flex-1 space-y-3">
              {/* 客戶資訊 */}
              <div>
                <p className="text-xs text-muted uppercase tracking-wide mb-1">報名人</p>
                <p className="text-sm font-medium text-[#1f4d34]">{order.customer.name}</p>
                <p className="text-xs text-muted mt-1">會員 #{order.customer.memberRef}</p>
              </div>

              {/* 金額 */}
              {!amountsHidden && (
                <div className="pt-2 border-t border-[#f0f4ed]">
                  <p className="text-xs text-muted uppercase tracking-wide mb-1">費用</p>
                  <p className="text-lg font-bold text-[#7cb342]">NT${order.total.toLocaleString()}</p>
                </div>
              )}

              {/* 訂單編號 */}
              <div className="pt-2 border-t border-[#f0f4ed]">
                <p className="text-xs text-muted font-mono break-all">{order.code}</p>
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="p-4 border-t border-[#e3e8dc] bg-[#fafcf7]">
              <button
                type="button"
                onClick={() => onViewDetails(order.id)}
                className="w-full h-9 rounded-lg bg-[#7cb342] text-white text-sm font-semibold hover:bg-[#6fa036] transition-colors disabled:opacity-40"
              >
                查看詳情
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
