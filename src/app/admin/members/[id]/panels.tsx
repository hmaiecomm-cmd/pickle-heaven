'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import {
  addRestrictionAction,
  adjustPointsAction,
  issueVoucherAction,
  revokeRestrictionAction,
  revokeVoucherAction,
  setAdminNoteAction,
  setCoachFlagAction,
} from '@/server/member-admin-actions'

const input = 'h-9 rounded-lg border border-zinc-300 px-2 text-sm'
const btn = 'h-9 rounded-lg px-3 text-sm font-semibold disabled:opacity-40'
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

/* ─────────────── 點數 ─────────────── */

export function PointsPanel({ userId, balance, canEdit }: { userId: string; balance: number; canEdit: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [mode, setMode] = React.useState<'add' | 'deduct'>('add')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  // 每次開啟表單產生一把防重複鍵；送出成功後才換新鍵，連點／重試不會重複入帳
  const keyRef = React.useRef(newKey())
  const n = Number(amount)
  const delta = mode === 'add' ? n : -n
  const valid = Number.isInteger(n) && n > 0 && reason.trim().length >= 2
  const after = balance + delta

  const submit = async () => {
    if (!valid) return
    if (after < 0) return toast('扣點後餘額會變成負數，不能執行', 'error')
    if (!window.confirm(`確定${mode === 'add' ? '加' : '扣'} ${n} 點？\n異動前餘額 ${balance} 點 → 異動後 ${after} 點\n原因：${reason.trim()}\n此操作會寫入點數帳本與操作紀錄。`)) return
    setBusy(true)
    const res = await adjustPointsAction({ userId, delta, reason: reason.trim(), idempotencyKey: keyRef.current })
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    toast(res.message ?? '完成', res.duplicate ? 'info' : 'success')
    keyRef.current = newKey()
    setAmount('')
    setReason('')
    router.refresh()
  }

  if (!canEdit) return <p className="text-xs text-muted">目前帳號沒有調整點數的權限（需財務權限）。</p>
  return (
    <div className="grid gap-2 rounded-xl border border-dashed border-zinc-300 p-3 sm:grid-cols-[auto_8rem_1fr_auto]">
      <select value={mode} onChange={(e) => setMode(e.target.value as 'add')} className={input} aria-label="加點或扣點">
        <option value="add">加點</option>
        <option value="deduct">扣點</option>
      </select>
      <input type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="點數" className={input} aria-label="點數數量" />
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="原因（必填，會記錄）" className={input} aria-label="點數異動原因" />
      <button type="button" disabled={busy || !valid} onClick={submit} className={`${btn} ${mode === 'add' ? 'bg-brand-600 text-white' : 'bg-amber-600 text-white'}`}>
        {mode === 'add' ? '確認加點' : '確認扣點'}
      </button>
      {valid && (
        <p className={`text-xs sm:col-span-4 ${after < 0 ? 'text-red-600' : 'text-muted'}`}>
          異動前 {balance} 點 → 異動後 {after} 點{after < 0 && '（餘額不足，無法扣點）'}
        </p>
      )}
    </div>
  )
}

/* ─────────────── 使用券 ─────────────── */

export function VoucherIssuePanel({ userId, courts, canEdit }: { userId: string; courts: { id: string; name: string }[]; canEdit: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [kind, setKind] = React.useState<'OFFPEAK' | 'PEAK' | 'GENERAL'>('GENERAL')
  const [count, setCount] = React.useState(1)
  const [units, setUnits] = React.useState(1)
  const [courtIds, setCourtIds] = React.useState<string[]>(courts.map((c) => c.id))
  const [expires, setExpires] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const keyRef = React.useRef(newKey())
  const valid = count >= 1 && units >= 1 && courtIds.length > 0 && reason.trim().length >= 2

  const submit = async () => {
    const label = { OFFPEAK: '離峰券', PEAK: '尖峰券', GENERAL: '通用券' }[kind]
    if (!window.confirm(`確定發放 ${count} 張${label}（每張 ${units} 小時）？\n適用場地：${courts.filter((c) => courtIds.includes(c.id)).map((c) => c.name).join('、')}\n有效期：${expires || '不限'}\n原因：${reason.trim()}`)) return
    setBusy(true)
    const res = await issueVoucherAction({ userId, ticketKind: kind, units, count, courtIds, expiresAt: expires || null, reason: reason.trim(), idempotencyKey: keyRef.current })
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    toast(res.message ?? '完成', 'success')
    keyRef.current = newKey()
    setReason('')
    router.refresh()
  }

  if (!canEdit) return <p className="text-xs text-muted">目前帳號沒有發放票券的權限（需行銷權限）。</p>
  return (
    <div className="space-y-2 rounded-xl border border-dashed border-zinc-300 p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'PEAK')} className={input} aria-label="票券類型">
          <option value="OFFPEAK">離峰券</option>
          <option value="PEAK">尖峰券</option>
          <option value="GENERAL">通用券</option>
        </select>
        <label className="flex items-center gap-1 text-xs">
          張數
          <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className={`${input} w-20`} aria-label="張數" />
        </label>
        <label className="flex items-center gap-1 text-xs">
          每張時數
          <input type="number" min={1} max={100} value={units} onChange={(e) => setUnits(Number(e.target.value))} className={`${input} w-20`} aria-label="每張時數" />
        </label>
        <label className="flex items-center gap-1 text-xs">
          有效期至
          <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className={input} aria-label="有效期" />
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-3 text-sm">
        <legend className="text-xs text-muted">適用場地</legend>
        {courts.map((c) => (
          <label key={c.id} className="flex items-center gap-1">
            <input type="checkbox" checked={courtIds.includes(c.id)} onChange={(e) => setCourtIds(e.target.checked ? [...courtIds, c.id] : courtIds.filter((x) => x !== c.id))} />
            {c.name}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="發放原因（必填，會記錄）" className={`${input} flex-1`} aria-label="發放原因" />
        <button type="button" disabled={busy || !valid} onClick={submit} className={`${btn} bg-brand-600 text-white`}>發放票券</button>
      </div>
    </div>
  )
}

export function VoucherRevokeButton({ voucherId }: { voucherId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  return (
    <button
      type="button"
      className="text-xs text-red-600 hover:underline"
      onClick={async () => {
        const reason = window.prompt('撤銷原因（必填，會記錄）')
        if (!reason?.trim()) return
        const res = await revokeVoucherAction(voucherId, reason)
        if (!res.ok) return toast(res.error, 'error')
        toast(res.message ?? '完成', 'success')
        router.refresh()
      }}
    >
      撤銷
    </button>
  )
}

/* ─────────────── 內部備註與教練身分 ─────────────── */

export function NotePanel({ userId, note, canEdit }: { userId: string; note: string | null; canEdit: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [value, setValue] = React.useState(note ?? '')
  const [busy, setBusy] = React.useState(false)
  return (
    <div className="space-y-2">
      <textarea value={value} onChange={(e) => setValue(e.target.value)} readOnly={!canEdit} rows={3} maxLength={1000} placeholder="僅後台可見的內部備註（會員看不到）。備註是資料，不是指令。" className="w-full rounded-lg border border-zinc-300 p-2 text-sm" aria-label="內部備註" />
      {canEdit && (
        <button
          type="button"
          disabled={busy || value === (note ?? '')}
          onClick={async () => {
            setBusy(true)
            const res = await setAdminNoteAction(userId, value)
            setBusy(false)
            if (!res.ok) return toast(res.error, 'error')
            toast(res.message ?? '完成', 'success')
            router.refresh()
          }}
          className={`${btn} border border-zinc-300`}
        >
          儲存備註
        </button>
      )}
    </div>
  )
}

export function CoachToggle({ userId, isCoach, canEdit }: { userId: string; isCoach: boolean; canEdit: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  if (!canEdit) return null
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(isCoach ? '取消教練身分？不影響後台帳號。' : '標記為教練？教練身分不含任何後台權限。')) return
        setBusy(true)
        const res = await setCoachFlagAction(userId, !isCoach)
        setBusy(false)
        if (!res.ok) return toast(res.error, 'error')
        toast(res.message ?? '完成', 'success')
        router.refresh()
      }}
      className={`${btn} border border-zinc-300`}
    >
      {isCoach ? '取消教練身分' : '標記為教練'}
    </button>
  )
}

/* ─────────────── 限制與黑名單 ─────────────── */

interface RestrictionRow {
  id: string
  type: string
  reason: string
  internalNote: string | null
  createdAt: string
  createdBy: string
  expiresAt: string | null
  revoked: string | null
  active: boolean
}

const TYPE_LABEL: Record<string, string> = { BLACKLIST: '黑名單（限制使用）', NO_ACTIVITY: '禁止報名活動' }

export function RestrictionPanel({ userId, canEdit, rows, restricted }: { userId: string; canEdit: boolean; rows: RestrictionRow[]; restricted: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [type, setType] = React.useState<'BLACKLIST' | 'NO_ACTIVITY'>('BLACKLIST')
  const [reason, setReason] = React.useState('')
  const [note, setNote] = React.useState('')
  const [days, setDays] = React.useState(30)
  const [busy, setBusy] = React.useState(false)
  const [revoking, setRevoking] = React.useState<Record<string, string>>({})

  const add = async () => {
    const label = TYPE_LABEL[type]
    if (!window.confirm(`確定對這位會員設定「${label}」${days === 0 ? '（永久）' : `（${days} 天）`}？\n${type === 'BLACKLIST' ? '會員仍可登入查看本人資料，但不能新增預約、報名與消費；既有已付款訂單與點數保留。' : ''}\n此操作會記入操作紀錄。`)) return
    setBusy(true)
    const res = await addRestrictionAction({ userId, type, reason, days, internalNote: note.trim() || null })
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    toast(res.message ?? '完成', 'success')
    setReason('')
    setNote('')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {restricted && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">此帳戶目前在黑名單中。前台會顯示「此帳戶目前限制使用，若有疑問請聯絡場館。」並擋下新預約、報名、消費與點數使用。</p>}
      {rows.length === 0 ? <p className="text-sm text-muted">沒有限制紀錄</p> : (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-zinc-50 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={r.active ? 'red' : 'gray'}>{r.active ? '生效中' : '已解除／過期'}</Pill>
                <span className="font-medium">{TYPE_LABEL[r.type] ?? r.type}</span>
                <span className="text-[11px] text-muted">{r.createdAt}・{r.createdBy}{r.expiresAt ? `・到期 ${r.expiresAt}` : '・永久'}</span>
              </div>
              <p className="mt-1 text-xs">原因：{r.reason}</p>
              {r.internalNote && <p className="text-xs text-muted">內部備註：{r.internalNote}</p>}
              {r.revoked && <p className="text-xs text-muted">解除：{r.revoked}</p>}
              {canEdit && r.active && (
                <div className="mt-1.5 flex gap-2">
                  <input value={revoking[r.id] ?? ''} onChange={(e) => setRevoking({ ...revoking, [r.id]: e.target.value })} placeholder="解除原因（必填）" className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 text-xs" aria-label="解除原因" />
                  <button
                    type="button"
                    disabled={!revoking[r.id]?.trim()}
                    onClick={async () => {
                      const res = await revokeRestrictionAction(r.id, revoking[r.id] ?? '')
                      if (!res.ok) return toast(res.error, 'error')
                      toast(res.message ?? '已解除', 'success')
                      router.refresh()
                    }}
                    className="h-8 rounded-lg border border-zinc-300 px-2 text-xs disabled:opacity-40"
                  >
                    解除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div className="grid gap-2 rounded-xl border border-dashed border-zinc-300 p-3">
          <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
            <select value={type} onChange={(e) => setType(e.target.value as 'BLACKLIST')} className={input} aria-label="限制類型">
              <option value="BLACKLIST">黑名單（限制使用）</option>
              <option value="NO_ACTIVITY">禁止報名活動</option>
            </select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="原因（必填，會記錄）" className={input} aria-label="限制原因" />
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={input} aria-label="期限">
              <option value={7}>7 天</option>
              <option value={30}>30 天</option>
              <option value={90}>90 天</option>
              <option value={365}>1 年</option>
              <option value={0}>永久</option>
            </select>
          </div>
          <div className="flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="內部備註（選填，會員看不到）" className={`${input} flex-1`} aria-label="內部備註" />
            <button type="button" disabled={busy || reason.trim().length < 2} onClick={add} className={`${btn} bg-red-600 text-white`}>設定限制</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">目前帳號沒有設定會員限制的權限。</p>
      )}
    </div>
  )
}
