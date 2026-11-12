'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { createManualGrantAction, reconcileAction, revokeGrantAction } from './actions'

type R = { ok: true; message: string } | { ok: false; error: string }

function Notice({ r }: { r: R | null }) {
  if (!r) return null
  return (
    <p role="status" className={r.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>
      {r.ok ? r.message : r.error}
    </p>
  )
}

/** datetime-local 的預設值（台北時間），offset 為距現在的分鐘數 */
function localValue(offsetMinutes: number) {
  const d = new Date(Date.now() + offsetMinutes * 60_000 + 8 * 3_600_000)
  return d.toISOString().slice(0, 16)
}

export function ManualGrantForm({ members }: { members: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState<R | null, FormData>(createManualGrantAction, null)
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
          <Notice r={state} />
        </div>
      </form>
    </section>
  )
}

export function RevokeButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [result, setResult] = React.useState<R | null>(null)
  const [pending, start] = React.useTransition()

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        撤銷
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-red-50 p-2 sm:min-w-64">
      <label className="text-xs text-red-800" htmlFor={`revoke-${id}`}>
        撤銷「{name}」的授權，原因（必填）
      </label>
      <Input id={`revoke-${id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          loading={pending}
          disabled={!reason.trim()}
          onClick={() => start(async () => setResult(await revokeGrantAction(id, reason)))}
        >
          確認撤銷
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          取消
        </Button>
      </div>
      <Notice r={result} />
    </div>
  )
}

export function ReconcileButton() {
  const [result, setResult] = React.useState<R | null>(null)
  const [pending, start] = React.useTransition()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" size="sm" loading={pending} onClick={() => start(async () => setResult(await reconcileAction()))}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        重新比對預約授權
      </Button>
      <Notice r={result} />
    </div>
  )
}
