'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { updatePasswordSettingsAction } from './actions'

export interface PasswordSettings {
  generationMode: string
  passwordLength: number
  generateAheadDays: number
  passwordOpenTime: string
  passwordOpenCustomMinutes: number | null
  passwordExpireTime: string
  lockWhenNoOrders: boolean
  allowSharedPassword: boolean
  passwordBookAheadDaysOverride: number | null
  basicMemberBookAheadDays: number | null
  pointsMemberBookAheadDays: number | null
  vipMemberBookAheadDays: number | null
}

const MODE_LABELS: Record<string, { label: string; desc: string }> = {
  SPLIT_DAY: { label: '上午一組、下午一組密碼', desc: '以 12:00 為界，上午與下午各一組，同時段訂單共用。' },
  DAILY: { label: '每天一組密碼', desc: '同一天的所有訂單共用同一組密碼。' },
  HOURLY: { label: '每小時一組密碼', desc: '依預約所在的整點時段各一組。' },
  PER_ORDER: { label: '每筆預訂單獨立密碼', desc: '每筆訂單一組專屬密碼。' },
}

const PASSWORD_LENGTH_OPTIONS = [4, 6, 8, 10] as const

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
const memberOptions = [
  { key: 'basicMemberBookAheadDays', label: '普通會員' },
  { key: 'pointsMemberBookAheadDays', label: '點數會員' },
  { key: 'vipMemberBookAheadDays', label: 'VIP 會員' },
] as const

