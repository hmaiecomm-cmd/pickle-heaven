import Link from 'next/link'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { prisma } from '@/lib/db'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { BookingStatusBadge } from '@/components/ui/badge'
import { formatDateFull, formatRange, slotStarts, taipeiDateString, taipeiToUtc } from '@/lib/time'
import { ntd } from '@/lib/utils'
import { detectIncidents, getMonitorSnapshot, listIncidents } from '@/server/monitor-service'
import { getUpcomingSessions } from '@/server/activity-service'
import { MonitorBoard } from '@/components/admin/monitor-board'
import { Pill, SourceNote } from '@/components/admin/page-bits'
import { AskAiButton, RefreshButton } from './overview-buttons'

export const dynamic = 'force-dynamic'

/**
 * 今日總覽：先看 AI 營運與場地監測（優先處理的異常、場地狀態），
 * 財務、活動與訂單數字放在下方，依權限顯示，預設收合。
 */
export default async function AdminDashboard() {
  const ctx = await getAdminContext()
  if (!ctx) return null
  const today = taipeiDateString()
  const venue = await prisma.venue.findFirst({
    where: { active: true },
    include: { courts: { where: { active: true } } },
    orderBy: { name: 'asc' },
  })
  if (!venue) return <p className="text-sm text-muted">尚未建立場館。</p>

  const showMonitor = can(ctx.role, 'monitor')
  if (showMonitor) await detectIncidents()
  const [snap, incidents] = showMonitor ? await Promise.all([getMonitorSnapshot(), listIncidents('OPEN', 50)]) : [null, []]

  const showFinance = can(ctx.role, 'finance')
  const dayStart = taipeiToUtc(today, venue.openMinute)
  const dayEnd = taipeiToUtc(today, venue.closeMinute)
  const [todayBookings, paidToday, pendingCount, bookedSlots, refundsToday, sessions] = await Promise.all([
    prisma.booking.findMany({
      where: { venueId: venue.id, playDate: today },
      include: { items: { orderBy: { startsAt: 'asc' } }, activityItems: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    showFinance
      ? prisma.booking.aggregate({ where: { venueId: venue.id, status: { in: ['PAID', 'COMPLETED'] }, paidAt: { gte: taipeiToUtc(today, 0), lt: taipeiToUtc(today, 1440) } }, _sum: { total: true } })
      : Promise.resolve(null),
    prisma.booking.count({ where: { venueId: venue.id, status: 'PENDING' } }),
    prisma.reservation.count({ where: { courtId: { in: venue.courts.map((c) => c.id) }, startsAt: { gte: dayStart, lt: dayEnd }, status: { in: ['BOOKED', 'EVENT'] } } }),
    showFinance
      ? prisma.refund.aggregate({ where: { status: { in: ['SUCCEEDED', 'MANUAL_DONE'] }, completedAt: { gte: taipeiToUtc(today, 0), lt: taipeiToUtc(today, 1440) } }, _sum: { cashAmount: true }, _count: { _all: true } })
      : Promise.resolve(null),
    can(ctx.role, 'activities') ? getUpcomingSessions(venue.id, null, { days: 7, limit: 8 }) : Promise.resolve([]),
  ])
  const totalSlots = slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes).length * venue.courts.length
  const occupancy = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0
  const urgent = incidents.slice(0, 3)
  const generatedAt = new Date().toISOString()

  return (
    <div className="space-y-5">
      {/* 頂部：場館、日期、更新時間、詢問 AI */}
      <section className="rounded-2xl bg-[#281343] p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/70">今日總覽</p>
            <h1 className="mt-1 text-xl font-semibold">{venue.name}</h1>
            <p className="mt-0.5 text-sm text-white/80">{formatDateFull(today)}</p>
            <p className="mt-2 text-xs text-white/70">
              {snap
                ? snap.integration.mode === 'NOT_CONNECTED'
                  ? `設備：${snap.integration.label}（無即時設備資料）`
                  : `設備最後回報：${snap.lastDeviceUpdate ? new Date(snap.lastDeviceUpdate).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—'}（模擬）`
                : ''}
              ・頁面更新 {new Date(generatedAt).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
            </p>
          </div>
          <div className="flex gap-2">
            <RefreshButton />
            {can(ctx.role, 'ai') && <AskAiButton />}
          </div>
        </div>

        {showMonitor && (
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Mini label="待處理事件" value={String(incidents.length)} tone={incidents.length ? 'warn' : undefined} />
            <Mini label="依預約使用中" value={`${snap?.counts.inUseByBooking ?? 0}／${snap?.courts.length ?? 0} 面`} />
            <Mini label="設備離線／未知" value={snap?.integration.mode === 'NOT_CONNECTED' ? '未串接' : `${snap?.counts.offline ?? 0}／${snap?.counts.unknown ?? 0}`} />
            <Mini label="今日預約與活動時段" value={`${bookedSlots}／${totalSlots}（${occupancy}%）`} />
          </div>
        )}
      </section>

      {/* 優先處理 */}
      {showMonitor && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">優先處理</h2>
            <Link href="/admin/incidents" className="text-xs text-brand-700 hover:underline">
              全部事件 →
            </Link>
          </div>
          {urgent.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              目前沒有待處理的異常事件
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {urgent.map((i) => (
                <li key={i.id} className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 text-sm">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${i.severity === 'HIGH' ? 'text-red-600' : 'text-amber-600'}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{i.link ? <Link href={i.link} className="hover:underline">{i.title}</Link> : i.title}</p>
                    {i.detail && <p className="text-xs text-muted">{i.detail}</p>}
                  </div>
                  <Pill tone={i.severity === 'HIGH' ? 'red' : i.severity === 'MEDIUM' ? 'amber' : 'gray'}>{i.severity === 'HIGH' ? '高' : i.severity === 'MEDIUM' ? '中' : '低'}</Pill>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 場地監測與無人化 */}
      {snap && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">場地監測與無人化</h2>
            <div className="flex gap-3 text-xs">
              <Link href="/admin/monitor" className="text-brand-700 hover:underline">場地即時監測 →</Link>
              <Link href="/admin/control" className="text-brand-700 hover:underline">無人化控制 →</Link>
            </div>
          </div>
          <MonitorBoard snap={snap} compact />
        </section>
      )}

      {/* 營運數字：依權限顯示，預設收合 */}
      {showFinance && paidToday && (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            財務摘要：今日實收 {ntd(paidToday._sum.total ?? 0)}・今日退款 {ntd(refundsToday?._sum.cashAmount ?? 0)}・待付款 {pendingCount} 筆
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <Mini light label="今日實收（已付款訂單）" value={ntd(paidToday._sum.total ?? 0)} />
            <Mini light label={`今日退款（${refundsToday?._count._all ?? 0} 筆）`} value={ntd(refundsToday?._sum.cashAmount ?? 0)} />
            <Mini light label="待付款訂單" value={`${pendingCount} 筆`} />
          </div>
          <SourceNote className="mt-2" source="訂單付款紀錄與退款紀錄" basis="實收依付款時間；退款依完成時間；不含待付款" updatedAt={generatedAt} />
          <Link href="/admin/finance" className="mt-2 inline-block text-xs text-brand-700 hover:underline">收入與退款報表 →</Link>
        </details>
      )}

      {sessions.length > 0 && (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">活動報名：未來 7 天 {sessions.length} 場</summary>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/admin/sessions/${s.id}`} className="hover:underline">
                  {s.dateLabel} {s.timeLabel}　{s.title}
                </Link>
                <span className="text-xs text-muted">
                  {s.stateLabel}・剩 {s.remaining}／{s.capacity}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {can(ctx.role, 'bookings') && (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold">今日訂單 {todayBookings.length} 筆</summary>
          {todayBookings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">今天還沒有訂單</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {todayBookings.map((b) => {
                const base = taipeiToUtc(b.playDate, 0).getTime()
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/admin/bookings?order=${b.id}`} className="font-mono text-brand-700 hover:underline">{b.code}</Link>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted">
                      {[...b.items.map((it) => `${it.courtName} ${formatRange(Math.round((it.startsAt.getTime() - base) / 60_000), Math.round((it.endsAt.getTime() - base) / 60_000))}`), ...b.activityItems.map((a) => `活動 ${a.title}`)].join('、')}
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </li>
                )
              })}
            </ul>
          )}
        </details>
      )}
    </div>
  )
}

function Mini({ label, value, tone, light }: { label: string; value: string; tone?: 'warn'; light?: boolean }) {
  return (
    <div className={light ? 'rounded-xl bg-zinc-50 p-3' : 'rounded-xl bg-white/10 p-3'}>
      <p className={light ? 'text-[11px] text-muted' : 'text-[11px] text-white/70'}>{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular ${tone === 'warn' ? 'text-amber-300' : ''}`}>{value}</p>
    </div>
  )
}
