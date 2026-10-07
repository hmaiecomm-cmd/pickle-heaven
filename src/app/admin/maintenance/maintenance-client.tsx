'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Ban, CheckCircle2, Clock, DoorOpen, Play, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { cn } from '@/lib/utils'
import { WEEKDAY_LABELS } from '@/lib/time'
import { shortDateLabel } from '@/lib/activity-shared'
import type { listMaintenance, previewMaintenance } from '@/server/maintenance-admin'
import { courtAvailabilityAction } from '@/server/activity-admin-actions'
import {
  createMaintenanceAction,
  maintenanceCancelAction,
  maintenanceExtendAction,
  maintenancePlanCancelAction,
  maintenanceReleaseAction,
  maintenanceStatusAction,
  previewMaintenanceAction,
} from '@/server/maintenance-admin-actions'

type Data = Awaited<ReturnType<typeof listMaintenance>>
type Preview = Awaited<ReturnType<typeof previewMaintenance>>

const TYPES = [
  ['CLEANING', '清潔'],
  ['DISINFECT', '消毒'],
  ['EQUIPMENT', '設備保養'],
  ['REPAIR', '場地維修'],
] as const

const STATUS_TONE: Record<string, 'gray' | 'blue' | 'green' | 'red' | 'amber'> = { SCHEDULED: 'blue', IN_PROGRESS: 'amber', DONE: 'green', CANCELLED: 'gray' }
const fmt = (m: number) => `${m >= 1440 ? '翌日 ' : ''}${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const sel = 'h-10 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-sm'

/**
 * 清潔／維護排程：內部排程（不開放報名、不進購物車、不顯示價格）。
 * 生效後前台顯示「清潔維護・暫不開放」；完成不釋放封場，提前開放需「提前解除封場」。
 */
export function MaintenanceClient({ data, canManage }: { data: Data; canManage: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [creating, setCreating] = React.useState(false)
  const [extending, setExtending] = React.useState<Data['events'][number] | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [showEnded, setShowEnded] = React.useState(false)

  const run = async (key: string, fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(key)
    try {
      const res = await fn()
      toast(res.message ?? (res.ok ? '完成' : '失敗'), res.ok ? 'success' : 'error')
      if (res.ok) router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const events = data.events.filter((e) => showEnded || !e.ended || e.status === 'IN_PROGRESS')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">清潔屬於內部排程：不開放報名、不建立購物車項目、不顯示價格或名額，也不會出現在前台活動推薦。</p>
        {canManage && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            新增清潔／維護排程
          </Button>
        )}
      </div>

      {/* 排程（系列） */}
      {data.plans.filter((p) => p.status === 'ACTIVE').length > 0 && (
        <Card>
          <CardContent className="space-y-2">
            <h2 className="text-sm font-semibold">排程</h2>
            <ul className="divide-y divide-[rgb(var(--border))] text-sm">
              {data.plans
                .filter((p) => p.status === 'ACTIVE')
                .map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted">
                        {p.typeLabel}・{p.repeatKind === 'WEEKLY' ? `每週${p.weekdays.split(',').filter(Boolean).map((d) => WEEKDAY_LABELS[Number(d)].replace('週', '')).join('、')}` : '單次'}・{p.timeLabel}・{p.courtNames.join('、')}
                        {p.assignee && `・負責：${p.assignee}`}・共 {p.eventCount} 次
                      </span>
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => window.confirm(`取消「${p.name}」整個排程？未來的封場都會釋放。`) && run(p.id, () => maintenancePlanCancelAction(p.id))}
                        className="text-xs text-red-700 hover:underline"
                      >
                        取消整個排程
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 事件 */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">近期清潔／維護</h2>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} />
              顯示已結束
            </label>
          </div>
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">目前沒有排定的清潔或維護。</p>
          ) : (
            <ul className="divide-y divide-[rgb(var(--border))] text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {e.dateLabel} {e.timeLabel}　{e.name}
                      {e.today && <Pill tone="violet">今天</Pill>}
                    </p>
                    <p className="text-xs text-muted">
                      {e.typeLabel}・{e.courtNames.join('、')}
                      {e.assignee && `・負責：${e.assignee}`}
                      {e.releasedAt && `・已提前解除封場 ${e.releasedAt}`}
                      {e.completedAt && !e.releasedAt && `・完成 ${e.completedAt}（封場維持到原時間）`}
                      {!e.occupied && e.status !== 'CANCELLED' && !e.releasedAt && !e.ended && '・尚未占用場地'}
                    </p>
                  </div>
                  <Pill tone={STATUS_TONE[e.status] ?? 'gray'}>{e.statusLabel}</Pill>
                  {canManage && e.status !== 'CANCELLED' && !e.ended && (
                    <div className="flex flex-wrap gap-1">
                      {e.status === 'SCHEDULED' && (
                        <ActionBtn icon={Play} label="開始" busy={busy === e.id + 'start'} onClick={() => run(e.id + 'start', () => maintenanceStatusAction(e.id, 'IN_PROGRESS'))} />
                      )}
                      {e.status !== 'DONE' && (
                        <ActionBtn icon={CheckCircle2} label="標記完成" busy={busy === e.id + 'done'} onClick={() => run(e.id + 'done', () => maintenanceStatusAction(e.id, 'DONE'))} />
                      )}
                      {!e.releasedAt && (
                        <ActionBtn
                          icon={DoorOpen}
                          label="提前解除封場"
                          busy={busy === e.id + 'release'}
                          onClick={() => window.confirm('提前解除封場：尚未開始的時段會立即開放租借與活動安排。確定？') && run(e.id + 'release', () => maintenanceReleaseAction(e.id))}
                        />
                      )}
                      {!e.releasedAt && <ActionBtn icon={Clock} label="延長" busy={false} onClick={() => setExtending(e)} />}
                      <ActionBtn
                        icon={Ban}
                        label="取消"
                        danger
                        busy={busy === e.id + 'cancel'}
                        onClick={() => {
                          const reason = window.prompt('取消原因（選填）') ?? ''
                          void run(e.id + 'cancel', () => maintenanceCancelAction(e.id, reason))
                        }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {creating && <CreateSheet data={data} onClose={() => setCreating(false)} />}
      {extending && (
        <ExtendSheet
          event={extending}
          venue={data.venue}
          onClose={() => setExtending(null)}
          onDone={() => {
            setExtending(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function ActionBtn({ icon: Icon, label, onClick, busy, danger = false }: { icon: typeof Play; label: string; onClick: () => void; busy: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={cn('inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-xs disabled:opacity-50', danger ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-[rgb(var(--border))] hover:surface-2')}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

function CreateSheet({ data, onClose }: { data: Data; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
  const [f, setF] = React.useState({
    name: '例行清潔',
    type: 'CLEANING' as (typeof TYPES)[number][0],
    courtIds: [] as string[],
    startMinute: data.venue.openMinute,
    endMinute: data.venue.openMinute + data.venue.slotMinutes,
    repeatKind: 'ONCE' as 'ONCE' | 'WEEKLY',
    weekdays: [] as number[],
    intervalWeeks: 1,
    seriesStartDate: today,
    endMode: 'COUNT' as 'DATE' | 'COUNT',
    seriesEndDate: today,
    occurrenceCount: 8,
    skipDates: [] as string[],
    assignee: '',
    description: '',
    checklist: '',
  })
  const [skipInput, setSkipInput] = React.useState('')
  const [avail, setAvail] = React.useState<{ courtId: string; name: string; ok: boolean; reasons: string[] }[] | null>(null)
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [exclude, setExclude] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState<null | 'preview' | 'create'>(null)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const payload = () => ({
    name: f.name,
    type: f.type,
    courtIds: f.courtIds,
    startMinute: f.startMinute,
    endMinute: f.endMinute,
    repeatKind: f.repeatKind,
    weekdays: f.weekdays,
    intervalWeeks: f.intervalWeeks,
    seriesStartDate: f.seriesStartDate,
    seriesEndDate: f.repeatKind === 'WEEKLY' && f.endMode === 'DATE' ? f.seriesEndDate : null,
    occurrenceCount: f.repeatKind === 'WEEKLY' && f.endMode === 'COUNT' ? f.occurrenceCount : null,
    skipDates: f.skipDates,
    assignee: f.assignee || null,
    description: f.description || null,
    checklist: f.checklist || null,
  })

  // 時間變動即查詢每面場地可用性（以系列第一天為準；全部日期的衝突在預覽列出）
  React.useEffect(() => {
    setPreview(null)
    let alive = true
    void courtAvailabilityAction({ date: f.seriesStartDate, startMinute: f.startMinute, endMinute: f.endMinute }).then((res) => {
      if (alive) setAvail(res.ok && !res.availability.error ? res.availability.courts : null)
    })
    return () => {
      alive = false
    }
  }, [f.seriesStartDate, f.startMinute, f.endMinute, f.repeatKind, f.weekdays, f.courtIds, f.occurrenceCount, f.seriesEndDate, f.endMode, f.intervalWeeks, f.skipDates])

  const slotOptions: number[] = []
  for (let m = data.venue.openMinute; m <= data.venue.closeMinute; m += Math.min(30, data.venue.slotMinutes)) slotOptions.push(m)
  const conflictRows = preview?.rows.filter((r) => r.status === 'CONFLICT') ?? []
  const unresolved = conflictRows.filter((r) => !exclude.has(r.date))
  const selectedNames = data.courts.filter((c) => f.courtIds.includes(c.id)).map((c) => c.name)

  const runPreview = async () => {
    setBusy('preview')
    try {
      const res = await previewMaintenanceAction(payload())
      if (!res.ok) return toast(res.message, 'error')
      setPreview(res.preview)
      setExclude(new Set())
      if (res.preview.error) toast(res.preview.error, 'error')
    } finally {
      setBusy(null)
    }
  }
  const create = async () => {
    setBusy('create')
    try {
      const res = await createMaintenanceAction(payload(), [...exclude])
      if (!res.ok) return toast(res.message, 'error')
      toast(res.message ?? '已建立', res.result.failed.length > 0 ? 'info' : 'success')
      if (res.result.failed.length > 0) toast(res.result.failed.map((x) => `${shortDateLabel(x.date)}：${x.reason}`).join('；'), 'error')
      router.refresh()
      onClose()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title="新增清潔／維護排程" description="生效後前台顯示「清潔維護・暫不開放」，不能訂場也不能安排活動" className="sm:w-[min(44rem,96vw)]">
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="名稱" htmlFor="m-name" required>
              <Input id="m-name" value={f.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="類型" htmlFor="m-type">
              <select id="m-type" className={sel} value={f.type} onChange={(e) => set('type', e.target.value as typeof f.type)}>
                {TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex gap-2" role="radiogroup" aria-label="單次或週期">
            {(['ONCE', 'WEEKLY'] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={f.repeatKind === k} onClick={() => set('repeatKind', k)} className={cn('h-10 rounded-xl border px-4 text-sm font-medium', f.repeatKind === k ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-[rgb(var(--border))]')}>
                {k === 'ONCE' ? '單次' : '每週重複'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={f.repeatKind === 'ONCE' ? '日期' : '開始日期'} htmlFor="m-date">
              <Input id="m-date" type="date" value={f.seriesStartDate} onChange={(e) => set('seriesStartDate', e.target.value)} />
            </Field>
            <Field label="開始" htmlFor="m-st">
              <select id="m-st" className={sel} value={f.startMinute} onChange={(e) => set('startMinute', Number(e.target.value))}>
                {slotOptions.slice(0, -1).map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="結束" htmlFor="m-et">
              <select id="m-et" className={sel} value={f.endMinute} onChange={(e) => set('endMinute', Number(e.target.value))}>
                {slotOptions.filter((m) => m > f.startMinute).map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {f.repeatKind === 'WEEKLY' && (
            <div className="space-y-3 rounded-xl bg-zinc-50 p-3">
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, d) => (
                  <label key={d} className={cn('flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-sm', f.weekdays.includes(d) ? 'border-brand-600 bg-brand-50' : 'border-[rgb(var(--border))] bg-white')}>
                    <input type="checkbox" checked={f.weekdays.includes(d)} onChange={(e) => set('weekdays', e.target.checked ? [...f.weekdays, d].sort() : f.weekdays.filter((x) => x !== d))} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="每隔幾週" htmlFor="m-int">
                  <Input id="m-int" type="number" min={1} max={8} value={f.intervalWeeks} onChange={(e) => set('intervalWeeks', Number(e.target.value))} />
                </Field>
                <Field label="結束方式" htmlFor="m-endmode">
                  <select id="m-endmode" className={sel} value={f.endMode} onChange={(e) => set('endMode', e.target.value as 'DATE' | 'COUNT')}>
                    <option value="COUNT">指定次數</option>
                    <option value="DATE">指定結束日期</option>
                  </select>
                </Field>
                {f.endMode === 'DATE' ? (
                  <Field label="結束日期" htmlFor="m-end">
                    <Input id="m-end" type="date" value={f.seriesEndDate} onChange={(e) => set('seriesEndDate', e.target.value)} />
                  </Field>
                ) : (
                  <Field label="次數" htmlFor="m-count">
                    <Input id="m-count" type="number" min={1} max={60} value={f.occurrenceCount} onChange={(e) => set('occurrenceCount', Number(e.target.value))} />
                  </Field>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">排除日期：</span>
                {f.skipDates.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs">
                    {shortDateLabel(d)}
                    <button type="button" aria-label={`取消排除 ${d}`} onClick={() => set('skipDates', f.skipDates.filter((x) => x !== d))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <Input type="date" className="h-9 w-40" value={skipInput} onChange={(e) => setSkipInput(e.target.value)} aria-label="新增排除日期" />
                <Button type="button" size="sm" variant="secondary" disabled={!skipInput} onClick={() => { if (skipInput && !f.skipDates.includes(skipInput)) set('skipDates', [...f.skipDates, skipInput].sort()); setSkipInput('') }}>
                  加入
                </Button>
              </div>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              指定場地 <span className="text-red-600">＊</span>
              <span className="ml-1 text-xs font-normal text-muted">選好時間後會顯示每面場地是否可用（以第一天為準）</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => set('courtIds', data.courts.filter((c) => c.active).map((c) => c.id))} className="h-10 rounded-xl border border-dashed border-brand-600 px-3 text-sm text-brand-700 hover:bg-brand-50">
                全部場地（{data.courts.filter((c) => c.active).length} 面）
              </button>
              {data.courts.map((c) => {
                const a = avail?.find((x) => x.courtId === c.id)
                const blocked = !c.active || (a ? !a.ok : false)
                const on = f.courtIds.includes(c.id)
                return (
                  <label key={c.id} title={a?.reasons.join('；')} className={cn('flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm', on ? 'border-brand-600 bg-brand-50' : 'border-[rgb(var(--border))]', blocked && 'cursor-not-allowed opacity-50')}>
                    <input type="checkbox" disabled={blocked} checked={on} onChange={(e) => set('courtIds', e.target.checked ? [...f.courtIds, c.id] : f.courtIds.filter((x) => x !== c.id))} />
                    {c.name}
                    {a && !a.ok && <span className="text-[11px] text-red-700">（{a.reasons[0]}）</span>}
                  </label>
                )
              })}
            </div>
            {f.courtIds.length > 0 && (
              <p className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs">
                將封場 {f.repeatKind === 'WEEKLY' ? `每週${f.weekdays.map((d) => WEEKDAY_LABELS[d].replace('週', '')).join('、') || '—'}` : f.seriesStartDate} {fmt(f.startMinute)}–{fmt(f.endMinute)} 的 {selectedNames.join('、')}，期間不開放租借與活動。
              </p>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="負責人" htmlFor="m-assignee">
              <Input id="m-assignee" value={f.assignee} maxLength={60} onChange={(e) => set('assignee', e.target.value)} />
            </Field>
          </div>
          <Field label="工作說明" htmlFor="m-desc">
            <Textarea id="m-desc" rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="檢查項目（一行一項）" htmlFor="m-check">
            <Textarea id="m-check" rows={3} value={f.checklist} onChange={(e) => set('checklist', e.target.value)} placeholder={'地面清掃\n球網檢查\n垃圾清運'} />
          </Field>

          {preview && (
            <div className="space-y-2 rounded-xl border border-[rgb(var(--border))] p-3">
              <p className="text-sm font-semibold">
                預覽：可建立 {preview.rows.filter((r) => r.status === 'NEW').length} 次・衝突 {conflictRows.length} 次・已過 {preview.rows.filter((r) => r.status === 'PAST').length} 次
              </p>
              {conflictRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span>衝突日期不會覆蓋既有訂單、活動或封場。可改時段／換場地後重新預覽，或勾選排除。</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setExclude(new Set(conflictRows.map((r) => r.date)))}>
                    排除全部衝突
                  </Button>
                </div>
              )}
              <ul className="max-h-56 space-y-1 overflow-auto text-xs">
                {preview.rows.map((r) => (
                  <li key={r.date} className={cn('rounded-lg px-2 py-1.5', r.status === 'CONFLICT' ? 'bg-red-50 text-red-800' : r.status === 'PAST' ? 'bg-zinc-100 text-zinc-500' : 'bg-emerald-50 text-emerald-900', exclude.has(r.date) && 'opacity-50')}>
                    <span className="font-medium">
                      {r.dateLabel} {r.timeLabel}
                    </span>{' '}
                    {r.courtNames.join('、')}
                    {r.status === 'PAST' && '・已過，不建立'}
                    {r.conflicts.map((c, i) => (
                      <span key={i} className="block">
                        {c.courtName} {fmt(c.startMinute)}–{fmt(c.endMinute)}：{c.reason}
                      </span>
                    ))}
                    {r.status === 'CONFLICT' && (
                      <label className="mt-1 flex items-center gap-1.5">
                        <input type="checkbox" checked={exclude.has(r.date)} onChange={(e) => { const n = new Set(exclude); if (e.target.checked) n.add(r.date); else n.delete(r.date); setExclude(n) }} />
                        排除這一天
                      </label>
                    )}
                  </li>
                ))}
              </ul>
              {exclude.size > 0 && <p className="text-xs text-muted">實際會建立：{preview.rows.filter((r) => r.status === 'NEW').map((r) => r.dateLabel).join('、') || '（無）'}；排除 {[...exclude].map(shortDateLabel).join('、')}</p>}
            </div>
          )}

          <div className="flex gap-2 border-t border-[rgb(var(--border))] pt-4">
            <Button size="sm" variant="secondary" loading={busy === 'preview'} disabled={f.courtIds.length === 0} onClick={runPreview}>
              預覽衝突
            </Button>
            <Button size="sm" loading={busy === 'create'} disabled={!preview || preview.error !== null || unresolved.length > 0 || f.courtIds.length === 0} onClick={create}>
              建立並封場
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

function ExtendSheet({ event, venue, onClose, onDone }: { event: Data['events'][number]; venue: Data['venue']; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast()
  const [end, setEnd] = React.useState(event.endMinute + venue.slotMinutes)
  const [busy, setBusy] = React.useState(false)
  const opts: number[] = []
  for (let m = event.endMinute + Math.min(30, venue.slotMinutes); m <= venue.closeMinute; m += Math.min(30, venue.slotMinutes)) opts.push(m)
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={`延長封場・${event.dateLabel} ${event.name}`} description="延長會再次檢查後續的預約、活動與封場；有衝突不會覆蓋">
        <div className="space-y-3 text-sm">
          <p>目前 {event.timeLabel}，場地 {event.courtNames.join('、')}</p>
          <Field label="新的結束時間" htmlFor="x-end">
            <select id="x-end" className={sel} value={end} onChange={(e) => setEnd(Number(e.target.value))}>
              {opts.map((m) => (
                <option key={m} value={m}>
                  {fmt(m)}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-2">
            <Button size="sm" loading={busy} disabled={opts.length === 0} onClick={async () => { setBusy(true); try { const r = await maintenanceExtendAction(event.id, end); toast(r.message ?? '', r.ok ? 'success' : 'error'); if (r.ok) onDone() } finally { setBusy(false) } }}>
              確認延長
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