export function PasswordSettings({ settings, defaultBookAheadDays, isSuperAdmin }: { settings: PasswordSettings; defaultBookAheadDays: number; isSuperAdmin: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [form, setForm] = React.useState<PasswordSettings>(settings)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  const set = <K extends keyof PasswordSettings>(k: K, v: PasswordSettings[K]) => {
    if (!isSuperAdmin) return
    setForm((f) => ({ ...f, [k]: v }))
  }
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
    setError(null)
  }

  return (
    <div className="space-y-5">
      {/* 頁面標題 */}
      <div>
        <h2 className="text-lg font-semibold">預約密碼設定</h2>
        <p className="mt-1 text-sm text-muted">付款成功後，系統會依照以下規則產生時段密碼，並透過 LINE 或現有通知流程提供給符合資格的顧客。</p>
      </div>

      {/* 步驟 1：密碼規則 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">步驟 1｜密碼規則</h3>
          <p className="mt-1 text-xs text-muted">設定密碼的產生方式與密碼長度，不提供自訂密碼規則。</p>
        </div>

        <div className="space-y-4">
          {/* 密碼產生方式 */}
          <div className="space-y-2">
            <label htmlFor="pwd-mode" className="block text-xs font-semibold text-zinc-700">
              密碼產生方式
            </label>
            <select
              id="pwd-mode"
              value={form.generationMode}
              onChange={(e) => set('generationMode', e.target.value)}
              disabled={busy || !isSuperAdmin}
              className={selectCls}
            >
              {Object.entries(MODE_LABELS).map(([k, { label }]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">{MODE_LABELS[form.generationMode]?.desc}</p>
          </div>

          {/* 密碼長度 */}
          <div className="space-y-2">
            <label htmlFor="pwd-length" className="block text-xs font-semibold text-zinc-700">
              密碼長度
            </label>
            <select
              id="pwd-length"
              value={form.passwordLength}
              onChange={(e) => set('passwordLength', Number(e.target.value))}
              disabled={busy || !isSuperAdmin}
              className={selectCls}
            >
              {PASSWORD_LENGTH_OPTIONS.map((len) => (
                <option key={len} value={len}>
                  {len} 碼
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">顧客輸入密碼時需要的位數，預設為 6 碼。</p>
          </div>
        </div>
      </section>

      {/* 步驟 2：有效期限 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">步驟 2｜有效期限</h3>
          <p className="mt-1 text-xs text-muted">設定預約密碼何時開始產生，以及何時失效。</p>
        </div>

        <div className="space-y-4">
          {/* 密碼失效方式 */}
          <div className="space-y-2">
            <label htmlFor="pwd-expire-mode" className="block text-xs font-semibold text-zinc-700">
              密碼失效方式
            </label>
            <select
              id="pwd-expire-mode"
              value={form.passwordExpireTime}
              onChange={(e) => set('passwordExpireTime', e.target.value)}
              disabled={busy || !isSuperAdmin}
              className={selectCls}
            >
              {Object.entries(EXPIRE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">依照預約結束時間自動計算密碼何時失效。</p>
          </div>

          {/* 密碼提前產生天數 */}
          <div className="space-y-2">
            <label htmlFor="pwd-gen-ahead" className="block text-xs font-semibold text-zinc-700">
              密碼提前產生天數
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="pwd-gen-ahead"
                type="number"
                min="0"
                max="30"
                value={form.generateAheadDays}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!isNaN(v)) set('generateAheadDays', Math.max(0, Math.min(30, v)))
                }}
                disabled={busy || !isSuperAdmin}
                className="w-24"
                aria-label="密碼提前產生天數"
              />
              <span className="text-xs text-muted">天</span>
            </div>
            <p className="text-xs text-muted">排程會預先為這段期間內已付款的訂單建立時段密碼。</p>
          </div>

          {/* 鎖定與共用選項 */}
          <div className="space-y-3 rounded-lg bg-zinc-50 p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.lockWhenNoOrders}
                onChange={(e) => set('lockWhenNoOrders', e.target.checked)}
                disabled={busy || !isSuperAdmin}
              />
              <span>
                無有效訂單時立即鎖定時段
                <span className="block text-xs text-muted">時段內所有訂單都取消、退款或付款失敗後，該時段密碼即使輸入也不能開門。</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.allowSharedPassword}
                onChange={(e) => set('allowSharedPassword', e.target.checked)}
                disabled={busy || !isSuperAdmin}
              />
              <span>
                允許同一時段多筆訂單共用密碼
                <span className="block text-xs text-muted">關閉時，一律改為每筆訂單獨立密碼。</span>
              </span>
            </label>
            {shared && (
              <p className="text-xs text-amber-700">⚠ 共用密碼時，門鎖無法分辨是哪位顧客輸入，已取消的顧客若記得密碼仍可能開門。</p>
            )}
          </div>
        </div>
      </section>

      {/* 步驟 3：會員預約權限 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">步驟 3｜會員預約提前天數</h3>
          <p className="mt-1 text-xs text-muted">設定不同會員等級可以比一般開放時間提前幾天預約。</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberOptions.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <label htmlFor={key} className="block text-xs font-semibold text-zinc-700">
                {label}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={key}
                  type="number"
                  min="0"
                  max="365"
                  value={form[key] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    set(key, v === '' ? null : Math.max(0, Math.min(365, Number(v) || 0)))
                  }}
                  placeholder={`預設：${defaultBookAheadDays}`}
                  disabled={busy || !isSuperAdmin}
                  className="flex-1"
                  aria-label={`${label}可提前預約天數`}
                />
                <span className="text-xs text-muted">天</span>
              </div>
              <p className="text-xs text-muted">可提前此天數預約，不填時沿用場館預設 ({defaultBookAheadDays} 天)。</p>
            </div>
          ))}
        </div>
      </section>

      {/* 權限提示（非高級管理者） */}
      {!isSuperAdmin && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">🔒 密碼設定權限限制</p>
          <p className="mt-1">只有高級管理者可以修改密碼產生方式、有效期限與會員預約天數。您目前可以查看密碼時段記錄，但無法編輯設定。</p>
        </div>
      )}

      {/* 儲存按鈕與訊息 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          size="sm"
          onClick={handleSave}
          loading={busy}
          disabled={!dirty || busy || !isSuperAdmin}
          className="sm:w-auto"
        >
          {busy ? '儲存中…' : '儲存密碼設定'}
        </Button>
        {dirty && (
          <Button size="sm" variant="secondary" onClick={handleCancel} disabled={busy || !isSuperAdmin} className="sm:w-auto">
            還原
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700">
            ❌ {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-emerald-700">
            ✓ {success}
          </p>
        )}
      </div>
    </div>
  )
}
