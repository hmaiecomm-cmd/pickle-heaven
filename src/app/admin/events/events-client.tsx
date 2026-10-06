'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock, DollarSign, GraduationCap, Mail, Phone, Plus, Search, Trophy, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { getCoaches, getEvents } from '@/lib/api-service'
import type { Coach, CoachStatus, Event, EventStatus } from '@/lib/models'

/** 活動與教練（Phase 1E）。資料來自 mock api-service，狀態操作目前僅更新本機狀態。 */

type Tab = 'events' | 'coaches'
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'
type EventType = Event['type']

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  TOURNAMENT: '比賽',
  SOCIAL: '交流賽',
  TRAINING: '訓練課程',
  OTHER: '其他',
}

const EVENT_STATUS_META: Record<EventStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  PUBLISHED: { label: '已發布', variant: 'success' },
  ONGOING: { label: '進行中', variant: 'info' },
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

const selectClass = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'
const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

export function EventsClient() {
  const [tab, setTab] = useState<Tab>('events')
  const [events, setEvents] = useState<Event[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [ev, co] = await Promise.all([getEvents(), getCoaches()])
      if (!ev.success) throw new Error(ev.error?.message ?? '無法載入活動')
      if (!co.success) throw new Error(co.error?.message ?? '無法載入教練')
      setEvents(ev.data)
      setCoaches(co.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="活動與教練"
        subtitle="管理活動、課程與教練排班"
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
                onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
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

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState description={error} retry={load} />
      ) : tab === 'events' ? (
        <EventsTab events={events} setEvents={setEvents} />
      ) : (
        <CoachesTab coaches={coaches} />
      )}
    </div>
  )
}

/* ───────────────────────────── 活動 ───────────────────────────── */

