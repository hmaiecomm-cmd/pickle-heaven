'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Clock, DollarSign, ExternalLink, GraduationCap, Mail, Pencil, Phone, Plus, Search, Trash2, Trophy, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { createCoach, getCoaches, getSessionEvents, updateCoach } from '@/lib/api-service'
import type { Coach, CoachInput, CoachSlotInput, CoachStatus, SessionEvent, SessionEventStatus } from '@/lib/models'

/**
 * 活動與教練（Phase 2）。
 * 活動直接使用球敘（Session）：名單、取消、鎖定等管理動作在球敘詳情頁。
 * 教練讀寫資料庫 Coach / CoachAvailability。
 */

type Tab = 'events' | 'coaches'
type Scope = 'upcoming' | 'past'
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

const EVENT_STATUS_META: Record<SessionEventStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  SCHEDULED: { label: '尚未開放', variant: 'default' },
  OPEN: { label: '開放報名', variant: 'success' },
  FULL: { label: '已額滿', variant: 'error' },
  LOCKED: { label: '名單已鎖定', variant: 'warning' },
  PLAYING: { label: '進行中', variant: 'info' },
  COMPLETED: { label: '已結束', variant: 'default' },
  CANCELLED: { label: '已取消', variant: 'error' },
}

const COACH_STATUS_META: Record<CoachStatus, { label: string; variant: BadgeVariant }> = {
  ACTIVE: { label: '在職', variant: 'success' },
  ON_LEAVE: { label: '請假中', variant: 'warning' },
  INACTIVE: { label: '停用', variant: 'default' },
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}（${WEEKDAYS[d.getDay()]}）`
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const fmtDateTime = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${fmtTime(d)}`
const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const toHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`

const selectClass = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'
const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

export function EventsClient() {
  const [tab, setTab] = useState<Tab>('events')

  return (
    <div className="space-y-6">
      <PageHeader
        title="活動與教練"
        subtitle="活動即球敘場次；教練資料與每週可授課時段"
        action={
          <div className="flex rounded-lg border border-[rgb(var(--border))] p-0.5">
            {(
              [
                { key: 'events', label: '活動', icon: Trophy },
                { key: 'coaches', label: '教練', icon: GraduationCap },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-brand-600 text-white' : 'text-muted hover:surface-2'
                }`}
              >
                <t.icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        }
      />
      {tab === 'events' ? <EventsTab /> : <CoachesTab />}
    </div>
  )
}

/* ───────────────────────────── 活動（球敘） ───────────────────────────── */

