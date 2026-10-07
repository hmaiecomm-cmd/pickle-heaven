import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { prisma } from './db'
import type { SessionUser } from './types'

const SESSION_COOKIE = 'ph_session'
const CART_COOKIE = 'ph_cart'
const SESSION_DAYS = 30

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('缺少 SESSION_SECRET 環境變數（請設定至少 32 字元的隨機字串）')
  }
  return new TextEncoder().encode(s)
}

/** 建立顧客登入 session（HttpOnly JWT Cookie） */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret())

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  })
}

export async function clearSession(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

/** 資料庫或網路暫時故障，無法確認登入狀態（不是「未登入」） */
export class SessionUnavailableError extends Error {
  code = 'SESSION_UNAVAILABLE' as const
}

const USER_SELECT = { id: true, displayName: true, pictureUrl: true, phone: true, points: true, role: true } as const

/**
 * 讀取目前登入者：沒有 Cookie、簽章無效、會員不存在 → null（確認未登入）。
 * 資料庫查詢失敗會重試一次，仍失敗則丟出 SessionUnavailableError，由呼叫端顯示「重試」而非登入入口。
 * 以 React cache 包住：同一請求內版面與頁面共用同一次查詢，不會出現版面已登入、頁面卻未登入的情況。
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  let uid: string
  try {
    const { payload } = await jwtVerify(token, secret())
    if (typeof payload.uid !== 'string' || !payload.uid) return null
    uid = payload.uid
  } catch {
    return null // 過期或簽章不符：確認未登入
  }

  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const user = await prisma.user.findUnique({ where: { id: uid }, select: USER_SELECT })
      if (!user) return null
      return { id: user.id, displayName: user.displayName, pictureUrl: user.pictureUrl, phone: user.phone, points: user.points, role: user.role }
    } catch (err) {
      lastErr = err
    }
  }
  console.error('[session] 無法確認登入狀態（資料庫）', lastErr instanceof Error ? lastErr.message : lastErr)
  throw new SessionUnavailableError('暫時無法確認登入狀態，請稍後再試')
})

/** 要求登入，否則丟出錯誤（Server Action 內使用） */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new SessionError('請先登入')
  return user
}

export class SessionError extends Error {
  code = 'UNAUTHORIZED' as const
}

/**
 * 購物車識別碼。
 * 未登入也能瀏覽，但暫扣時會綁定此 token，
 * 用以區分「自己已選取」與「他人暫扣」。
 */
export async function getCartToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(CART_COOKIE)?.value ?? null
}

export async function ensureCartToken(): Promise<string> {
  const store = await cookies()
  const existing = store.get(CART_COOKIE)?.value
  if (existing) return existing

  const token = crypto.randomUUID()
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400,
  })
  return token
}
