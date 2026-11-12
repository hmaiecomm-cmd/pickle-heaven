/**
 * 後台管理員 Session 管理
 * 使用 JWT + HttpOnly Cookie 的組合
 */

import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'fallback-secret-do-not-use-in-production'
)

export interface AdminSessionPayload {
  adminId: string
  email?: string
  role: string
  iat?: number
  exp?: number
}

const COOKIE_NAME = 'admin_session'
const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * 建立新的 Admin Session
 */
export async function createAdminSession(payload: AdminSessionPayload): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_DURATION)

  const token = await new SignJWT({
    adminId: payload.adminId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET)

  return token
}

/**
 * 驗證並解析 JWT token
 */
export async function verifyAdminSession(token: string): Promise<AdminSessionPayload | null> {
  try {
    const verified = await jwtVerify(token, SECRET)
    return verified.payload as AdminSessionPayload
  } catch (error) {
    console.error('Session verification failed:', error)
    return null
  }
}

/**
 * 從 Cookie 中取得 Session
 */
export async function getAdminSessionFromCookie(): Promise<AdminSessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) {
      return null
    }

    return await verifyAdminSession(token)
  } catch (error) {
    console.error('Failed to get session from cookie:', error)
    return null
  }
}

/**
 * 設置 Session Cookie
 */
export async function setAdminSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies()
    const expiresAt = new Date(Date.now() + SESSION_DURATION)

    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
  } catch (error) {
    console.error('Failed to set session cookie:', error)
  }
}

/**
 * 清除 Session Cookie
 */
export async function clearAdminSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
  } catch (error) {
    console.error('Failed to clear session cookie:', error)
  }
}
