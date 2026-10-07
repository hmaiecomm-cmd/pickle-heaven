'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { addRestrictionAction, revokeRestrictionAction } from '@/server/member-admin-actions'

interface Row {
  id: string
  label: string
  reason: string
  createdAt: string
  createdBy: string
  expiresAt: string | null
  revoked: string | null
  active: boolean
}

export function RestrictionPanel({ userId, canEdit, rows }: { userId: string; canEdit: boolean; rows: Row[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [type, setType] = React.useState<'BLACKLIST' | 'NO_ACTIVITY'>('NO_ACTIVITY')
  const [reason, setReason] = React.useState('')
  const [days, setDays] = React.useState(30)
  const [busy, setBusy] = React.useState(false)
  const [revoking, setRevoking] = React.useState<Record<string, string>>({})

  const add = async () => {
    if (!window.confirm(`確定對這位會員設定「${type === 'BLACKLIST' ? '黑名單' : '禁止報名活動'}」？此操作會記入操作紀錄。`)) return
    setBusy(true)
    const res = await addRestrictionAction({ userId, type, reason, days })
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    setReason('')
    router.refresh()
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">會員限制</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">沒有限制紀錄</p> : (
        <ul className="mt-2 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-zinc-50 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={r.active ? 'red' : 'gray'}>{r.active ? '生效中' : '已解除／過期'}</Pill>
                <span className="font-medium">{r.label}</span>
                <span className="text-[11px] text-muted">{r.createdAt}・{r.createdBy}{r.expiresAt ? `・到期 ${r.expiresAt}` : '・無期限'}</span>
              </div>
              <p className="mt-1 text-xs">原因：{r.reason}</p>
              {r.revoked && <p className="text-xs text-muted">解除：{r.revoked}</p>}
              {canEdit && r.active && (
                <div className="mt-1.5 flex gap-2">
                  <input value={revoking[r.id] ?? ''} onChange={(e) => setRevoking({ ...revoking, [r.id]: e.target.value })} placeholder="解除原因" className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 text-xs" aria-label="解除原因" />
                  <button
                    type="button"
                    disabled={!revoking[r.id]?.trim()}
                    onClick={async () => {
                      const res = await revokeRestrictionAction(r.id, revoking[r.id] ?? '')
                      if (!res.ok) toast(res.error, 'error')
                      else router.refresh()
                    }}
                    className="h-8 rounded-lg border border-zinc-300 px-2 text-xs disabled:opacity-40"
                  >
                    解除限制
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-zinc-300 p-3 sm:grid-cols-[auto_1fr_auto_auto]">
          <select value={type} onChange={(e) => setType(e.target.value as 'BLACKLIST')} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="限制類型">
            <option value="NO_ACTIVITY">禁止報名活動</option>
            <option value="BLACKLIST">黑名單（禁止線上預約與報名）</option>
          </select>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="原因（必填，會記錄）" className="h-9 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="限制原因" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="期限">
            <option value={7}>7 天</option>
            <option value={30}>30 天</option>
            <option value={90}>90 天</option>
            <option value={0}>無期限</option>
          </select>
          <button type="button" disabled={busy || reason.trim().length < 2} onClick={add} className="h-9 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-40">設定限制</button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">目前帳號沒有設定會員限制的權限。</p>
      )}
    </section>
  )
}
