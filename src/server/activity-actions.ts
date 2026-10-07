'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCart } from '@/lib/availability'
import { ensureCartToken, getCartToken, getSessionUser } from '@/lib/session'
import type { ActivitySessionDTO } from '@/lib/activity-shared'
import type { CartDTO } from '@/lib/types'
import {
  getSessionDTO,
  getUpcomingSessions,
  holdSeats,
  notifySeatWatchers,
  releaseSeatHold,
  seatAlertsEnabled,
  SignupError,
  unwatchSession,
  watchSession,
} from './activity-service'

/**
 * 前台活動操作。業務規則都在 activity-service，這一層只負責登入檢查與回傳格式。
 * 加入購物車只是「暫留名額」，必須完成付款才算報名成功。
 */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string }

function fail(err: unknown): { ok: false; error: string; code?: string } {
  if (err instanceof SignupError) return { ok: false, error: err.message, code: err.code }
  if (err instanceof z.ZodError) return { ok: false, error: '輸入資料有誤', code: 'INVALID_INPUT' }
  console.error('[activity-action]', err)
  return { ok: false, error: '系統忙碌中，請稍後再試' }
}

export async function fetchSessionDetail(
  sessionId: string,
): Promise<Result<{ session: ActivitySessionDTO; alertsEnabled: boolean }>> {
  try {
    const user = await getSessionUser()
    const session = await getSessionDTO(sessionId, user?.id ?? null)
    if (!session) return { ok: false, error: '找不到這場活動，可能已下架', code: 'NOT_FOUND' }
    return { ok: true, session, alertsEnabled: seatAlertsEnabled() }
  } catch (err) {
    return fail(err)
  }
}

/** 近期活動（不含指定日期），供「這一天暫無活動」時列出 */
export async function fetchUpcomingSessions(excludeDate?: string): Promise<Result<{ sessions: ActivitySessionDTO[] }>> {
  try {
    const user = await getSessionUser()
    const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true } })
    if (!venue) return { ok: true, sessions: [] }
    const sessions = await getUpcomingSessions(venue.id, user?.id ?? null, { limit: 6, excludeDate })
    return { ok: true, sessions }
  } catch (err) {
    return fail(err)
  }
}

const addSchema = z.object({ sessionId: z.string().min(1), quantity: z.number().int().min(1).max(20) })

export async function addActivityToCart(
  input: z.infer<typeof addSchema>,
): Promise<Result<{ cart: CartDTO; session: ActivitySessionDTO | null }>> {
  try {
    const { sessionId, quantity } = addSchema.parse(input)
    const user = await getSessionUser()
    if (!user) return { ok: false, error: '請先登入再報名', code: 'UNAUTHORIZED' }
    const cartToken = await ensureCartToken()
    await holdSeats({ userId: user.id, cartToken, sessionId, quantity })
    const [cart, session] = await Promise.all([getCart(cartToken), getSessionDTO(sessionId, user.id)])
    revalidatePath('/sessions')
    return { ok: true, cart, session }
  } catch (err) {
    return fail(err)
  }
}

export async function removeActivityFromCart(registrationId: string): Promise<Result<{ cart: CartDTO }>> {
  try {
    const cartToken = await getCartToken()
    if (!cartToken) return { ok: true, cart: { items: [], activityItems: [], subtotal: 0, expiresAt: null } }
    const sessionId = await releaseSeatHold(cartToken, registrationId)
    if (sessionId) await notifySeatWatchers([sessionId]).catch(() => {})
    revalidatePath('/cart')
    return { ok: true, cart: await getCart(cartToken) }
  } catch (err) {
    return fail(err)
  }
}

export async function toggleSeatAlert(sessionId: string, on: boolean): Promise<Result<{ watching: boolean }>> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: '請先登入', code: 'UNAUTHORIZED' }
    if (on) await watchSession(user.id, sessionId)
    else await unwatchSession(user.id, sessionId)
    return { ok: true, watching: on }
  } catch (err) {
    return fail(err)
  }
}
