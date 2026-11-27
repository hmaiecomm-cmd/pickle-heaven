'use client'

import { VenuePaymentMethod } from '@prisma/client'
import { CreditCard, Trash2, Check } from 'lucide-react'
import { useState } from 'react'
import { bindPaymentMethod, removePaymentMethod, setDefaultPaymentMethod } from './renewal-actions'

interface PaymentMethodManagerProps {
  paymentMethods: VenuePaymentMethod[]
  onUpdate?: () => void
}

export function PaymentMethodManager({ paymentMethods, onUpdate }: PaymentMethodManagerProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    cardholderName: '',
    cardLastFour: '',
  })

  const handleAddPaymentMethod = async () => {
    if (!formData.cardholderName || !formData.cardLastFour) {
      setMessage({ type: 'error', text: '請填寫所有欄位' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await bindPaymentMethod({
        provider: 'tappay',
        cardLastFour: formData.cardLastFour,
        cardholderName: formData.cardholderName,
        isDefault: paymentMethods.length === 0,
      })

      setMessage({ type: 'success', text: '支付方式已新增' })
      setFormData({ cardholderName: '', cardLastFour: '' })
      setShowAddForm(false)
      onUpdate?.()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '新增失敗',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (methodId: string) => {
    if (!confirm('確定要移除此支付方式嗎？')) return

    setLoading(true)
    setMessage(null)

    try {
      await removePaymentMethod(methodId)
      setMessage({ type: 'success', text: '支付方式已移除' })
      onUpdate?.()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '移除失敗',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSetDefault = async (methodId: string) => {
    setLoading(true)
    setMessage(null)

    try {
      await setDefaultPaymentMethod(methodId)
      setMessage({ type: 'success', text: '已設定為預設支付方式' })
      onUpdate?.()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '設定失敗',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-sm">支付方式管理</h3>
        <p className="text-xs text-gray-600 mt-1">新增、管理與變更自動續約的付款方式</p>
      </div>

      {/* 已新增的支付方式 */}
      {paymentMethods.length > 0 && (
        <div className="space-y-2">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {method.provider === 'tappay' ? 'TapPay' : method.provider.toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-600">
                    {method.cardholderName} • 卡號末 4 碼：{method.cardLastFour}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {method.isDefault && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-200">
                    <Check className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-700">預設</span>
                  </div>
                )}

                <div className="flex gap-2">
                  {!method.isDefault && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      disabled={loading}
                      className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 transition"
                    >
                      設為預設
                    </button>
                  )}

                  <button
                    onClick={() => handleRemove(method.id)}
                    disabled={loading}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增支付方式表單 */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full px-4 py-2 rounded-lg border border-dashed border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
        >
          + 新增支付方式
        </button>
      ) : (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-3">
          <input
            type="text"
            placeholder="持卡人姓名"
            value={formData.cardholderName}
            onChange={(e) => setFormData({ ...formData, cardholderName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />

          <input
            type="text"
            placeholder="卡號末 4 碼"
            value={formData.cardLastFour}
            onChange={(e) => setFormData({ ...formData, cardLastFour: e.target.value })}
            maxLength={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />

          <div className="flex gap-2">
            <button
              onClick={handleAddPaymentMethod}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? '新增中...' : '確認新增'}
            </button>

            <button
              onClick={() => setShowAddForm(false)}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
            >
              取消
            </button>
          </div>
        </div>
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

      {/* 安全提示 */}
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
        <p className="text-xs text-gray-700">
          🔒 <strong>安全提示：</strong>
          我們只會儲存卡號末 4 碼和持卡人姓名，全額支付資訊由 TapPay 安全管理。
        </p>
      </div>
    </div>
  )
}
