'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { updatePasswordSettingsAction } from './actions'

export interface PasswordSettings {
  generationMode: string
  generateAheadDays: number
  passwordOpenTime: string
  passwordOpenCustomMinutes: number | null
  passwordExpireTime: string
  lockWhenNoOrders: boolean
  allowSharedPassword: boolean
  passwordBookAheadDaysOverride: number | null
}

const MODE_LABELS: Record<string, { label: string; desc: string }> = {
  SPLIT_DAY: { label: '上午一組、下午一組密碼', desc: '以 12:00 為界，上午（00:00–12:00）與下午（12:00–24:00）各一組，同時段訂單共用。' },
  DAILY: { label: '每天一組密碼', desc: '同一天的所有訂單共用同一組密碼。' },
  HOURLY: { label: '每小時一組密碼', desc: '依預約所在的整點時段各一組，跨小時的預約會收到每個時段的密碼。' },
  PER_ORDER: { label: '每筆預訂單獨立密碼', desc: '每筆訂單一組專屬密碼，不與其他顧客共用；取消後可精確停用該顧客的密碼。' },
}

const OPEN_LABELS: Record<string, string> = {
  '10_MIN_BEFORE': '預約開始前 10 分鐘',
  '30_MIN_BEFORE': '預約開始前 30 分鐘',
  '1_HOUR_BEFORE': '預約開始前 1 小時',
  CUSTOM: '自訂分鐘數',
}

const EXPIRE_LABELS: Record<string, string> = {
  IMMEDIATE: '預約結束立即失效',
  '15_MIN_AFTER': '預約結束後 15 分鐘失效',
  '30_MIN_AFTER': '預約結束後 30 分鐘失效',
  '1_HOUR_AFTER': '預約結束後 1 小時失效',
}

const selectCls = 'h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm'

