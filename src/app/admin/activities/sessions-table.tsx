'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ban, Pencil, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { EditImpactRow } from '@/server/activity-admin'
import { applySessionEditAction, cancelSessionAction, previewSessionEditAction } from '@/server/activity-admin-actions'
import { CoverUploader } from './cover-uploader'

export interface AdminSessionRow {
  id: string
  date: string
  dateLabel: string
  startMinute: number
  endMinute: number
  timeLabel: string
  courtIds: string[]
  courtNames: string[]
  price: number
  capacity: number
  used: number
  confirmed: number
  status: string
  ended: boolean
  editable: boolean
  occupied: boolean
  title: string
  description: string | null
  coverAssetId: string | null
  coverFocusX: number | null
  coverFocusY: number | null
  opensAt: string
  cancelReason: string | null
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿保留',
  SCHEDULED: '未開放報名',
  OPEN: '報名中',
  FULL: '已額滿',
  LOCKED: '已截止',
  PLAYING: '進行中',
  COMPLETED: '已結束',
  CANCELLED: '已取消',
}

const fmt = (m: number) => (m === 1440 ? '24:00' : `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)

export function SessionsTable({
  activityId,
  repeat,
  sessions,
  courts,
  venue,
  typeLabel,
}: {
  activityId: string
  repeat: boolean
  sessions: AdminSessionRow[]
  courts: { id: string; name: string; active: boolean }[]
  venue: { openMinute: number; closeMinute: number; slotMinutes: number }
  typeLabel: string
}) {
  const [editing, setEditing] = React.useState<AdminSessionRow | null>(null)
  const [cancelling, setCancelling] = React.useState<AdminSessionRow | null>(null)
  const [showPast, setShowPast] = React.useState(false)
  const rows = sessions.filter((s) => showPast || !s.ended)

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">場次（每個日期獨立名額與訂單）</h2>
            <p className="text-xs text-muted">已結束、已取消的場次保留歷史，不能修改</p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
            顯示已結束場次
          </label>
        </div>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">尚未建立場次。預覽後發布即可建立。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[rgb(var(--border))]">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 font-medium">時間</th>
                  <th className="px-3 py-2 font-medium">場地</th>
                  <th className="px-3 py-2 text-right font-medium">價格</th>
                  <th className="px-3 py-2 text-right font-medium">已報名／暫留／名額</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {rows.map((s) => (
                  <tr key={s.id} className={cn(s.status === 'CANCELLED' && 'text-muted')}>
                    <td className="px-3 py-2 whitespace-nowrap">{s.dateLabel}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular">{s.timeLabel}</td>
                    <td className="px-3 py-2">
                      {s.courtNames.join('、') || '—'}
                      {!s.occupied && s.status !== 'CANCELLED' && !s.ended && (
                        <span className="ml-1 rounded bg-amber-50 px-1 text-[11px] text-amber-800">未佔用場地</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular">NT${s.price.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular">
                      {s.confirmed}／{Math.max(0, s.used - s.confirmed)}／{s.capacity}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.ended && s.status !== 'CANCELLED' ? '已結束' : (STATUS_LABEL[s.status] ?? s.status)}
                      {s.cancelReason && s.status === 'CANCELLED' && <span className="block text-muted">{s.cancelReason}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Link href={`/admin/sessions/${s.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs hover:bg-zinc-100" aria-label={`${s.dateLabel} 名單`}>
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          名單
                        </Link>
                        {s.editable && (
                          <>
                            <button type="button" onClick={() => setEditing(s)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs hover:bg-zinc-100">
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              修改
                            </button>
                            <button type="button" onClick={() => setCancelling(s)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs text-red-700 hover:bg-red-50">
                              <Ban className="h-3.5 w-3.5" aria-hidden />
                              取消
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {editing && (
        <EditSheet
          key={editing.id}
          session={editing}
          repeat={repeat}
          activityId={activityId}
          courts={courts}
          venue={venue}
          typeLabel={typeLabel}
          onClose={() => setEditing(null)}
        />
      )}
      {cancelling && <CancelSheet session={cancelling} activityId={activityId} onClose={() => setCancelling(null)} />}
    </Card>
  )
}

function EditSheet({
  session,
  repeat,
  activityId,
  courts,
  venue,
  typeLabel,
  onClose,
}: {
  session: AdminSessionRow
  repeat: boolean
  activityId: string
  courts: { id: string; name: string; active: boolean }[]
  venue: { openMinute: number; closeMinute: number; slotMinutes: number }
  typeLabel: string
  onClose: () => void
}) {
  const router = useRouter()
  const { toast } = useToast()
  const initial = {
    title: session.title,
    description: session.description ?? '',
    price: session.price,
    capacity: session.capacity,
    startMinute: session.startMinute,
    endMinute: session.endMinute,
    courtIds: [...session.courtIds].sort(),
    cover: { assetId: session.coverAssetId, focusX: session.coverFocusX ?? 50, focusY: session.coverFocusY ?? 50 },
  }
  const [f, setF] = React.useState(initial)
  const [scope, setScope] = React.useState<'ONE' | 'FOLLOWING' | 'ALL'>('ONE')
  const [impact, setImpact] = React.useState<EditImpactRow[] | null>(null)
  const [confirmAffected, setConfirmAffected] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const changes = React.useMemo(() => {
    const c: Record<string, unknown> = {}
    if (f.title !== initial.title) c.title = f.title
    if (f.description !== initial.description) c.description = f.description || null
    if (f.price !== initial.price) c.price = f.price
    if (f.capacity !== initial.capacity) c.capacity = f.capacity
    if (f.startMinute !== initial.startMinute) c.startMinute = f.startMinute
    if (f.endMinute !== initial.endMinute) c.endMinute = f.endMinute
    if ([...f.courtIds].sort().join(',') !== initial.courtIds.join(',')) c.courtIds = f.courtIds
    if (f.cover.assetId !== initial.cover.assetId || f.cover.focusX !== initial.cover.focusX || f.cover.focusY !== initial.cover.focusY) {
      c.coverAssetId = f.cover.assetId
      c.coverFocusX = f.cover.assetId ? f.cover.focusX : null
      c.coverFocusY = f.cover.assetId ? f.cover.focusY : null
    }
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])
  const dirty = Object.keys(changes).length > 0

  // 任何變動後，預覽需重做
  React.useEffect(() => {
    setImpact(null)
    setConfirmAffected(false)
  }, [f, scope])

  const slotOptions: number[] = []
  for (let m = venue.openMinute; m <= venue.closeMinute; m += Math.min(30, venue.slotMinutes)) slotOptions.push(m)

  const input = { sessionId: session.id, scope, changes }
  const affectedTotal = impact?.reduce((n, r) => n + (r.ok ? r.affected.length : 0), 0) ?? 0

  const runPreview = async () => {
    setBusy(true)
    try {
      const res = await previewSessionEditAction(input)
      if (!res.ok) toast(res.message, 'error')
      else setImpact(res.rows)
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    setBusy(true)
    try {
      const res = await applySessionEditAction(input, confirmAffected, activityId)
      if (!res.ok) return toast(res.message, 'error')
      toast(res.message ?? '已修改', res.skipped.length > 0 ? 'info' : 'success')
      router.refresh()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const sel = 'h-10 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-sm'
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={`修改場次・${session.dateLabel}`} description="價格只影響之後的新訂單；已成立訂單的金額不會改變" className="sm:w-[min(40rem,94vw)]">
        <div className="space-y-4">
          {repeat && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">套用範圍</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ['ONE', '只改本場'],
                    ['FOLLOWING', '本場及後續場次'],
                    ['ALL', '整個系列可修改的場次'],
                  ] as const
                ).map(([v, label]) => (
                  <label key={v} className={cn('flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm', scope === v ? 'border-brand-600 bg-brand-50' : 'border-[rgb(var(--border))]')}>
                    <input type="radio" name="scope" checked={scope === v} onChange={() => setScope(v)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <Field label="名稱" htmlFor="e-title">
            <Input id="e-title" value={f.title} maxLength={60} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="價格（NT$）" htmlFor="e-price">
              <Input id="e-price" type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
            </Field>
            <Field label="一般名額" htmlFor="e-cap" hint={`目前已用 ${session.used}`}>
              <Input id="e-cap" type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} />
            </Field>
            <Field label="開始" htmlFor="e-st">
              <select id="e-st" className={sel} value={f.startMinute} onChange={(e) => setF({ ...f, startMinute: Number(e.target.value) })}>
                {slotOptions.slice(0, -1).map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="結束" htmlFor="e-et">
              <select id="e-et" className={sel} value={f.endMinute} onChange={(e) => setF({ ...f, endMinute: Number(e.target.value) })}>
                {slotOptions.filter((m) => m > f.startMinute).map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">使用場地</legend>
            <div className="flex flex-wrap gap-2">
              {courts.map((c) => (
                <label key={c.id} className={cn('flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm', f.courtIds.includes(c.id) ? 'border-brand-600 bg-brand-50' : 'border-[rgb(var(--border))]', !c.active && 'opacity-50')}>
                  <input
                    type="checkbox"
                    disabled={!c.active}
                    checked={f.courtIds.includes(c.id)}
                    onChange={(e) => setF({ ...f, courtIds: e.target.checked ? [...f.courtIds, c.id] : f.courtIds.filter((x) => x !== c.id) })}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="本場介紹（留空沿用活動介紹）" htmlFor="e-desc">
            <Textarea id="e-desc" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">本場封面（未上傳則沿用活動封面）</p>
            <CoverUploader
              assetId={f.cover.assetId}
              focusX={f.cover.focusX}
              focusY={f.cover.focusY}
              typeLabel={typeLabel}
              emptyLabel="沿用活動封面"
              onChange={(v) => setF({ ...f, cover: v })}
            />
          </div>

          {impact && (
            <div className="space-y-2 rounded-xl border border-[rgb(var(--border))] p-3">
              <p className="text-sm font-semibold">影響預覽（{impact.filter((r) => r.ok).length} 場可套用／{impact.filter((r) => !r.ok).length} 場不可套用）</p>
              <ul className="max-h-60 space-y-2 overflow-auto text-xs">
                {impact.map((r) => (
                  <li key={r.sessionId} className={cn('rounded-lg px-2 py-1.5', r.ok ? 'bg-zinc-50' : 'bg-red-50 text-red-800')}>
                    <span className="font-medium">
                      {r.dateLabel} {r.timeLabel}
                    </span>
                    {!r.ok && <span>：{[...r.problems, ...r.conflicts.map((c) => `${c.courtName} ${c.reason}`)].join('；')}（不會修改）</span>}
                    {r.affected.length > 0 && (
                      <span className="block text-amber-800">
                        受影響報名者：{r.affected.map((a) => `${a.name}（${a.status} ${a.quantity}）`).join('、')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {affectedTotal > 0 && (
                <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                  <input type="checkbox" checked={confirmAffected} onChange={(e) => setConfirmAffected(e.target.checked)} />
                  我已確認上述 {affectedTotal} 筆報名受影響。套用後系統會以 LINE 通知（未綁定或未設定推播者會記錄為通知失敗，請另行聯絡）；訂單時間與場地會更新，金額不變；需要退款者請會員自行取消或改用「取消場次」。
                </label>
              )}
            </div>
          )}

          <div className="flex gap-2 border-t border-[rgb(var(--border))] pt-4">
            <Button size="sm" variant="secondary" loading={busy && !impact} disabled={!dirty} onClick={runPreview}>
              預覽影響
            </Button>
            <Button
              size="sm"
              loading={busy && Boolean(impact)}
              disabled={!impact || impact.every((r) => !r.ok) || (affectedTotal > 0 && !confirmAffected)}
              onClick={apply}
            >
              確認套用
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              取消
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CancelSheet({ session, activityId, onClose }: { session: AdminSessionRow; activityId: string; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [reason, setReason] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={`取消場次・${session.dateLabel} ${session.timeLabel}`} description="取消後釋放場地；已付款者全額退款並通知，待付款訂單整張取消。場次紀錄保留。">
        <div className="space-y-4">
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            目前已報名 {session.confirmed} 位、暫留或待付款 {Math.max(0, session.used - session.confirmed)} 位。
          </p>
          <Field label="取消原因（會通知報名者）" htmlFor="c-reason">
            <Input id="c-reason" value={reason} maxLength={100} placeholder="例：颱風停課" onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const res = await cancelSessionAction(session.id, reason, activityId)
                  toast(res.message ?? '', res.ok ? 'success' : 'error')
                  if (res.ok) {
                    router.refresh()
                    onClose()
                  }
                } finally {
                  setBusy(false)
                }
              }}
            >
              確認取消場次
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              返回
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
