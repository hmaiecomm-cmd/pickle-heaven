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
  setMembershipLevelAction,
} from '@/server/member-admin-actions'
import { RESTRICTION_TYPES, type RestrictionType, RESTRICTION_OPTIONS } from '@/lib/restriction-types'

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

  if (!canEdit) return <p className="text-xs text-muted">目前帳號沒有調整點數的權限（僅擁有者）。</p>
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

  if (!canEdit) return <p className="text-xs text-muted">目前帳號沒有發放票券的權限（僅擁有者）。</p>
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

/* ─────────────── 會員等級 ─────────────── */

const MEMBERSHIP_LEVEL_LABEL: Record<string, string> = { BASIC: '普通會員', VIP: 'VIP 會員' }

export function MembershipPanel({ userId, currentLevel, canEdit }: { userId: string; currentLevel: string; canEdit: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [level, setLevel] = React.useState(currentLevel)
  const [busy, setBusy] = React.useState(false)

  const submit = async () => {
    if (level === currentLevel) {
      toast('新等級與目前相同', 'info')
      return
    }
    if (!window.confirm(`確定將會員等級更改為「${MEMBERSHIP_LEVEL_LABEL[level] ?? level}」？此操作將記入審計日誌。`)) return
    setBusy(true)
    const res = await setMembershipLevelAction({ userId, level: level as 'BASIC' | 'VIP' })
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    toast(res.message ?? '完成', 'success')
    router.refresh()
  }

  if (!canEdit) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted">目前帳號沒有修改會員等級的權限。</p>
        <p>當前等級：<span className="font-semibold">{MEMBERSHIP_LEVEL_LABEL[currentLevel] ?? currentLevel}</span></p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className={input} aria-label="會員等級">
          <option value="BASIC">普通會員</option>
          <option value="VIP">VIP 會員</option>
        </select>
        <button type="button" disabled={busy || level === currentLevel} onClick={submit} className={`${btn} bg-brand-600 text-white`}>
          更新會員等級
        </button>
      </div>
      <p className="text-xs text-muted">當前等級：<span className="font-semibold">{MEMBERSHIP_LEVEL_LABEL[currentLevel] ?? currentLevel}</span></p>
    </div>
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

export function RestrictionPanel({ userId, canEdit, rows }: { userId: string; canEdit: boolean; rows: RestrictionRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [type, setType] = React.useState<RestrictionType>('BLACKLIST')
  const [reason, setReason] = React.useState('')
  const [note, setNote] = React.useState('')

  // 混合期限設置
  const [limitType, setLimitType] = React.useState<'preset' | 'custom'>('preset')
  const [days, setDays] = React.useState(30)
  const [customDate, setCustomDate] = React.useState('')

  const [busy, setBusy] = React.useState(false)
  const [revoking, setRevoking] = React.useState<Record<string, string>>({})

  const typeConfig = RESTRICTION_TYPES[type]

  const add = async () => {
    if (!reason.trim()) {
      toast('請填寫限制原因', 'error')
      return
    }

    // 計算過期時間
    let expiresAt: string | null = null
    if (limitType === 'preset' && days > 0) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      expiresAt = date.toISOString().split('T')[0]
    } else if (limitType === 'custom' && customDate) {
      expiresAt = customDate
    }

    const msg =
      `確定對這位會員設定「${typeConfig.label}」${expiresAt ? `至 ${expiresAt}` : '永久'}？\n` +
      `說明：${typeConfig.description}\n` +
      `原因：${reason.trim()}\n` +
      `此操作會記入操作紀錄。`

    if (!window.confirm(msg)) return

    setBusy(true)
    const res = await addRestrictionAction({
      userId,
      type,
      reason: reason.trim(),
      expiresAt,
      internalNote: note.trim() || null,
    })
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    toast('已設定限制', 'success')
    setReason('')
    setNote('')
    setCustomDate('')
    setDays(30)
    router.refresh()
  }

  const hasActiveRestriction = rows.some((r) => r.active)

  return (
    <div className="space-y-4">
      {hasActiveRestriction && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm font-medium text-red-900">此會員目前有活躍的限制：</p>
          <ul className="mt-2 space-y-1">
            {rows
              .filter((r) => r.active)
              .map((r) => (
                <li key={r.id} className="text-xs text-red-700">
                  • {RESTRICTION_TYPES[r.type as RestrictionType]?.label ?? r.type}
                  {r.expiresAt && `（至 ${r.expiresAt}）`}
                </li>
              ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted">沒有限制紀錄</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <RestrictionRow key={r.id} row={r} canEdit={canEdit} onRevoke={() => router.refresh()} />
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4">
          <div>
            <label className="block text-xs font-medium mb-2">限制類型</label>
            <select value={type} onChange={(e) => setType(e.target.value as RestrictionType)} className={input}>
              {RESTRICTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">{typeConfig.description}</p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2">限制原因（必填）</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：欠款未清、行為不當、投訴證實等"
              className={input}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2">期限設置</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={limitType === 'preset'} onChange={() => setLimitType('preset')} />
                <span className="text-sm">快速選擇</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={limitType === 'custom'} onChange={() => setLimitType('custom')} />
                <span className="text-sm">自訂日期</span>
              </label>
            </div>

            {limitType === 'preset' ? (
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={input}>
                <option value={7}>7 天</option>
                <option value={30}>30 天</option>
                <option value={90}>90 天</option>
                <option value={365}>1 年</option>
                <option value={0}>永久限制</option>
              </select>
            ) : (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className={input}
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-2">內部備註（選填）</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：案件編號、聯絡紀錄等（會員看不到）"
              className={input}
            />
          </div>

          <button
            type="button"
            disabled={busy || !reason.trim() || (limitType === 'custom' && !customDate)}
            onClick={add}
            className={`${btn} w-full bg-red-600 text-white disabled:opacity-50`}
          >
            {busy ? '設定中...' : '設定限制'}
          </button>
        </div>
      )}
    </div>
  )
}

function RestrictionRow({
  row,
  canEdit,
  onRevoke,
}: {
  row: RestrictionRow
  canEdit: boolean
  onRevoke: () => void
}) {
  const [revoking, setRevoking] = React.useState('')
  const { toast } = useToast()

  return (
    <div className="rounded-lg bg-zinc-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Pill tone={row.active ? 'red' : 'gray'}>{row.active ? '生效中' : '已解除'}</Pill>
        <span className="font-medium">{RESTRICTION_TYPES[row.type as RestrictionType]?.label ?? row.type}</span>
        <span className="text-xs text-muted ml-auto">{row.createdAt}</span>
      </div>

      <div className="space-y-1 text-xs">
        <div>
          <span className="text-muted">原因：</span>
          <span>{row.reason}</span>
        </div>
        {row.expiresAt && (
          <div>
            <span className="text-muted">到期日：</span>
            <span>{row.expiresAt}</span>
          </div>
        )}
        {!row.expiresAt && row.active && <div className="text-muted">永久限制</div>}
        {row.internalNote && (
          <div>
            <span className="text-muted">內部備註：</span>
            <span>{row.internalNote}</span>
          </div>
        )}
        <div className="text-muted">操作人：{row.createdBy}</div>
      </div>

      {canEdit && row.active && (
        <div className="mt-3 flex gap-2">
          <input
            value={revoking}
            onChange={(e) => setRevoking(e.target.value)}
            placeholder="解除原因"
            className={`${input} flex-1 h-8 text-xs`}
          />
          <button
            type="button"
            disabled={!revoking.trim()}
            onClick={async () => {
              const res = await revokeRestrictionAction(row.id, revoking)
              if (!res.ok) return toast(res.error, 'error')
              toast('已解除', 'success')
              onRevoke()
            }}
            className={`${btn} h-8 border border-zinc-300 disabled:opacity-50`}
          >
            解除
          </button>
        </div>
      )}
    </div>
  )
}
