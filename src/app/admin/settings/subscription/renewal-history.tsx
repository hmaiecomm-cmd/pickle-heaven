'use client'

import { PlatformPayment } from '@prisma/client'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { Check, AlertCircle, Clock } from 'lucide-react'

interface RenewalHistoryProps {
  payments: PlatformPayment[]
}

const getStatusInfo = (status: string) => {
  switch (status) {
    case 'COMPLETED':
      return {
        label: '已完成',
        icon: Check,
        color: 'text-green-600 bg-green-50',
        borderColor: 'border-green-200',
      }
    case 'PENDING':
      return {
        label: '待處理',
        icon: Clock,
        color: 'text-orange-600 bg-orange-50',
        borderColor: 'border-orange-200',
      }
    case 'FAILED':
      return {
        label: '已失敗',
        icon: AlertCircle,
        color: 'text-red-600 bg-red-50',
        borderColor: 'border-red-200',
      }
    default:
      return {
        label: status,
        icon: Clock,
        color: 'text-gray-600 bg-gray-50',
        borderColor: 'border-gray-200',
      }
  }
}

export function RenewalHistory({ payments }: RenewalHistoryProps) {
  if (payments.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="font-semibold text-sm mb-4">續約歷史紀錄</h3>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">尚無續約紀錄</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <h3 className="font-semibold text-sm">續約歷史紀錄</h3>

      <div className="space-y-2">
        {payments.map((payment) => {
          const status = getStatusInfo(payment.status)
          const StatusIcon = status.icon

          return (
            <div
              key={payment.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${status.borderColor} ${status.color}`}
            >
              <div className="flex items-center gap-3">
                <StatusIcon className="w-4 h-4" />

                <div>
                  <p className="text-sm font-medium">
                    NT${payment.amount / 100}
                  </p>
                  <p className="text-xs opacity-75">
                    {format(new Date(payment.createdAt), 'yyyy年M月d日 HH:mm', { locale: zhTW })}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs font-medium">{status.label}</p>
                {payment.lastRetryAt && (
                  <p className="text-xs opacity-75">
                    重試：{format(new Date(payment.lastRetryAt), 'M月d日', { locale: zhTW })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 底部提示 */}
      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-xs text-blue-800">
          💡 <strong>提示：</strong>
          最近的 20 筆續約記錄將在此顯示。如有任何問題，請聯絡客服協助。
        </p>
      </div>
    </div>
  )
}
