'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { createManualGrantAction } from './actions'
import { formatDateTime } from '@/lib/time'

type GrantResult = {
  ok: true
  message: string
  grantId: string
  holderName: string
  userId?: string
  validFrom: string
  validUntil: string
  password: string
  note?: string
} | { ok: false; error: string }

function GrantResultBlock({ r }: { r: GrantResult | null }) {
  const [showPassword, setShowPassword] = React.useState(true)
  const [copied, setCopied] = React.useState(false)

  if (!r || !r.ok) {
    return r && !r.ok ? (
      <p role="alert" className="text-sm text-red-700">
        ❌ {r.error}
      </p>
    ) : null
  }

  const copyToClipboard = async () => {
    const text = `使用人：${r.holderName}\n門禁密碼：${r.password}\n有效時間：${formatDateTime(new Date(r.validFrom))} 至 ${formatDateTime(new Date(r.validUntil))}\n請於有效時間內使用此密碼開啟門禁。`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('複製失敗，請手動複製')
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-900">✓ 授權建立成功</p>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-600">使用人：</span>
          <span className="font-medium">{r.holderName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">有效時間：</span>
          <span className="font-medium">
            {formatDateTime(new Date(r.validFrom))} 至 {formatDateTime(new Date(r.validUntil))}
          </span>
        </div>
        {r.note && (
          <div className="flex justify-between">
            <span className="text-zinc-600">備註：</span>
            <span className="text-zinc-700">{r.note}</span>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-300 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-700">門禁密碼</span>
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-zinc-600 hover:text-zinc-900"
            aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
          >
            {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-lg font-semibold tracking-wider">
            {showPassword ? r.password : '•'.repeat(r.password.length)}
          </code>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={copyToClipboard}
            className="shrink-0"
          >
            <Copy className="h-4 w-4" />
            {copied ? '已複製' : '複製'}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-xs text-emerald-800">
        ⓘ 請於有效時間內將此密碼提供給使用人，逾時後密碼將自動失效。
      </p>
    </div>
  )
}

/** datetime-local 的預設值（台北時間），offset 為距現在的分鐘數 */
function localValue(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000 + 8 * 3_600_000)
  return d.toISOString().slice(0, 16)
}

export function ManualGrantForm({ members }: { members: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<GrantResult | null, FormData>(createManualGrantAction, null)
  const [mode, setMode] = React.useState<'member' | 'guest'>('member')
  const formRef = React.useRef<HTMLFormElement>(null)
  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset()
  }, [state])

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">手動授權</h2>
      <p className="mt-1 text-xs text-muted">給沒有預約、但需要進入球館的人，例如教練、清潔或維修人員。時間以台北時間填寫。</p>

      <div className="mt-3 inline-flex rounded-lg bg-zinc-100 p-0.5 text-sm" role="radiogroup" aria-label="授權對象類型">
        {(
          [
            ['member', '會員'],
            ['guest', '非會員'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            className={mode === k ? 'rounded-md bg-white px-3 py-1 font-medium shadow-sm' : 'px-3 py-1 text-zinc-600'}
          >
            {label}
          </button>
        ))}
      </div>

      <form ref={formRef} action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
        {mode === 'member' ? (
          <Field label="會員" required htmlFor="grant-user">
            <select id="grant-user" name="userId" required className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm">
              <option value="">請選擇會員</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="姓名" required htmlFor="grant-name">
              <Input id="grant-name" name="holderName" maxLength={50} required />
            </Field>
            <Field label="電話" htmlFor="grant-phone">
              <Input id="grant-phone" name="holderPhone" inputMode="tel" maxLength={20} />
            </Field>
          </>
        )}
        <Field label="開始時間" required htmlFor="grant-from">
          <Input id="grant-from" name="validFrom" type="datetime-local" defaultValue={localValue(0)} required />
        </Field>
        <Field label="結束時間" required htmlFor="grant-until">
          <Input id="grant-until" name="validUntil" type="datetime-local" defaultValue={localValue(120)} required />
        </Field>
        <Field label="備註" htmlFor="grant-note">
          <Input id="grant-note" name="note" maxLength={200} placeholder="例如：週三清潔" />
        </Field>
        <div className="flex items-end gap-3 sm:col-span-2">
          <Button type="submit" loading={pending}>
            建立授權
          </Button>
          {state && !state.ok && <p className="text-sm text-red-700">❌ {state.error}</p>}
        </div>
      </form>

      {state?.ok && <GrantResultBlock r={state} />}
    </section>
  )
}

