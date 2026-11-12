'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { createInviteAction, revokeInviteAction, unbindAction } from './actions'

type R = { ok: true; message: string; link?: string } | { ok: false; error: string }

function Notice({ r }: { r: R | null }) {
  if (!r) return null
  return (
    <p role="status" className={r.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>
      {r.ok ? r.message : r.error}
    </p>
  )
}

const selectCls = 'h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm'

export function InviteForm({ roles, venues }: { roles: { value: string; label: string }[]; venues: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<R | null, FormData>(createInviteAction, null)
  const [copied, setCopied] = React.useState(false)
  const link = state?.ok ? state.link : undefined

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="角色" required htmlFor="inv-role">
        <select id="inv-role" name="role" required className={selectCls}>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="球館範圍" htmlFor="inv-venue">
        <select id="inv-venue" name="venueId" className={selectCls}>
          <option value="">全部球館</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="有效期限" htmlFor="inv-hours">
        <select id="inv-hours" name="hours" defaultValue="72" className={selectCls}>
          <option value="24">24 小時</option>
          <option value="72">3 天</option>
          <option value="168">7 天</option>
        </select>
      </Field>
      <Field label="備註" htmlFor="inv-note">
        <Input id="inv-note" name="note" maxLength={200} placeholder="例如：週末櫃台" />
      </Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={pending}>
          建立邀請連結
        </Button>
        <Notice r={state} />
      </div>
      {link && (
        <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 sm:col-span-2">
          <p className="text-xs font-semibold text-amber-900">邀請連結只會顯示這一次，請現在複製並傳給被邀請人：</p>
          <div className="flex gap-2">
            <input readOnly value={link} aria-label="邀請連結" className="h-9 min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(link).catch(() => {})
                setCopied(true)
              }}
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? '已複製' : '複製'}
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}

function ConfirmAction({ label, confirmLabel, run }: { label: string; confirmLabel: string; run: () => Promise<R> }) {
  const [open, setOpen] = React.useState(false)
  const [result, setResult] = React.useState<R | null>(null)
  const [pending, start] = React.useTransition()
  if (!open)
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
    )
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="danger" loading={pending} onClick={() => start(async () => setResult(await run()))}>
        {confirmLabel}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        取消
      </Button>
      <Notice r={result} />
    </span>
  )
}

export function RevokeInvite({ id }: { id: string }) {
  return <ConfirmAction label="撤銷" confirmLabel="確認撤銷" run={() => revokeInviteAction(id)} />
}

export function Unbind({ id, self }: { id: string; self?: boolean }) {
  return <ConfirmAction label={self ? '解除我的綁定' : '解除綁定'} confirmLabel="確認解除" run={() => unbindAction(id)} />
}
