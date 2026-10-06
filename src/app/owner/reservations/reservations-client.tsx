'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, DollarSign, Plus, QrCode, Search, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { getCourts, getReservations } from '@/lib/api-service'
import type { Court, PaymentStatus, Reservation, ReservationStatus, ReservationType } from '@/lib/models'

/** 預約管理（Phase 1D）。資料來自 mock api-service，狀態操作目前僅更新本機狀態。 */

type Period = 'today' | 'week' | 'month' | 'all'
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本週' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '全部' },
]

const TYPE_LABEL: Record<ReservationType, string> = { COURT: '球場', EVENT: '活動', COACH: '教練' }

const STATUS_META: Record<ReservationStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '待確認', variant: 'warning' },
  CONFIRMED: { label: '已確認', variant: 'success' },
  CHECKED_IN: { label: '已報到', variant: 'info' },
  COMPLETED: { label: '已完成', variant: 'default' },
  CANCELLED: { label: '已取消', variant: 'error' },
}

const PAYMENT_META: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '待付款', variant: 'warning' },
  PAID: { label: '已付款', variant: 'success' },
  FAILED: { label: '付款失敗', variant: 'error' },
  REFUNDED: { label: '已退款', variant: 'default' },
}

const MEMBERSHIP_LABEL = { BASIC: '一般', PREMIUM: '進階', VIP: 'VIP' } as const

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const fmtDateTime = (d: Date) => `${d.getFullYear()}/${fmtDate(d)} ${fmtTime(d)}`
const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`

/** 預約的代表時間：第一個項目的開始時間。 */
const startOf = (r: Reservation) => r.items[0]?.startTime ?? r.createdAt

function periodRange(period: Period, now: Date): [Date, Date] | null {
  if (period === 'all') return null
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(from)
  if (period === 'today') to.setDate(to.getDate() + 1)
  else if (period === 'week') to.setDate(to.getDate() + 7)
  else to.setMonth(to.getMonth() + 1)
  return [from, to]
}

export function ReservationsClient() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>('week')
  const [type, setType] = useState<ReservationType | 'ALL'>('ALL')
  const [status, setStatus] = useState<ReservationStatus | 'ALL'>('ALL')
  const [courtId, setCourtId] = useState<string>('ALL')
  const [query, setQuery] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [resRes, courtRes] = await Promise.all([getReservations(), getCourts()])
      if (!resRes.success) throw new Error(resRes.error?.message ?? '無法載入預約')
      setReservations(resRes.data)
      if (courtRes.success) setCourts(courtRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const range = periodRange(period, new Date())
    const q = query.trim().toLowerCase()
    return reservations
      .filter((r) => {
        if (range) {
          const t = startOf(r)
          if (t < range[0] || t >= range[1]) return false
        }
        if (type !== 'ALL' && r.type !== type) return false
        if (status !== 'ALL' && r.status !== status) return false
        if (courtId !== 'ALL' && !r.items.some((i) => i.courtId === courtId)) return false
        if (q) {
          const hay = `${r.bookingCode} ${r.member?.name ?? ''} ${r.member?.phone ?? ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => startOf(a).getTime() - startOf(b).getTime())
  }, [reservations, period, type, status, courtId, query])

  const kpi = useMemo(() => {
    const today = periodRange('today', new Date())!
    const todayCount = reservations.filter((r) => {
      const t = startOf(r)
      return t >= today[0] && t < today[1] && r.status !== 'CANCELLED'
    }).length
    return {
      total: filtered.length,
      pending: filtered.filter((r) => r.status === 'PENDING').length,
      today: todayCount,
      paid: filtered.filter((r) => r.paymentStatus === 'PAID').reduce((s, r) => s + r.totalAmount, 0),
    }
  }, [reservations, filtered])

  const selected = reservations.find((r) => r.id === selectedId) ?? null

  /** Phase 1 僅更新本機狀態；Phase 2 改呼叫 API。 */
  const updateStatus = (id: string, next: ReservationStatus) => {
    setReservations((list) =>
      list.map((r) =>
        r.id === id
          ? {
              ...r,
              status: next,
              checkedInAt: next === 'CHECKED_IN' ? new Date() : r.checkedInAt,
              updatedAt: new Date(),
            }
          : r,
      ),
    )
  }

  const courtName = (id?: string) => courts.find((c) => c.id === id)?.name

  const selectClass =
    'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'

  return (
    <div className="space-y-6">
      <PageHeader
        title="預約管理"
        subtitle="管理所有球場、活動和教練預約"
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            新增預約
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<CalendarDays className="h-5 w-5" />} label="篩選結果" value={kpi.total} unit="筆" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="待確認" value={kpi.pending} unit="筆" />
        <KPICard icon={<Users className="h-5 w-5" />} label="今日預約" value={kpi.today} unit="筆" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="已收款" value={kpi.paid.toLocaleString()} unit="元" />
      </div>

      {/* 篩選列 */}
      <div className="flex flex-col gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 md:flex-row md:flex-wrap md:items-center">
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <select aria-label="類型" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectClass}>
            <option value="ALL">全部類型</option>
            {(Object.keys(TYPE_LABEL) as ReservationType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </select>
          <select aria-label="狀態" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
            <option value="ALL">全部狀態</option>
            {(Object.keys(STATUS_META) as ReservationStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <select aria-label="球場" value={courtId} onChange={(e) => setCourtId(e.target.value)} className={selectClass}>
            <option value="ALL">全部球場</option>
            {courts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋訂單編號、會員姓名或電話"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] pl-8 pr-3 text-sm"
          />
        </label>
      </div>

      {/* 列表 */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState description={error} retry={load} />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
          <EmptyState title="沒有符合條件的預約" description="試著放寬期間或篩選條件" icon="📅" />
        </div>
      ) : (
        <>
          {/* 桌機：表格 */}
          <div className="hidden overflow-x-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">訂單</th>
                  <th className="px-4 py-3 font-medium">會員</th>
                  <th className="px-4 py-3 font-medium">類型</th>
                  <th className="px-4 py-3 font-medium">項目</th>
                  <th className="px-4 py-3 font-medium">時間</th>
                  <th className="px-4 py-3 font-medium text-right">人數</th>
                  <th className="px-4 py-3 font-medium text-right">金額</th>
                  <th className="px-4 py-3 font-medium">付款</th>
                  <th className="px-4 py-3 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const item = r.items[0]
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:surface-2"
                    >
                      <td className="px-4 py-3 font-mono font-medium">{r.bookingCode}</td>
                      <td className="px-4 py-3">{r.member?.name ?? '—'}</td>
                      <td className="px-4 py-3">{TYPE_LABEL[r.type]}</td>
                      <td className="px-4 py-3">{item?.name ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {item ? `${fmtDate(item.startTime)} ${fmtTime(item.startTime)}–${fmtTime(item.endTime)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item?.playerCount ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmtMoney(r.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={PAYMENT_META[r.paymentStatus].label} variant={PAYMENT_META[r.paymentStatus].variant} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={STATUS_META[r.status].label} variant={STATUS_META[r.status].variant} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 手機：卡片 */}
          <div className="space-y-2 md:hidden">
            {filtered.map((r) => {
              const item = r.items[0]
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-left hover:surface-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{r.bookingCode}</p>
                      <p className="truncate text-sm">{r.member?.name ?? '—'}　<span className="text-muted">{TYPE_LABEL[r.type]}</span></p>
                      <p className="mt-0.5 truncate text-xs text-muted">{item?.name}</p>
                      {item && (
                        <p className="mt-0.5 text-xs text-muted tabular-nums">
                          {fmtDate(item.startTime)} {fmtTime(item.startTime)}–{fmtTime(item.endTime)}　{item.playerCount} 人
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm">{fmtMoney(r.totalAmount)}</span>
                      <StatusBadge status={STATUS_META[r.status].label} variant={STATUS_META[r.status].variant} size="sm" />
                      <StatusBadge status={PAYMENT_META[r.paymentStatus].label} variant={PAYMENT_META[r.paymentStatus].variant} size="sm" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* 預約詳情 */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={`預約 ${selected.bookingCode}`} description={`${TYPE_LABEL[selected.type]}預約　建立於 ${fmtDateTime(selected.createdAt)}`}>
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={STATUS_META[selected.status].label} variant={STATUS_META[selected.status].variant} />
                <StatusBadge status={PAYMENT_META[selected.paymentStatus].label} variant={PAYMENT_META[selected.paymentStatus].variant} />
                {selected.checkedInAt && (
                  <StatusBadge status={`報到 ${fmtTime(selected.checkedInAt)}`} variant="info" />
                )}
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">會員</h3>
                {selected.member ? (
                  <div className="rounded-lg border border-[rgb(var(--border))] p-3">
                    <p className="font-medium">
                      {selected.member.name}
                      <span className="ml-2 text-xs text-muted">{MEMBERSHIP_LABEL[selected.member.membershipLevel]}會員</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{selected.member.phone}　{selected.member.email}</p>
                  </div>
                ) : (
                  <p className="text-muted">無會員資料</p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">預約項目</h3>
                <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-[rgb(var(--border))]">
                  {selected.items.map((i) => (
                    <li key={i.id} className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="font-medium">{i.name}</p>
                        <p className="mt-0.5 text-xs text-muted tabular-nums">
                          {fmtDateTime(i.startTime)} – {fmtTime(i.endTime)}
                          {i.courtId && courtName(i.courtId) ? `　${courtName(i.courtId)}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{i.playerCount} 人</p>
                      </div>
                      <span className="shrink-0 font-mono">{fmtMoney(i.price)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-muted">合計</span>
                  <span className="font-mono text-base font-semibold">{fmtMoney(selected.totalAmount)}</span>
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[rgb(var(--border))] p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted"><QrCode className="h-3.5 w-3.5" aria-hidden />QR Code</p>
                  <p className="mt-1 truncate font-mono text-xs">{selected.qrCode ?? '尚未產生'}</p>
                </div>
                <div className="rounded-lg border border-[rgb(var(--border))] p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />報到</p>
                  <p className="mt-1 text-xs">{selected.checkedInAt ? fmtDateTime(selected.checkedInAt) : '尚未報到'}</p>
                </div>
              </section>

              {selected.notes && (
                <section>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">備註</h3>
                  <p className="whitespace-pre-wrap">{selected.notes}</p>
                </section>
              )}

              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                {selected.status === 'PENDING' && (
                  <Button size="sm" onClick={() => updateStatus(selected.id, 'CONFIRMED')}>確認預約</Button>
                )}
                {selected.status === 'CONFIRMED' && (
                  <Button size="sm" onClick={() => updateStatus(selected.id, 'CHECKED_IN')}>報到</Button>
                )}
                {selected.status === 'CHECKED_IN' && (
                  <Button size="sm" onClick={() => updateStatus(selected.id, 'COMPLETED')}>完成</Button>
                )}
                {(selected.status === 'PENDING' || selected.status === 'CONFIRMED') && (
                  <Button size="sm" variant="danger" onClick={() => updateStatus(selected.id, 'CANCELLED')}>取消預約</Button>
                )}
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">編輯</Button>
              </div>
              <p className="text-xs text-muted">狀態變更目前僅更新畫面（mock 模式），Phase 2 會寫回資料庫。</p>
            </div>
          </SheetContent>
        )}
      </Sheet>

      {/* 新增預約（佔位） */}
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent title="新增預約" description="由後台代客建立球場、活動或教練預約">
          <EmptyState
            title="建立預約表單將於 Phase 2 實作"
            description="屆時可選擇會員、球場與時段，並直接產生 QR Code"
            icon="🛠️"
            action={<Button size="sm" variant="secondary" onClick={() => setCreating(false)}>關閉</Button>}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
