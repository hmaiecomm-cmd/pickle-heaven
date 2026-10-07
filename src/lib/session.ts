import 'server-only'
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

/** 讀取目前登入者，未登入回傳 null */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret())
    const uid = payload.uid as string
    if (!uid) return null

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, displayName: true, pictureUrl: true, phone: true, points: true, role: true },
    })
    if (!user) return null
    return {
      id: user.id,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
      phone: user.phone,
      points: user.points,
      role: user.role,
    }
  } catch {
    return null
  }
}

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
