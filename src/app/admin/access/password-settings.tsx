'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Pill } from '@/components/admin/page-bits'
import { cn } from '@/lib/utils'
import { updatePasswordSettingsAction } from './actions'

export interface PasswordSettings {
  passwordGenerationMode: 'DAILY' | 'HOURLY' | 'SPLIT_DAY'
  passwordBookAheadDaysOverride: number | null
}

const MODE_LABELS: Record<PasswordSettings['passwordGenerationMode'], { label: string; desc: string }> = {
  DAILY: { label: '每天一組密碼', desc: '同一天使用同一組預約密碼。' },
  HOURLY: { label: '每小時一組密碼', desc: '依照預約所在小時產生密碼。' },
  SPLIT_DAY: { label: '上下午各一組密碼', desc: '上午與下午分別使用不同密碼。' },
}

export function PasswordSettings({ settings, defaultBookAheadDays }: { settings: PasswordSettings; defaultBookAheadDays: number }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [showCustomRules, setShowCustomRules] = React.useState(false)
  const [mode, setMode] = React.useState<PasswordSettings['passwordGenerationMode']>(settings.passwordGenerationMode)
  const [customDays, setCustomDays] = React.useState<number | ''>(() => {
    const val = settings.passwordBookAheadDaysOverride
    return val !== null ? val : ''
  })
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    setBusy(true)

    try {
      const days = customDays === '' ? null : Number(customDays) || null
      const result = await updatePasswordSettingsAction({
        passwordGenerationMode: mode,
        passwordBookAheadDaysOverride: days,
      })

      if (result.ok) {
        setSuccess(result.message)
        setShowCustomRules(false)
        setTimeout(() => router.refresh(), 1000)
      } else {
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    setMode(settings.passwordGenerationMode)
    setCustomDays(settings.passwordBookAheadDaysOverride !== null ? settings.passwordBookAheadDaysOverride : '')
    setShowCustomRules(false)
    setError(null)
  }

  const currentModeLabel = MODE_LABELS[mode]

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">預約密碼設定</h2>

      {/* 密碼產生模式 */}
      <div className="mt-4 space-y-2">
        <label htmlFor="pwd-mode" className="block text-xs font-semibold text-zinc-700">
          密碼產生模式
        </label>
        <select
          id="pwd-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as PasswordSettings['passwordGenerationMode'])}
          disabled={busy}
          className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
        >
          {(Object.entries(MODE_LABELS) as [PasswordSettings['passwordGenerationMode'], typeof MODE_LABELS[never]][]).map(([k, { label }]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">{currentModeLabel.desc}</p>
      </div>

      {/* 固定的失效規則 */}
      <div className="mt-4 space-y-1 rounded-lg bg-zinc-50 p-3">
        <div className="text-xs font-semibold text-zinc-700">密碼失效規則（固定啟用）</div>
        <div className="space-y-1 text-xs text-zinc-600">
          <p>✓ 取消預約後：密碼立即失效</p>
          <p>✓ 退款完成後：密碼立即失效</p>
        </div>
      </div>

      {/* 自訂密碼規則按鈕 */}
      {!showCustomRules && (
        <button
          type="button"
          onClick={() => setShowCustomRules(true)}
          disabled={busy}
          className="mt-3 flex items-center gap-2 text-sm font-medium text-[#1f4d34] hover:text-[#163a27]"
        >
          <Plus className="h-4 w-4" />
          新增自訂密碼規則
        </button>
      )}

      {/* 自訂密碼規則展開區 */}
      {showCustomRules && (
        <div className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div>
            <p className="text-xs font-semibold text-zinc-700">自訂密碼規則（可選填）</p>
            <p className="mt-0.5 text-xs text-muted">可選填：設定顧客最早可以提前幾天預約。未填寫時，沿用場館目前的預約開放設定。</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="pwd-ahead-days" className="block text-xs font-semibold text-zinc-700">
              預約開放提前天數
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="pwd-ahead-days"
                type="number"
                min="1"
                max="365"
                value={customDays}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomDays(val === '' ? '' : Math.max(1, Math.min(365, Number(val) || 0)))
                }}
                placeholder={`預設：${defaultBookAheadDays} 天`}
                disabled={busy}
                className="flex-1"
              />
              <span className="text-xs text-muted">天</span>
            </div>
          </div>

          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {success && <p role="status" className="text-xs text-emerald-700">{success}</p>}

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleSave}
              loading={busy}
              className="flex-1"
            >
              儲存自訂規則
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCancel}
              disabled={busy}
              className="flex-1"
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 儲存主設定按鈕（主頁面層級） */}
      {!showCustomRules && (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            loading={busy}
            disabled={mode === settings.passwordGenerationMode}
          >
            儲存設定
          </Button>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {success && <p role="status" className="text-xs text-emerald-700">{success}</p>}
        </div>
      )}
    </section>
  )
}
