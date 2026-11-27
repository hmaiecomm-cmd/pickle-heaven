'use client'

import { FeatureSubscription, FeatureModule } from '@prisma/client'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { AlertCircle, Calendar, DollarSign, CheckCircle, Clock } from 'lucide-react'
import { useState } from 'react'
import { disableAutoRenewal, enableAutoRenewal, processRenewal } from './renewal-actions'

interface RenewalInfoCardProps {
  subscription: FeatureSubscription & { featureModule: FeatureModule }
  onUpdate?: () => void
}

export function RenewalInfoCard({ subscription, onUpdate }: RenewalInfoCardProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const hasPaymentFailure =
    subscription.status === 'GRACE_PERIOD' || subscription.status === 'RENEWAL_FAILED' || subscription.status === 'PENDING_PAYMENT'
  const isExpiringSoon =
    new Date() > new Date(subscription.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000)

  const handleToggleAutoRenewal = async (enable: boolean) => {
    setLoading(true)
    setMessage(null)

    try {
      if (enable) {
        await enableAutoRenewal(subscription.id)
        setMessage({ type: 'success', text: '已啟用自動續約' })
      } else {
        await disableAutoRenewal(subscription.id)
        setMessage({ type: 'success', text: '已關閉自動續約' })
      }
      onUpdate?.()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '操作失敗',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleManualRenewal = async () => {
    setLoading(true)
    setMessage(null)

    try {
      await processRenewal(subscription.id)
      setMessage({ type: 'success', text: '已提交續約申請' })
      onUpdate?.()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '續約失敗',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      {/* 狀態頭部 */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm">{subscription.featureModule.name}</h3>
          <p className="text-xs text-gray-600 mt-1">方案詳情 & 續約設定</p>
        </div>

        {/* 狀態徽章 */}
        {subscription.autoRenew && subscription.status === 'ACTIVE' && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200">
            <CheckCircle className="w-3 h-3 text-green-600" />
            <span className="text-xs text-green-700">自動續約已啟用</span>
          </div>
        )}
        {hasPaymentFailure && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 border border-red-200">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span className="text-xs text-red-700">支付失敗</span>
          </div>
        )}
        {isExpiringSoon && !subscription.autoRenew && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 border border-orange-200">
            <Clock className="w-3 h-3 text-orange-600" />
            <span className="text-xs text-orange-700">即將到期</span>
          </div>
        )}
      </div>

      {/* 資訊行 */}
      <div className="grid grid-cols-2 gap-3 py-2 border-t border-b">
        {/* 訂閱到期日 */}
        <div>
          <p className="text-xs text-gray-600">訂閱到期日</p>
          <div className="flex items-center gap-1 mt-1">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">
              {format(new Date(subscription.expiresAt), 'yyyy年M月d日', { locale: zhTW })}
            </span>
          </div>
        </div>

        {/* 續約金額 */}
        <div>
          <p className="text-xs text-gray-600">續約金額（12 個月）</p>
          <div className="flex items-center gap-1 mt-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">
              NT${subscription.featureModule.yearlyPrice / 100}
            </span>
          </div>
        </div>
      </div>

      {/* 支付失敗恢復訊息 */}
      {hasPaymentFailure && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-medium text-red-900">
            💳 {subscription.renewalFailReason || '支付失敗，請更新支付方式'}
          </p>
          <p className="text-xs text-red-800 mt-1">
            我們已進入 {subscription.gracePeriodDays} 天寬限期，請盡快更新支付方式以完成續約。
          </p>
        </div>
      )}

      {/* 自動續約切換 */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
        <div>
          <p className="text-sm font-medium">自動續約</p>
          <p className="text-xs text-gray-600">
            {subscription.autoRenew
              ? subscription.nextRenewalAt
                ? `下次續約日期：${format(new Date(subscription.nextRenewalAt), 'yyyy年M月d日', { locale: zhTW })}`
                : '已啟用'
              : '未啟用'}
          </p>
        </div>

        <button
          onClick={() => handleToggleAutoRenewal(!subscription.autoRenew)}
          disabled={loading}
          className={`px-3 py-1 rounded text-sm font-medium transition ${
            subscription.autoRenew
              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-50'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50'
          }`}
        >
          {loading ? '處理中...' : subscription.autoRenew ? '關閉' : '啟用'}
        </button>
      </div>

      {/* 手動續約按鈕（若未啟用自動或已過期） */}
      {(!subscription.autoRenew || isExpiringSoon) && (
        <button
          onClick={handleManualRenewal}
          disabled={loading}
          className="w-full px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? '處理中...' : '立即續約'}
        </button>
      )}

      {/* 訊息顯示 */}
      {message && (
        <div
          className={`p-2 rounded text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 底部提示 */}
      <p className="text-xs text-gray-500">
        💡 啟用自動續約後，我們會在訂閱到期前 7 天自動扣款。請確保已綁定有效支付方式。
      </p>
    </div>
  )
}
