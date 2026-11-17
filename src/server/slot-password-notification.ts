/**
 * 時段密碼 LINE 通知
 *
 * - 門禁密碼只透過 LINE 發送；不使用 Email、Instagram、簡訊或其他管道。
 * - 會員未綁定 LINE：不改用其他管道，記錄失敗原因「會員尚未綁定 LINE」，後台可在會員綁定後重新發送。
 * - 每筆「時段 × 訂單」一筆 SlotPasswordLog（唯一），記錄 userId、bookingId、slotPasswordId、
 *   sentAt、sendStatus、providerMessageId、failureReason、retryCount。
 */

import 'server-only'
import { prisma } from '@/lib/db'
import { pushMessages } from '@/lib/line'
import { formatMinute, now, taipeiDateString, taipeiMinuteOfDay } from '@/lib/time'
import { decryptCode, SLOT_TYPE_LABEL } from './slot-password-service'

export type PushFn = (lineUserId: string, messages: unknown[]) => Promise<boolean>

export const NOT_BOUND_REASON = '會員尚未綁定 LINE'
export const MAX_AUTO_RETRY = 5

const hm = (d: Date) => formatMinute(taipeiMinuteOfDay(d))
const ymd = (d: Date) => taipeiDateString(d).replace(/-/g, '/')

/** LINE 文字訊息內容（純文字，任何 LINE 版本都能正常顯示） */
export function buildPasswordMessage(input: {
  venueName: string
  venuePhone: string | null
  bookingCode: string
  itemStartAt: Date
  itemEndAt: Date
  code: string
  openAt: Date
  expireAt: Date
  slotType: string
}): string {
  const lines = [
    '【門禁密碼通知】',
    '',
    `場館：${input.venueName}`,
    `預約日期：${ymd(input.itemStartAt)}`,
    `預約時段：${hm(input.itemStartAt)}～${hm(input.itemEndAt)}`,
    '',
    `門禁密碼：${input.code}`,
    '',
    `開放時間：${ymd(input.openAt)} ${hm(input.openAt)} 起`,
    `失效時間：${ymd(input.expireAt)} ${hm(input.expireAt)}`,
    '',
    input.slotType.startsWith('ORDER_')
      ? '此密碼為您這筆訂單專用，請勿轉發給其他人。'
      : `此密碼為該時段（${SLOT_TYPE_LABEL(input.slotType)}）共用密碼，同時段的其他顧客可能使用同一組密碼，請勿轉發給其他人。`,
    `訂單編號：${input.bookingCode}`,
  ]
  if (input.venuePhone) lines.push(`場館客服：${input.venuePhone}`)
  return lines.join('\n')
}

export type SendOutcome = { ok: true } | { ok: false; reason: string }

/**
 * 把某時段密碼發給某筆訂單的顧客（只用 LINE）。
 * 只在訂單仍為有效訂單、且仍關聯此時段時發送，避免改期／取消後還收到舊時段密碼。
 */
export async function sendSlotPasswordToBooking(
  slotPasswordId: string,
  bookingId: string,
  opts: { send?: PushFn; isRetry?: boolean } = {},
): Promise<SendOutcome> {
  const send = opts.send ?? pushMessages
  const link = await prisma.bookingSlotPassword.findUnique({
    where: { bookingId_slotPasswordId: { bookingId, slotPasswordId } },
    include: {
      slotPassword: true,
      booking: { select: { id: true, code: true, status: true, userId: true, user: { select: { lineUserId: true } }, venue: { select: { name: true, phone: true } } } },
    },
  })
  if (!link) return { ok: false, reason: '訂單已不在此時段（已改期或取消）' }
  const { booking, slotPassword: slot } = link
  if (booking.status !== 'PAID' && booking.status !== 'COMPLETED') return { ok: false, reason: '訂單已非有效訂單，不發送密碼' }
  if (slot.status === 'LOCKED' || slot.status === 'CANCELLED' || slot.status === 'EXPIRED') return { ok: false, reason: '時段已鎖定或失效，不發送密碼' }

  const key = { slotPasswordId_bookingId: { slotPasswordId, bookingId } }
  const at = now()
  const retryData = opts.isRetry ? { retryCount: { increment: 1 }, lastRetryAt: at } : {}
  await prisma.slotPasswordLog.upsert({
    where: key,
    create: { slotPasswordId, bookingId, userId: booking.userId, sendStatus: 'PENDING' },
    update: { sendStatus: opts.isRetry ? 'RETRYING' : 'PENDING', ...retryData },
  })

  const lineUserId = booking.user.lineUserId
  if (!lineUserId) {
    await prisma.slotPasswordLog.update({ where: key, data: { sendStatus: 'FAILED', failureReason: NOT_BOUND_REASON } })
    return { ok: false, reason: NOT_BOUND_REASON }
  }

  let ok = false
  let reason = 'LINE 推播失敗（可能未加官方帳號好友或 LINE 服務異常）'
  try {
    const text = buildPasswordMessage({
      venueName: booking.venue.name,
      venuePhone: booking.venue.phone,
      bookingCode: booking.code,
      itemStartAt: link.itemStartAt,
      itemEndAt: link.itemEndAt,
      code: decryptCode(slot.codeCiphertext),
      openAt: slot.openAt,
      expireAt: slot.expireAt,
      slotType: slot.slotType,
    })
    ok = await send(lineUserId, [{ type: 'text', text }])
  } catch (err) {
    reason = `發送例外：${err instanceof Error ? err.message : String(err)}`.slice(0, 300)
  }

  await prisma.slotPasswordLog.update({
    where: key,
    data: ok ? { sendStatus: 'SENT', sentAt: now(), failureReason: null } : { sendStatus: 'FAILED', failureReason: reason },
  })
  return ok ? { ok: true } : { ok: false, reason }
}

/**
 * 自動重試失敗的 LINE 發送（由排程呼叫）。
 * - 只重試仍有效、仍在此時段、時段未鎖定／未失效的訂單。
 * - 會員仍未綁定 LINE 的不重試（不消耗次數），等會員綁定或後台手動重新發送。
 * - 每筆最多自動重試 MAX_AUTO_RETRY 次。
 */
export async function retryFailedSlotPasswordLogs(
  opts: { send?: PushFn; limit?: number; at?: Date } = {},
): Promise<{ attempted: number; sent: number; failed: number; skipped: number }> {
  const at = opts.at ?? now()
  const logs = await prisma.slotPasswordLog.findMany({
    where: {
      sendStatus: { in: ['FAILED', 'RETRYING', 'PENDING'] },
      retryCount: { lt: MAX_AUTO_RETRY },
      slotPassword: { status: { in: ['SCHEDULED', 'ACTIVE'] }, expireAt: { gt: at } },
      booking: { status: { in: ['PAID', 'COMPLETED'] } },
    },
    include: { booking: { select: { user: { select: { lineUserId: true } } } } },
    orderBy: { updatedAt: 'asc' },
    take: opts.limit ?? 50,
  })
  const summary = { attempted: 0, sent: 0, failed: 0, skipped: 0 }
  for (const log of logs) {
    if (!log.booking.user.lineUserId) {
      summary.skipped++
      continue
    }
    summary.attempted++
    const r = await sendSlotPasswordToBooking(log.slotPasswordId, log.bookingId, { send: opts.send, isRetry: true })
    if (r.ok) summary.sent++
    else summary.failed++
  }
  return summary
}
