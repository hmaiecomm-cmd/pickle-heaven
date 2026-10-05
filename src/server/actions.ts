'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAvailability } from '@/lib/availability'
import { verifyLineIdToken } from '@/lib/line'
import { getPaymentProvider } from '@/lib/payments'
import type { ChargeInstruction } from '@/lib/payments'
import {
  clearSession,
  createSession,
  ensureCartToken,
  getCartToken,
  getSessionUser,
} from '@/lib/session'
import type { AvailabilityDTO, CartDTO, SessionUser } from '@/lib/types'
import {
  BookingError,
  cancelBooking,
  clearCart,
  createPendingBooking,
  extendHolds,
  getCart,
  holdSlot,
  quote,
  releaseReservation,
  releaseSlot,
} from './booking-service'

/** Server Action 統一回傳格式 */
export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string; code?: string }

function fail(err: unknown): { ok: false; error: string; code?: string } {
  if (err instanceof BookingError) return { ok: false, error: err.message, code: err.code }
  if (err instanceof Error && 'code' in err) {
    return { ok: false, error: err.message, code: String((err as { code: unknown }).code) }
  }
  console.error('[action] 未預期的錯誤', err)
  return { ok: false, error: '系統忙碌中，請稍後再試' }
}

/* ────────────────────────────── 登入 ────────────────────────────── */

/** LIFF 前端取得 id_token 後呼叫，由伺服器向 LINE 驗證 */
export async function loginWithLine(idToken: string): Promise<ActionResult<{ user: SessionUser }>> {
  try {
    if (!idToken) throw new BookingError('缺少 LINE id_token', 'UNAUTHORIZED')
    const profile = await verifyLineIdToken(idToken)

    const user = await prisma.user.upsert({
      where: { lineUserId: profile.lineUserId },
      update: { displayName: profile.displayName, pictureUrl: profile.pictureUrl },
      create: {
        lineUserId: profile.lineUserId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        email: profile.email,
      },
    })

    await createSession(user.id)
    return {
      ok: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
        phone: user.phone,
        points: user.points,
        role: user.role,
      },
    }
  } catch (err) {
    return fail(err)
  }
}

/**
 * 開發用登入（不需 LINE 環境）。
 * 僅在 DEV_LOGIN=1 時啟用，正式部署請關閉。
 */
export async function devLogin(displayName = '測試球友'): Promise<ActionResult<{ user: SessionUser }>> {
  try {
    if (process.env.DEV_LOGIN !== '1') throw new BookingError('開發登入已停用', 'UNAUTHORIZED')

    const user = await prisma.user.upsert({
      where: { lineUserId: 'DEV_USER' },
      update: {},
      create: { lineUserId: 'DEV_USER', displayName, points: 300 },
    })
    await createSession(user.id)
    return {
      ok: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
        phone: user.phone,
        points: user.points,
        role: user.role,
      },
    }
  } catch (err) {
    return fail(err)
  }
}

export async function logout(): Promise<{ ok: true }> {
  await clearSession()
  return { ok: true }
}

export async function currentUser(): Promise<SessionUser | null> {
  return getSessionUser()
}

/* ────────────────────────────── 可用性與購物車 ────────────────────────────── */

export async function fetchAvailability(
  slug: string,
  date: string,
): Promise<ActionResult<{ data: AvailabilityDTO; cart: CartDTO }>> {
  try {
    const cartToken = await getCartToken()
    const [data, cart] = await Promise.all([getAvailability(slug, date, cartToken), getCart(cartToken)])
    return { ok: true, data, cart }
  } catch (err) {
    return fail(err)
  }
}

export async function fetchCart(): Promise<CartDTO> {
  const cartToken = await getCartToken()
  return getCart(cartToken)
}

const toggleSchema = z.object({
  slug: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  courtId: z.string().min(1),
  start: z.number().int().min(0).max(2880),
  action: z.enum(['hold', 'release']),
})

/**
 * 點選時段格：暫扣或釋放。
 * 回傳最新的矩陣與購物車，讓前端一次同步（避免搶單後畫面不同步）。
 */
export type ToggleResult =
  | { ok: true; data: AvailabilityDTO; cart: CartDTO }
  | { ok: false; error: string; code?: string; data?: AvailabilityDTO; cart?: CartDTO }

export async function toggleSlot(input: z.infer<typeof toggleSchema>): Promise<ToggleResult> {
  try {
    const { slug, date, courtId, start, action } = toggleSchema.parse(input)
    const cartToken = await ensureCartToken()

    if (action === 'hold') {
      await holdSlot(cartToken, slug, date, courtId, start)
    } else {
      await releaseSlot(cartToken, courtId, date, start)
    }

    const [data, cart] = await Promise.all([getAvailability(slug, date, cartToken), getCart(cartToken)])
    return { ok: true, data, cart }
  } catch (err) {
    // 搶單失敗時仍回傳最新狀態，讓該格立刻變成「他人暫扣」
    if (err instanceof BookingError && err.code === 'SLOT_TAKEN') {
      try {
        const cartToken = await getCartToken()
        const [data, cart] = await Promise.all([
          getAvailability(input.slug, input.date, cartToken),
          getCart(cartToken),
        ])
        return { ok: false, error: err.message, code: err.code, data, cart }
      } catch {
        /* 忽略，落回一般錯誤處理 */
      }
    }
    return fail(err)
  }
}

