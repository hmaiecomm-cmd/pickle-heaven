import 'server-only'
import { prisma } from '@/lib/db'
import { taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'

const BOOKING_STATUS_LABEL: Record<string, string> = {
  PENDING: '待付款',
  PAID: '已付款',
  CANCELLED: '已取消',
  EXPIRED: '逾時未付款',
  COMPLETED: '已完成',
  REFUND_PENDING: '待退款',
}

export type ScheduleCellDetail =
  | {
      kind: 'BOOKING'
      bookingCode: string | null
      bookingStatus: string
      contactName: string | null
      /** 只有具訂單權限時才提供 */
      contactPhone?: string
      total?: number
    }
  | { kind: 'HOLD' }
  | { kind: 'BLOCK'; note: string }
  | { kind: 'MAINTENANCE'; planName: string; planType: string }

/**
 * 智慧排程格子的詳細資料，key 為 `${courtId}@${startMinute}`。
 * 一筆占用跨多個時段格時，每一格都會對應到同一筆資料。
 */
export async function getScheduleDetails(
  venueId: string,
  date: string,
  slotMinutes: number,
  opts: { includeContact: boolean },
): Promise<Record<string, ScheduleCellDetail>> {
  const rows = await prisma.reservation.findMany({
    where: {
      court: { venueId },
      status: { in: ['BOOKED', 'HELD', 'BLOCKED'] },
      startsAt: { lt: taipeiToUtc(date, 1440) },
      endsAt: { gt: taipeiToUtc(date, 0) },
    },
    select: {
      courtId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      note: true,
      booking: { select: { code: true, status: true, contactName: true, contactPhone: true, total: true } },
      maintenanceEvent: { select: { plan: { select: { name: true, type: true } } } },
    },
  })

  const out: Record<string, ScheduleCellDetail> = {}
  for (const r of rows) {
    let detail: ScheduleCellDetail
    if (r.status === 'HELD') detail = { kind: 'HOLD' }
    else if (r.status === 'BLOCKED') {
      detail = r.maintenanceEvent
        ? { kind: 'MAINTENANCE', planName: r.maintenanceEvent.plan.name, planType: r.maintenanceEvent.plan.type }
        : { kind: 'BLOCK', note: r.note ?? '場館維護' }
    } else {
      const b = r.booking
      detail = {
        kind: 'BOOKING',
        bookingCode: b?.code ?? null,
        bookingStatus: b ? (BOOKING_STATUS_LABEL[b.status] ?? b.status) : '已預約',
        contactName: b?.contactName ?? null,
        ...(opts.includeContact && b ? { contactPhone: b.contactPhone, total: b.total } : {}),
      }
    }
    const sameDay = (d: Date, fallback: number) => (d >= taipeiToUtc(date, 0) && d < taipeiToUtc(date, 1440) ? taipeiMinuteOfDay(d) : fallback)
    const start = sameDay(r.startsAt, 0)
    const end = r.endsAt >= taipeiToUtc(date, 1440) ? 1440 : taipeiMinuteOfDay(r.endsAt)
    for (let m = start; m < end; m += slotMinutes) out[`${r.courtId}@${m}`] = detail
  }
  return out
}
