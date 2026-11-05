import 'server-only'
import { BookingStatus } from '@prisma/client'
import { brand } from '@/config/site'
import { prisma } from '@/lib/db'
import { bookingLink, pushMessages } from '@/lib/line'
import { formatDateFull, formatMinute, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'
import { queueNotification } from './session-scheduler'

/**
 * 預約的 LINE 開打提醒（/api/cron/reminders 每 15 分鐘呼叫）：
 * - 前一天：開打前一天 20:00（台北時間）起發送。
 * - 前兩小時：開打前 2 小時起發送；連續或重疊的時段視為同一段，只提醒一次。
 *
 * 提醒時間到了才付款的訂單不補發（剛收到預約成功通知）。
 * 靠 NotificationLog.dedupeKey 去重，重複執行不會重複發送；發送失敗（例如尚未加好友）記為 FAILED，不重試。
 */

/** 前一天提醒的時間：開打當天 00:00 往前 4 小時，即前一天 20:00 */
const DAY_BEFORE_LEAD_MS = 4 * 3_600_000
const TWO_HOURS_MS = 2 * 3_600_000
/** 前一天 20:00 距離當天最晚的時段不超過 28 小時 */
const LOOKAHEAD_MS = 30 * 3_600_000
const BATCH_LIMIT = 500

export type ReminderKind = 'DAY_BEFORE' | 'TWO_HOURS'

export interface ReminderLine {
  label: string
  startsAt: Date
  endsAt: Date
}

export interface DueReminder {
  kind: ReminderKind
  dedupeKey: string
  lines: ReminderLine[]
}

/** 這筆訂單此刻該發的提醒（不含去重，去重由 NotificationLog 處理） */
export function dueReminders(bookingId: string, lines: ReminderLine[], bookedAt: Date, now: Date): DueReminder[] {
  const sorted = [...lines].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  const due: DueReminder[] = []

  const byDate = new Map<string, ReminderLine[]>()
  for (const line of sorted) {
    const date = taipeiDateString(line.startsAt)
    byDate.set(date, [...(byDate.get(date) ?? []), line])
  }
  for (const [date, dayLines] of byDate) {
    const midnight = taipeiToUtc(date, 0).getTime()
    const sendAt = midnight - DAY_BEFORE_LEAD_MS
    if (now.getTime() >= sendAt && now.getTime() < midnight && bookedAt.getTime() < sendAt) {
      due.push({ kind: 'DAY_BEFORE', dedupeKey: `BOOKING_REMINDER:DAY_BEFORE:${bookingId}:${date}`, lines: dayLines })
    }
  }

  const groups: ReminderLine[][] = []
  let groupEnd = 0
  for (const line of sorted) {
    if (groups.length > 0 && line.startsAt.getTime() <= groupEnd) groups[groups.length - 1].push(line)
    else groups.push([line])
    groupEnd = Math.max(groupEnd, line.endsAt.getTime())
  }
  for (const group of groups) {
    const start = group[0].startsAt.getTime()
    const sendAt = start - TWO_HOURS_MS
    if (now.getTime() >= sendAt && now.getTime() < start && bookedAt.getTime() < sendAt) {
      due.push({ kind: 'TWO_HOURS', dedupeKey: `BOOKING_REMINDER:TWO_HOURS:${bookingId}:${start}`, lines: group })
    }
  }

  return due
}

/** 提醒文字。不寫「還有幾小時」，排程延遲時內容仍然正確 */
export function buildReminderText(
  kind: ReminderKind,
  booking: { id: string; code: string; address: string },
  lines: ReminderLine[],
): string {
  const heading = kind === 'DAY_BEFORE' ? '明天開打提醒' : '今天開打提醒'
  const lineText = lines.map((l) => `${l.label} ${formatMinute(taipeiMinuteOfDay(l.startsAt))}–${formatMinute(taipeiMinuteOfDay(l.endsAt))}`)
  return [
    `【${brand.name}】${heading}`,
    '',
    formatDateFull(taipeiDateString(lines[0].startsAt)),
    ...lineText,
    '',
    `報到編號：${booking.code}`,
    '請於開打前 10 分鐘至櫃台報到。',
    ...(booking.address ? [`地址：${booking.address}`] : []),
    `預約詳情：${bookingLink(booking.id)}`,
  ].join('\n')
}

/** 發送所有到期的提醒。send 可替換，測試時不會真的發 LINE */
export async function sendDueReminders(now = new Date(), send: typeof pushMessages = pushMessages) {
  const window = { gt: now, lte: new Date(now.getTime() + LOOKAHEAD_MS) }
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PAID,
      user: { lineUserId: { not: null } },
      OR: [
        { items: { some: { status: 'ACTIVE', startsAt: window } } },
        { activityItems: { some: { status: 'ACTIVE', startsAt: window } } },
      ],
    },
    take: BATCH_LIMIT,
    select: {
      id: true,
      code: true,
      userId: true,
      paidAt: true,
      createdAt: true,
      user: { select: { lineUserId: true } },
      venue: { select: { address: true } },
      items: { where: { status: 'ACTIVE' }, select: { courtName: true, startsAt: true, endsAt: true } },
      activityItems: { where: { status: 'ACTIVE' }, select: { title: true, startsAt: true, endsAt: true } },
    },
  })

  let sent = 0
  let failed = 0
  for (const b of bookings) {
    const lines: ReminderLine[] = [
      ...b.items.map((it) => ({ label: it.courtName, startsAt: it.startsAt, endsAt: it.endsAt })),
      ...b.activityItems.map((it) => ({ label: it.title, startsAt: it.startsAt, endsAt: it.endsAt })),
    ]
    for (const reminder of dueReminders(b.id, lines, b.paidAt ?? b.createdAt, now)) {
      // 已發過的先略過，避免每次排程都撞唯一鍵、留下錯誤紀錄
      const existing = await prisma.notificationLog.findUnique({ where: { dedupeKey: reminder.dedupeKey }, select: { id: true } })
      if (existing) continue
      // 先佔位再發送：同時執行時只有一次會發
      const claimed = await queueNotification({
        dedupeKey: reminder.dedupeKey,
        type: 'REMINDER',
        userId: b.userId,
        payload: { bookingId: b.id, kind: reminder.kind },
      })
      if (!claimed) continue
      const text = buildReminderText(reminder.kind, { id: b.id, code: b.code, address: b.venue.address }, reminder.lines)
      const ok = await send(b.user.lineUserId!, [{ type: 'text', text }])
      await prisma.notificationLog.update({
        where: { dedupeKey: reminder.dedupeKey },
        data: ok ? { status: 'SENT', sentAt: new Date() } : { status: 'FAILED', error: 'LINE 推播失敗或未發送' },
      })
      if (ok) sent++
      else failed++
    }
  }

  return { checked: bookings.length, remindersSent: sent, remindersFailed: failed }
}