function EventsTab({ events, setEvents }: { events: Event[]; setEvents: (f: (e: Event[]) => Event[]) => void }) {
  const { toast } = useToast()
  const [type, setType] = useState<EventType | 'ALL'>('ALL')
  const [status, setStatus] = useState<EventStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events
      .filter((e) => (type === 'ALL' || e.type === type) && (status === 'ALL' || e.status === status))
      .filter((e) => !q || `${e.name} ${e.description}`.toLowerCase().includes(q))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  }, [events, type, status, query])

  const kpi = useMemo(() => {
    const live = events.filter((e) => e.status === 'PUBLISHED' || e.status === 'ONGOING')
    const enrolled = live.reduce((s, e) => s + e.enrolled, 0)
    const capacity = live.reduce((s, e) => s + e.capacity, 0)
    return {
      total: events.length,
      live: live.length,
      enrolled,
      capacity,
      revenue: live.reduce((s, e) => s + e.enrolled * e.price, 0),
    }
  }, [events])

  const selected = events.find((e) => e.id === selectedId) ?? null

  /** Phase 1 僅更新本機狀態；Phase 2 改呼叫 API。 */
  const updateStatus = (id: string, next: EventStatus) => {
    setEvents((list) => list.map((e) => (e.id === id ? { ...e, status: next } : e)))
    toast(`活動狀態已改為「${EVENT_STATUS_META[next].label}」（mock，未寫入資料庫）`, 'success')
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<CalendarDays className="h-5 w-5" />} label="活動總數" value={kpi.total} unit="場" />
        <KPICard icon={<Trophy className="h-5 w-5" />} label="進行中／已發布" value={kpi.live} unit="場" />
        <KPICard icon={<Users className="h-5 w-5" />} label="報名人數" value={`${kpi.enrolled} / ${kpi.capacity}`} unit="人" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="預估收入" value={kpi.revenue.toLocaleString()} unit="元" />
      </div>

      <div className={`flex flex-col gap-3 p-3 md:flex-row md:items-center ${panelClass}`}>
        <div className="flex flex-wrap gap-2">
          <select aria-label="類型" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectClass}>
            <option value="ALL">全部類型</option>
            {(Object.keys(EVENT_TYPE_LABEL) as EventType[]).map((t) => (
              <option key={t} value={t}>{EVENT_TYPE_LABEL[t]}</option>
            ))}
          </select>
          <select aria-label="狀態" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
            <option value="ALL">全部狀態</option>
            {(Object.keys(EVENT_STATUS_META) as EventStatus[]).map((s) => (
              <option key={s} value={s}>{EVENT_STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋活動名稱或說明"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] pl-8 pr-3 text-sm"
          />
        </label>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          新增活動
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className={panelClass}>
          <EmptyState title="沒有符合條件的活動" description="試著放寬篩選條件" icon="🏆" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((e) => {
            const pct = e.capacity > 0 ? Math.min(100, Math.round((e.enrolled / e.capacity) * 100)) : 0
            return (
              <button key={e.id} onClick={() => setSelectedId(e.id)} className={`p-4 text-left transition-colors hover:surface-2 ${panelClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {EVENT_TYPE_LABEL[e.type]}　{fmtDate(e.startTime)} {fmtTime(e.startTime)}–{fmtTime(e.endTime)}
                    </p>
                  </div>
                  <StatusBadge status={EVENT_STATUS_META[e.status].label} variant={EVENT_STATUS_META[e.status].variant} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{e.description}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    {e.enrolled} / {e.capacity} 人
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

      {/* 活動詳情 */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={selected.name} description={`${EVENT_TYPE_LABEL[selected.type]}　${fmtDateTime(selected.startTime)} – ${fmtTime(selected.endTime)}`}>
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={EVENT_STATUS_META[selected.status].label} variant={EVENT_STATUS_META[selected.status].variant} />
                {selected.enrolled >= selected.capacity && <StatusBadge status="已額滿" variant="error" />}
              </div>

              <p className="whitespace-pre-wrap">{selected.description}</p>

              <section className="grid grid-cols-3 gap-3">
                <Info label="報名" value={`${selected.enrolled} / ${selected.capacity} 人`} />
                <Info label="費用" value={fmtMoney(selected.price)} />
                <Info label="預估收入" value={fmtMoney(selected.enrolled * selected.price)} />
              </section>

              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                {selected.status === 'DRAFT' && <Button size="sm" onClick={() => updateStatus(selected.id, 'PUBLISHED')}>發布</Button>}
                {selected.status === 'PUBLISHED' && <Button size="sm" onClick={() => updateStatus(selected.id, 'ONGOING')}>開始活動</Button>}
                {selected.status === 'ONGOING' && <Button size="sm" onClick={() => updateStatus(selected.id, 'COMPLETED')}>結束活動</Button>}
                {(selected.status === 'DRAFT' || selected.status === 'PUBLISHED') && (
                  <Button size="sm" variant="danger" onClick={() => updateStatus(selected.id, 'CANCELLED')}>取消活動</Button>
                )}
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">編輯</Button>
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">報名名單</Button>
              </div>
              <p className="text-xs text-muted">狀態變更目前僅更新畫面（mock 模式），Phase 2 會寫回資料庫。</p>
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* 新增活動（佔位） */}
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent title="新增活動" description="建立比賽、交流賽或訓練課程">
          <EmptyState
            title="建立活動表單將於 Phase 2 實作"
            description="屆時可設定時段、球場、人數上限與費用，並開放線上報名"
            icon="🛠️"
            action={<Button size="sm" variant="secondary" onClick={() => setCreating(false)}>關閉</Button>}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ───────────────────────────── 教練 ───────────────────────────── */

function CoachesTab({ coaches }: { coaches: Coach[] }) {
  const [status, setStatus] = useState<CoachStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return coaches
      .filter((c) => status === 'ALL' || c.status === status)
      .filter((c) => !q || `${c.name} ${c.specialties.join(' ')} ${c.phone}`.toLowerCase().includes(q))
  }, [coaches, status, query])

  const kpi = useMemo(() => {
    const active = coaches.filter((c) => c.status === 'ACTIVE')
    const hours = active.reduce(
      (s, c) => s + c.availability.reduce((h, a) => h + (toMin(a.endTime) - toMin(a.startTime)) / 60, 0),
      0,
    )
    return {
      total: coaches.length,
      active: active.length,
      hours: Math.round(hours),
      avgRate: active.length ? Math.round(active.reduce((s, c) => s + c.hourlyRate, 0) / active.length) : 0,
    }
  }, [coaches])

  const selected = coaches.find((c) => c.id === selectedId) ?? null

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
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          新增教練
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className={panelClass}>
          <EmptyState title="沒有符合條件的教練" description="試著放寬篩選條件" icon="🎓" />
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{s}</span>
                ))}
              </div>
              <AvailabilityStrip availability={c.availability} className="mt-3" />
            </button>
          ))}
        </div>
      )}

      {/* 教練詳情 */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={selected.name} description={`${COACH_STATUS_META[selected.status].label}　${fmtMoney(selected.hourlyRate)} / 小時`}>
            <div className="space-y-5 text-sm">
              <section className="grid grid-cols-2 gap-3">
                <Info label="電話" value={selected.phone} icon={<Phone className="h-3.5 w-3.5" aria-hidden />} />
                <Info label="Email" value={selected.email} icon={<Mail className="h-3.5 w-3.5" aria-hidden />} />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">專長</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selected.specialties.map((s) => (
                    <span key={s} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{s}</span>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">可預約時段</h3>
                <AvailabilityStrip availability={selected.availability} />
                <ul className="mt-3 divide-y divide-[rgb(var(--border))] rounded-lg border border-[rgb(var(--border))]">
                  {[...selected.availability]
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((a) => (
                      <li key={`${a.dayOfWeek}-${a.startTime}`} className="flex items-center justify-between px-3 py-2">
                        <span>週{WEEKDAYS[a.dayOfWeek]}</span>
                        <span className="font-mono text-xs">{a.startTime}–{a.endTime}</span>
                      </li>
                    ))}
                </ul>
              </section>

              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">編輯</Button>
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">排班</Button>
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">課程紀錄</Button>
              </div>
              <p className="text-xs text-muted">教練資料編輯將於 Phase 2 實作。</p>
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* 新增教練（佔位） */}
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent title="新增教練" description="建立教練資料與可預約時段">
          <EmptyState
            title="建立教練表單將於 Phase 2 實作"
            description="屆時可設定專長、時薪與每週可授課時段"
            icon="🛠️"
            action={<Button size="sm" variant="secondary" onClick={() => setCreating(false)}>關閉</Button>}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

/* ───────────────────────────── 共用 ───────────────────────────── */

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** 一週七格，有排班的日子標亮。 */
function AvailabilityStrip({ availability, className = '' }: { availability: Coach['availability']; className?: string }) {
  const days = new Set(availability.map((a) => a.dayOfWeek))
  return (
    <div className={`flex gap-1 ${className}`} aria-label="每週可授課日">
      {WEEKDAYS.map((w, i) => (
        <span
          key={w}
          title={days.has(i) ? availability.filter((a) => a.dayOfWeek === i).map((a) => `${a.startTime}–${a.endTime}`).join('、') : '休息'}
          className={`grid h-7 w-7 place-items-center rounded text-xs ${
            days.has(i) ? 'bg-brand-600 font-medium text-white' : 'bg-gray-100 text-muted dark:bg-gray-800'
          }`}
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