export function PasswordSettings({ settings, defaultBookAheadDays }: { settings: PasswordSettings; defaultBookAheadDays: number }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [showCustomRules, setShowCustomRules] = React.useState(false)
  const [form, setForm] = React.useState<PasswordSettings>(settings)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const set = <K extends keyof PasswordSettings>(k: K, v: PasswordSettings[K]) => setForm((f) => ({ ...f, [k]: v }))
  const dirty = JSON.stringify(form) !== JSON.stringify(settings)
  const shared = form.allowSharedPassword && form.generationMode !== 'PER_ORDER'

  const handleSave = async () => {
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      const result = await updatePasswordSettingsAction(form)
      if (result.ok) {
        setSuccess(result.message)
        setShowCustomRules(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    setForm(settings)
    setShowCustomRules(false)
    setError(null)
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">預約密碼設定</h2>
      <p className="mt-1 text-xs text-muted">付款成功後依下列規則取得時段密碼，只透過 LINE 發送給付款的顧客。</p>

      {/* 1. 密碼產生方式 */}
      <div className="mt-4 space-y-2">
        <label htmlFor="pwd-mode" className="block text-xs font-semibold text-zinc-700">
          密碼產生方式
        </label>
        <select id="pwd-mode" value={form.generationMode} onChange={(e) => set('generationMode', e.target.value)} disabled={busy} className={selectCls}>
          {Object.entries(MODE_LABELS).map(([k, { label }]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">{MODE_LABELS[form.generationMode]?.desc}</p>
      </div>

      {/* 2. 密碼開放時間 */}
      <div className="mt-4 space-y-2">
        <label htmlFor="pwd-open-time" className="block text-xs font-semibold text-zinc-700">
          密碼開放時間
        </label>
        <select id="pwd-open-time" value={form.passwordOpenTime} onChange={(e) => set('passwordOpenTime', e.target.value)} disabled={busy} className={selectCls}>
          {Object.entries(OPEN_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        {form.passwordOpenTime === 'CUSTOM' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">預約開始前</span>
            <Input
              type="number"
              min="0"
              max="1440"
              value={form.passwordOpenCustomMinutes ?? ''}
              onChange={(e) => set('passwordOpenCustomMinutes', e.target.value === '' ? null : Math.max(0, Math.min(1440, Number(e.target.value) || 0)))}
              disabled={busy}
              className="w-28"
              aria-label="自訂開放分鐘數"
            />
            <span className="text-xs text-muted">分鐘開放</span>
          </div>
        )}
      </div>

      {/* 3. 密碼失效時間 */}
      <div className="mt-4 space-y-2">
        <label htmlFor="pwd-expire-time" className="block text-xs font-semibold text-zinc-700">
          密碼失效時間
        </label>
        <select id="pwd-expire-time" value={form.passwordExpireTime} onChange={(e) => set('passwordExpireTime', e.target.value)} disabled={busy} className={selectCls}>
          {Object.entries(EXPIRE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 4. 密碼提前產生天數 */}
      <div className="mt-4 space-y-2">
        <label htmlFor="pwd-gen-ahead" className="block text-xs font-semibold text-zinc-700">
          密碼提前產生天數
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="pwd-gen-ahead"
            type="number"
            min="1"
            max="30"
            value={form.generateAheadDays}
            onChange={(e) => set('generateAheadDays', Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            disabled={busy}
            className="w-28"
          />
          <span className="text-xs text-muted">天（1～30 天，排程會預先為這段期間內已付款的訂單建立時段密碼）</span>
        </div>
      </div>

      {/* 5、6. 鎖定與共用 */}
      <div className="mt-4 space-y-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={form.lockWhenNoOrders} onChange={(e) => set('lockWhenNoOrders', e.target.checked)} disabled={busy} />
          <span>
            無有效訂單時立即鎖定時段
            <span className="block text-xs text-muted">時段內所有訂單都取消、退款或付款失敗後，該時段密碼即使輸入也不能開門。</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={form.allowSharedPassword} onChange={(e) => set('allowSharedPassword', e.target.checked)} disabled={busy} />
          <span>
            允許同一時段多筆訂單共用密碼
            <span className="block text-xs text-muted">關閉時，一律改為每筆訂單獨立密碼。</span>
          </span>
        </label>
      </div>

      {/* 失效規則說明（含共用密碼的安全限制） */}
      <div className="mt-4 space-y-1 rounded-lg bg-zinc-50 p-3">
        <div className="text-xs font-semibold text-zinc-700">取消、退款與付款失敗</div>
        <div className="space-y-1 text-xs text-zinc-600">
          <p>✓ 只移除該筆訂單的資格，不刪除同時段其他顧客正在使用的密碼。</p>
          <p>✓ 付款失敗、未付款的訂單不會取得密碼。</p>
          <p>✓ 時段已沒有任何有效訂單時，整個時段鎖定。</p>
          {shared && (
            <p className="pt-1 text-amber-800">
              ⚠ 共用密碼的限制：門鎖無法分辨是哪位顧客輸入。同一時段仍有其他有效訂單時，已取消的顧客若記得密碼仍可能開門；需要逐人管控請改用「每筆預訂單獨立密碼」。
            </p>
          )}
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
                value={form.passwordBookAheadDaysOverride ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  set('passwordBookAheadDaysOverride', val === '' ? null : Math.max(1, Math.min(365, Number(val) || 1)))
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
            <Button size="sm" onClick={handleSave} loading={busy} className="flex-1">
              儲存自訂規則
            </Button>
            <Button size="sm" variant="secondary" onClick={handleCancel} disabled={busy} className="flex-1">
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 儲存主設定按鈕 */}
      {!showCustomRules && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleSave} loading={busy} disabled={!dirty}>
            儲存設定
          </Button>
          {dirty && (
            <Button size="sm" variant="secondary" onClick={handleCancel} disabled={busy}>
              還原
            </Button>
          )}
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          {success && <p role="status" className="text-xs text-emerald-700">{success}</p>}
        </div>
      )}
    </section>
  )
}