export async function removeCartItem(reservationId: string): Promise<ActionResult<{ cart: CartDTO }>> {
  try {
    const cartToken = await getCartToken()
    if (!cartToken) return { ok: true, cart: { items: [], subtotal: 0, expiresAt: null } }
    await releaseReservation(cartToken, reservationId)
    revalidatePath('/cart')
    return { ok: true, cart: await getCart(cartToken) }
  } catch (err) {
    return fail(err)
  }
}

export async function emptyCart(): Promise<ActionResult<{ cart: CartDTO }>> {
  try {
    const cartToken = await getCartToken()
    if (cartToken) await clearCart(cartToken)
    revalidatePath('/cart')
    return { ok: true, cart: { items: [], subtotal: 0, expiresAt: null } }
  } catch (err) {
    return fail(err)
  }
}

/** 使用者仍在結帳頁時延長暫扣 */
export async function keepHoldsAlive(minutes = 10): Promise<ActionResult<{ expiresAt: string }>> {
  try {
    const cartToken = await getCartToken()
    if (!cartToken) throw new BookingError('購物車是空的', 'CART_EMPTY')
    const expiresAt = await extendHolds(cartToken, minutes)
    return { ok: true, expiresAt: expiresAt.toISOString() }
  } catch (err) {
    return fail(err)
  }
}

/* ────────────────────────────── 結帳 ────────────────────────────── */

export async function previewQuote(
  voucherCode: string | null,
  usePoints: number,
): Promise<ActionResult<{ quote: Awaited<ReturnType<typeof quote>> }>> {
  try {
    const user = await getSessionUser()
    if (!user) throw new BookingError('請先以 LINE 登入', 'UNAUTHORIZED')
    const cartToken = await getCartToken()
    const cart = await getCart(cartToken)
    const q = await quote(cart, user.id, voucherCode, usePoints)
    return { ok: true, quote: q }
  } catch (err) {
    return fail(err)
  }
}

const createBookingSchema = z.object({
  contactName: z.string().min(1, '請填寫聯絡人姓名').max(40),
  contactPhone: z.string().min(9, '請填寫手機號碼').max(20),
  note: z.string().max(200).optional(),
  voucherCode: z.string().max(40).nullable().optional(),
  usePoints: z.number().int().min(0).max(1_000_000).optional(),
})

export async function submitBooking(
  input: z.infer<typeof createBookingSchema>,
): Promise<ActionResult<{ bookingId: string; code: string; total: number }>> {
  try {
    const user = await getSessionUser()
    if (!user) throw new BookingError('請先以 LINE 登入', 'UNAUTHORIZED')

    const parsed = createBookingSchema.parse(input)
    const cartToken = await getCartToken()
    if (!cartToken) throw new BookingError('購物車是空的', 'CART_EMPTY')

    const result = await createPendingBooking(user.id, cartToken, parsed)
    revalidatePath('/bookings')
    return { ok: true, ...result }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.errors[0]?.message ?? '輸入資料有誤', code: 'INVALID_INPUT' }
    }
    return fail(err)
  }
}

/** 建立金流付款單，回傳前端應如何完成付款 */
export async function startPayment(
  bookingId: string,
  providerId?: string,
): Promise<ActionResult<{ instruction: ChargeInstruction }>> {
  try {
    const user = await getSessionUser()
    if (!user) throw new BookingError('請先以 LINE 登入', 'UNAUTHORIZED')

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true, venue: true, user: true },
    })
    if (!booking || booking.userId !== user.id) throw new BookingError('找不到訂單', 'NOT_FOUND')
    if (booking.status !== 'PENDING') throw new BookingError('此訂單不需付款或已處理', 'PAYMENT_FAILED')
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      throw new BookingError('付款時間已逾時，請重新預約', 'HOLD_EXPIRED')
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const provider = getPaymentProvider(providerId)

    const instruction = await provider.createCharge({
      bookingId: booking.id,
      bookingCode: booking.code,
      amount: booking.total,
      description: `${booking.venue.name} 場地預約 ${booking.items.length} 個時段`,
      itemNames: booking.items.map((i) => `${i.courtName} ${i.rateName}`),
      customer: {
        name: booking.contactName,
        phone: booking.contactPhone,
        email: booking.user.email,
      },
      returnUrl: `${appUrl}/checkout/result?booking=${booking.id}`,
      notifyUrl: `${appUrl}/api/payments/${provider.id}/notify`,
      cancelUrl: `${appUrl}/checkout/${booking.id}`,
    })

    return { ok: true, instruction }
  } catch (err) {
    return fail(err)
  }
}

export async function cancelMyBooking(bookingId: string): Promise<ActionResult<{ refundPoints: number; ratio: number }>> {
  try {
    const user = await getSessionUser()
    if (!user) throw new BookingError('請先以 LINE 登入', 'UNAUTHORIZED')
    const result = await cancelBooking(bookingId, user.id)
    revalidatePath('/bookings')
    revalidatePath(`/bookings/${bookingId}`)
    return { ok: true, ...result }
  } catch (err) {
    return fail(err)
  }
}

/** 補填手機號碼（首次結帳時保存，之後自動帶入） */
export async function saveProfile(phone: string): Promise<ActionResult<{ phone: string }>> {
  try {
    const user = await getSessionUser()
    if (!user) throw new BookingError('請先以 LINE 登入', 'UNAUTHORIZED')
    await prisma.user.update({ where: { id: user.id }, data: { phone } })
    return { ok: true, phone }
  } catch (err) {
    return fail(err)
  }
}
