import Link from 'next/link'
import { CalendarCheck, CircleDollarSign, Percent, TriangleAlert } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { Card, CardContent } from '@/components/ui/card'
import { BookingStatusBadge } from '@/components/ui/badge'
import { formatDateFull, formatRange, slotStarts, taipeiDateString, taipeiToUtc } from '@/lib/time'
import { ntd } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  await requireAdmin()

  const today = taipeiDateString()

  const venue = await prisma.venue.findFirst({
    where: { active: true },
    include: { courts: { where: { active: true } } },
    orderBy: { name: 'asc' },
  })

  if (!venue) {
    return <p className="text-sm text-muted">尚未建立場館，請先執行 npm run db:seed。</p>
  }

  // 使用率以「營業時段」為分母；營收則以「整個自然日」計算，
  // 否則營業前（例如清晨）完成的付款會被漏掉。
  const dayStart = taipeiToUtc(today, venue.openMinute)
  const dayEnd = taipeiToUtc(today, venue.closeMinute)
  const revenueStart = taipeiToUtc(today, 0)
  const revenueEnd = taipeiToUtc(today, 1440)

  const [todayBookings, paidToday, pendingCount, bookedSlots] = await Promise.all([
    prisma.booking.findMany({
      where: { venueId: venue.id, playDate: today },
      include: { items: { orderBy: { startsAt: 'asc' } }, user: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.aggregate({
      where: {
        venueId: venue.id,
        status: { in: ['PAID', 'COMPLETED'] },
        paidAt: { gte: revenueStart, lt: revenueEnd },
      },
      _sum: { total: true },
    }),
    prisma.booking.count({ where: { venueId: venue.id, status: 'PENDING' } }),
    prisma.reservation.count({
      where: {
        courtId: { in: venue.courts.map((c) => c.id) },
        startsAt: { gte: dayStart, lt: dayEnd },
        status: 'BOOKED',
      },
    }),
  ])

  const totalSlots = slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes).length * venue.courts.length
  const occupancy = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">今日總覽</h1>
        <p className="mt-1 text-sm text-muted">
          {venue.name} · {formatDateFull(today)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CircleDollarSign} label="今日營收" value={ntd(paidToday._sum.total ?? 0)} />
        <Stat icon={CalendarCheck} label="今日訂單" value={String(todayBookings.length)} />
        <Stat icon={Percent} label="場地使用率" value={`${occupancy}%`} sub={`${bookedSlots} / ${totalSlots} 時段`} />
        <Stat icon={TriangleAlert} label="待付款" value={String(pendingCount)} tone={pendingCount > 0 ? 'warn' : undefined} />
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">今日預約</h2>
            <Link href="/admin/bookings" className="text-xs text-brand-600 hover:underline">
              查看全部訂單 →
            </Link>
          </div>

          {todayBookings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">今天還沒有預約</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
                    <th className="py-2 font-medium">訂單編號</th>
                    <th className="py-2 font-medium">預約人</th>
                    <th className="py-2 font-medium">時段</th>
                    <th className="py-2 text-right font-medium">金額</th>
                    <th className="py-2 text-right font-medium">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border))]">
                  {todayBookings.map((b) => {
                    const base = taipeiToUtc(b.playDate, 0).getTime()
                    return (
                      <tr key={b.id} className="hover:surface-2">
                        <td className="py-2.5">
                          <Link href={`/admin/bookings?q=${b.code}`} className="tabular text-brand-600 hover:underline">
                            {b.code}
                          </Link>
                        </td>
                        <td className="py-2.5">
                          {b.contactName}
                          <span className="ml-1.5 text-xs text-muted tabular">{b.contactPhone}</span>
                        </td>
                        <td className="py-2.5 text-xs text-muted">
                          {b.items
                            .map(
                              (it) =>
                                `${it.courtName} ${formatRange(
                                  Math.round((it.startsAt.getTime() - base) / 60_000),
                                  Math.round((it.endsAt.getTime() - base) / 60_000),
                                )}`,
                            )
                            .join('、')}
                        </td>
                        <td className="py-2.5 text-right tabular">{ntd(b.total)}</td>
                        <td className="py-2.5 text-right">
                          <BookingStatusBadge status={b.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  tone?: 'warn'
}) {
  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {label}
        </div>
        <p className={`text-2xl font-semibold tabular ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted tabular">{sub}</p>}
      </CardContent>
    </Card>
  )
}