function EventsTab() {
  const [scope, setScope] = useState<Scope>('upcoming')
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionEventStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = async (s: Scope) => {
    setLoading(true)
    setError(null)
    const res = await getSessionEvents(s)
    if (!res.success) setError(res.error?.message ?? '無法載入活動')
    else setEvents(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load(scope)
  }, [scope])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events
      .filter((e) => status === 'ALL' || e.status === status)
      .filter((e) => !q || `${e.title} ${e.description} ${e.courtName ?? ''}`.toLowerCase().includes(q))
  }, [events, status, query])

  const kpi = useMemo(() => {
    const live = filtered.filter((e) => e.status !== 'CANCELLED')
    return {
      total: filtered.length,
      open: filtered.filter((e) => e.status === 'OPEN').length,
      confirmed: live.reduce((s, e) => s + e.confirmed, 0),
      capacity: live.reduce((s, e) => s + e.capacity, 0),
      waitlisted: live.reduce((s, e) => s + e.waitlisted, 0),
      revenue: live.reduce((s, e) => s + e.confirmed * e.price, 0),
    }
  }, [filtered])

  const selected = events.find((e) => e.id === selectedId) ?? null

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<CalendarDays className="h-5 w-5" />} label={scope === 'upcoming' ? '未來場次' : '已結束場次'} value={kpi.total} unit="場" />
        <KPICard icon={<Trophy className="h-5 w-5" />} label="開放報名中" value={kpi.open} unit="場" />
        <KPICard icon={<Users className="h-5 w-5" />} label="正取／名額" value={`${kpi.confirmed} / ${kpi.capacity}`} unit="人" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="預估收入（正取）" value={kpi.revenue.toLocaleString()} unit="元" />
      </div>

      <div className={`flex flex-col gap-3 p-3 md:flex-row md:flex-wrap md:items-center ${panelClass}`}>
        <div className="flex gap-1.5">
          {(
            [
              { key: 'upcoming', label: '未來' },
              { key: 'past', label: '已結束' },
            ] as const
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              aria-pressed={scope === s.key}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                scope === s.key ? 'bg-brand-600 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select aria-label="狀態" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
          <option value="ALL">全部狀態</option>
          {(Object.keys(EVENT_STATUS_META) as SessionEventStatus[]).map((s) => (
            <option key={s} value={s}>{EVENT_STATUS_META[s].label}</option>
          ))}
        </select>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋活動名稱、說明或球場"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] pl-8 pr-3 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <Link href="/admin/sessions?create=1" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            新增單次
          </Link>
          <Link href="/admin/templates" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[rgb(var(--border))] px-3 text-sm hover:surface-2">
            週期範本
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState description={error} retry={() => load(scope)} />
      ) : filtered.length === 0 ? (
        <div className={panelClass}>
          <EmptyState
            title={scope === 'upcoming' ? '目前沒有未來的活動' : '沒有已結束的活動'}
            description="活動來自球敘場次：可新增單次球敘，或建立週期性範本由排程自動產生。"
            icon="🏆"
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((e) => {
            const pct = e.capacity > 0 ? Math.min(100, Math.round((e.confirmed / e.capacity) * 100)) : 0
            return (
              <button key={e.id} onClick={() => setSelectedId(e.id)} className={`p-4 text-left transition-colors hover:surface-2 ${panelClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {fmtDate(e.startAt)} {fmtTime(e.startAt)}–{fmtTime(e.endAt)}
                      {e.courtName ? `　${e.courtName}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={EVENT_STATUS_META[e.status].label} variant={EVENT_STATUS_META[e.status].variant} />
                </div>
                {e.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{e.description}</p>}
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {e.confirmed} / {e.capacity} 人{e.waitlisted > 0 ? `　候補 ${e.waitlisted}` : ''}
                  </span>
                  <span className="font-mono">{fmtMoney(e.price)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={selected.title} description={`${fmtDateTime(selected.startAt)} – ${fmtTime(selected.endAt)}　${selected.venueName}`}>
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={EVENT_STATUS_META[selected.status].label} variant={EVENT_STATUS_META[selected.status].variant} />
                {selected.templateTitle && <StatusBadge status={`範本：${selected.templateTitle}`} variant="info" size="sm" />}
              </div>
              {selected.description && <p className="whitespace-pre-wrap">{selected.description}</p>}
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Info label="正取" value={`${selected.confirmed} / ${selected.capacity} 人`} />
                <Info label="候補" value={selected.waitlistEnabled ? `${selected.waitlisted} 人` : '未開放'} />
                <Info label="費用" value={fmtMoney(selected.price)} />
                <Info label="球場" value={selected.courtName ?? '未指定'} />
                <Info label="報名開放" value={fmtDateTime(selected.bookingOpenAt)} />
                <Info label="報名截止" value={fmtDateTime(selected.bookingCloseAt)} />
                {(selected.skillLevelMin !== null || selected.skillLevelMax !== null) && (
                  <Info label="程度" value={`${selected.skillLevelMin ?? '—'}–${selected.skillLevelMax ?? '—'}`} />
                )}
                {selected.reservedCapacity > 0 && <Info label="保留名額" value={`${selected.reservedCapacity} 人`} />}
              </section>
              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                <Link href={`/admin/sessions/${selected.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  管理名單與場次
                </Link>
                {selected.templateTitle && (
                  <Link href="/admin/templates" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[rgb(var(--border))] px-3 text-sm hover:surface-2">
                    修改範本
                  </Link>
                )}
              </div>
              <p className="text-xs text-muted">加人、遞補、點名、鎖定名單與取消場次都在球敘詳情頁操作。</p>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  )
}

/* ───────────────────────────── 教練 ───────────────────────────── */

const EMPTY_COACH: CoachInput = { name: '', phone: '', email: '', status: 'ACTIVE', specialties: [], hourlyRate: 800, bio: '', availability: [] }

function CoachesTab() {
  const { toast } = useToast()
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<CoachStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | null; form: CoachInput } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    const res = await getCoaches()
    if (!res.success) setError(res.error?.message ?? '無法載入教練')
    else setCoaches(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return coaches
      .filter((c) => status === 'ALL' || c.status === status)
      .filter((c) => !q || `${c.name} ${c.specialties.join(' ')} ${c.phone}`.toLowerCase().includes(q))
  }, [coaches, status, query])

  const kpi = useMemo(() => {
    const active = coaches.filter((c) => c.status === 'ACTIVE')
    const hours = active.reduce((s, c) => s + c.availability.reduce((h, a) => h + (toMin(a.endTime) - toMin(a.startTime)) / 60, 0), 0)
    return {
      total: coaches.length,
      active: active.length,
      hours: Math.round(hours * 10) / 10,
      avgRate: active.length ? Math.round(active.reduce((s, c) => s + c.hourlyRate, 0) / active.length) : 0,
    }
  }, [coaches])

  const selected = coaches.find((c) => c.id === selectedId) ?? null

  const openNew = () => setEditing({ id: null, form: { ...EMPTY_COACH, availability: [] } })
  const openEdit = (c: Coach) =>
    setEditing({
      id: c.id,
      form: {
        name: c.name,
        phone: c.phone,
        email: c.email,
        status: c.status,
        specialties: [...c.specialties],
        hourlyRate: c.hourlyRate,
        bio: c.bio ?? '',
        availability: c.availability.map((a) => ({ dayOfWeek: a.dayOfWeek, startMinute: toMin(a.startTime), endMinute: toMin(a.endTime) })),
      },
    })

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const res = editing.id ? await updateCoach(editing.id, editing.form) : await createCoach(editing.form)
      if (!res.success) {
        toast(`儲存失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
        return
      }
      setCoaches((list) => (editing.id ? list.map((c) => (c.id === editing.id ? res.data : c)) : [...list, res.data]))
      toast(editing.id ? `已更新 ${res.data.name}` : `已新增教練 ${res.data.name}`, 'success')
      setEditing(null)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (c: Coach, next: CoachStatus) => {
    setBusy(true)
    try {
      const res = await updateCoach(c.id, { status: next })
      if (!res.success) {
        toast(`變更失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
        return
      }
      setCoaches((list) => list.map((x) => (x.id === c.id ? res.data : x)))
      toast(`${c.name} 已改為「${COACH_STATUS_META[next].label}」`, 'success')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<GraduationCap className="h-5 w-5" />} label="教練人數" value={kpi.total} unit="位" />
        <KPICard icon={<Users className="h-5 w-5" />} label="在職" value={kpi.active} unit="位" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="每週可授課" value={kpi.hours} unit="小時" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="平均時薪" value={kpi.avgRate.toLocaleString()} unit="元" />
      </div>

      <div className={`flex flex-col gap-3 p-3 md:flex-row md:items-center ${panelClass}`}>
        <select aria-label="狀態" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
          <option value="ALL">全部狀態</option>
          {(Object.keys(COACH_STATUS_META) as CoachStatus[]).map((s) => (
            <option key={s} value={s}>{COACH_STATUS_META[s].label}</option>
          ))}
        </select>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋教練姓名、專長或電話"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] pl-8 pr-3 text-sm"
          />
        </label>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" aria-hidden />
          新增教練
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState description={error} retry={load} />
      ) : filtered.length === 0 ? (
        <div className={panelClass}>
          <EmptyState
            title={coaches.length === 0 ? '尚未建立教練' : '沒有符合條件的教練'}
            description={coaches.length === 0 ? '按「新增教練」建立第一位，並設定每週可授課時段。' : '試著放寬篩選條件'}
            icon="🎓"
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)} className={`p-4 text-left transition-colors hover:surface-2 ${panelClass}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                    {c.name.slice(0, 1)}
                  </span>
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-muted">{fmtMoney(c.hourlyRate)} / 小時</p>
                  </div>
                </div>
                <StatusBadge status={COACH_STATUS_META[c.status].label} variant={COACH_STATUS_META[c.status].variant} />
              </div>
              {c.specialties.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.specialties.map((s) => (
                    <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{s}</span>
                  ))}
                </div>
              )}
              <AvailabilityStrip availability={c.availability} className="mt-3" />
            </button>
          ))}
        </div>
      )}

      {/* 教練詳情 */}
      <Sheet open={selected !== null && editing === null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={selected.name} description={`${COACH_STATUS_META[selected.status].label}　${fmtMoney(selected.hourlyRate)} / 小時`}>
            <div className="space-y-5 text-sm">
              <section className="grid grid-cols-2 gap-3">
                <Info label="電話" value={selected.phone || '—'} icon={<Phone className="h-3.5 w-3.5" aria-hidden />} />
                <Info label="Email" value={selected.email || '—'} icon={<Mail className="h-3.5 w-3.5" aria-hidden />} />
              </section>
              {selected.bio && <p className="whitespace-pre-wrap">{selected.bio}</p>}
              {selected.specialties.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">專長</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.specialties.map((s) => (
                      <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{s}</span>
                    ))}
                  </div>
                </section>
              )}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">每週可授課時段</h3>
                <AvailabilityStrip availability={selected.availability} />
                {selected.availability.length === 0 ? (
                  <p className="mt-2 text-muted">尚未設定</p>
                ) : (
                  <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-lg border border-[rgb(var(--border))]">
                    {selected.availability.map((a) => (
                      <li key={`${a.dayOfWeek}-${a.startTime}`} className="flex items-center justify-between px-3 py-2">
                        <span>週{WEEKDAYS[a.dayOfWeek]}</span>
                        <span className="font-mono text-xs">{a.startTime}–{a.endTime}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                <Button size="sm" onClick={() => openEdit(selected)}>
                  <Pencil className="h-4 w-4" aria-hidden />
                  編輯
                </Button>
                {selected.status !== 'ACTIVE' && <Button size="sm" variant="secondary" loading={busy} onClick={() => changeStatus(selected, 'ACTIVE')}>設為在職</Button>}
                {selected.status === 'ACTIVE' && <Button size="sm" variant="secondary" loading={busy} onClick={() => changeStatus(selected, 'ON_LEAVE')}>設為請假</Button>}
                {selected.status !== 'INACTIVE' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => changeStatus(selected, 'INACTIVE')}>停用</Button>}
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* 新增／編輯 */}
      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <SheetContent title={editing.id ? `編輯 ${editing.form.name}` : '新增教練'} description="專長以逗號分隔；可授課時段同一天不可重疊">
            <CoachForm value={editing.form} onChange={(form) => setEditing((e) => (e ? { ...e, form } : e))} />
            <div className="mt-5 flex gap-2 border-t border-[rgb(var(--border))] pt-4">
              <Button size="sm" loading={busy} disabled={!editing.form.name.trim()} onClick={save}>儲存</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setEditing(null)}>取消</Button>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </>
  )
}

function CoachForm({ value, onChange }: { value: CoachInput; onChange: (v: CoachInput) => void }) {
  const set = <K extends keyof CoachInput>(k: K, v: CoachInput[K]) => onChange({ ...value, [k]: v })
  const [specText, setSpecText] = useState(value.specialties.join('、'))
  const setSlot = (i: number, patch: Partial<CoachSlotInput>) => set('availability', value.availability.map((s, j) => (j === i ? { ...s, ...patch } : s)))

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Field label="姓名" htmlFor="c-name" required>
          <Input id="c-name" value={value.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="時薪（NT$）" htmlFor="c-rate">
          <Input id="c-rate" type="number" min={0} value={value.hourlyRate} onChange={(e) => set('hourlyRate', Number(e.target.value))} />
        </Field>
        <Field label="電話" htmlFor="c-phone">
          <Input id="c-phone" value={value.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="c-email">
          <Input id="c-email" type="email" value={value.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </div>
      <Field label="專長" htmlFor="c-spec" hint="以逗號或頓號分隔，例如：基礎教學、比賽策略">
        <Input
          id="c-spec"
          value={specText}
          onChange={(e) => {
            setSpecText(e.target.value)
            set('specialties', e.target.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean))
          }}
        />
      </Field>
      <Field label="狀態" htmlFor="c-status">
        <select id="c-status" value={value.status} onChange={(e) => set('status', e.target.value as CoachStatus)} className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]">
          {(Object.keys(COACH_STATUS_META) as CoachStatus[]).map((s) => (
            <option key={s} value={s}>{COACH_STATUS_META[s].label}</option>
          ))}
        </select>
      </Field>
      <Field label="簡介" htmlFor="c-bio">
        <Textarea id="c-bio" rows={2} value={value.bio} maxLength={1000} onChange={(e) => set('bio', e.target.value)} />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">每週可授課時段</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set('availability', [...value.availability, { dayOfWeek: 1, startMinute: 600, endMinute: 1080 }])}
            disabled={value.availability.length >= 21}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            加一段
          </Button>
        </div>
        {value.availability.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[rgb(var(--border))] p-3 text-center text-xs text-muted">尚未設定</p>
        ) : (
          <ul className="space-y-2">
            {value.availability.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <select aria-label="星期" value={s.dayOfWeek} onChange={(e) => setSlot(i, { dayOfWeek: Number(e.target.value) })} className={selectClass}>
                  {WEEKDAYS.map((w, d) => (
                    <option key={w} value={d}>週{w}</option>
                  ))}
                </select>
                <input aria-label="開始" type="time" step={1800} value={toHHMM(s.startMinute)} onChange={(e) => setSlot(i, { startMinute: toMin(e.target.value) })} className={selectClass} />
                <span className="text-muted">–</span>
                <input
                  aria-label="結束"
                  type="time"
                  step={1800}
                  value={s.endMinute >= 1440 ? '23:59' : toHHMM(s.endMinute)}
                  onChange={(e) => setSlot(i, { endMinute: e.target.value === '23:59' ? 1440 : toMin(e.target.value) })}
                  className={selectClass}
                />
                <button type="button" aria-label="刪除這段" onClick={() => set('availability', value.availability.filter((_, j) => j !== i))} className="rounded p-1.5 text-muted hover:surface-2">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ───────────────────────────── 共用 ───────────────────────────── */

/** 一週七格，有排班的日子標亮。 */
function AvailabilityStrip({ availability, className = '' }: { availability: Coach['availability']; className?: string }) {
  const days = new Set(availability.map((a) => a.dayOfWeek))
  return (
    <div className={`flex gap-1 ${className}`} aria-label="每週可授課日">
      {WEEKDAYS.map((w, i) => (
        <span
          key={w}
          title={days.has(i) ? availability.filter((a) => a.dayOfWeek === i).map((a) => `${a.startTime}–${a.endTime}`).join('、') : '休息'}
          className={`grid h-7 w-7 place-items-center rounded text-xs ${days.has(i) ? 'bg-brand-600 font-medium text-white' : 'bg-gray-100 text-muted dark:bg-gray-800'}`}
        >
          {w}
        </span>
      ))}
    </div>
  )
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  )
}
