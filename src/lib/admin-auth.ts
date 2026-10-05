import 'server-only'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { timingSafeEqual, scrypt as scryptCb, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { SignJWT, jwtVerify } from 'jose'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

const ADMIN_COOKIE = 'ph_admin'
const ADMIN_SESSION_HOURS = 12
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 64

/**
 * 後台身分驗證。
 *
 * 管理者以帳號 + 密碼登入；密碼以 scrypt 雜湊存放於 ADMIN_PASSWORD_HASH，
 * 登入後以 HttpOnly JWT Cookie 維持 session。
 */

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('缺少 SESSION_SECRET 環境變數（請設定至少 32 字元的隨機字串）')
  }
  return new TextEncoder().encode(s)
}

/** 產生可存進 ADMIN_PASSWORD_HASH 的字串，格式為 scrypt$salt$hash。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false

  const expected = Buffer.from(hashHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT_OPTIONS)
  // 長度相同才比對，timingSafeEqual 長度不一致會直接丟例外
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** 檢查帳密；成功則建立後台 session 並回傳 true。 */
export async function signInAdmin(username: string, password: string): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME
  const storedHash = process.env.ADMIN_PASSWORD_HASH

  if (!expectedUser || !storedHash) {
    console.warn('[admin] 未設定 ADMIN_USERNAME / ADMIN_PASSWORD_HASH，拒絕所有後台存取')
    return false
  }

  // 帳號錯誤時仍執行一次雜湊運算，避免由回應時間推測帳號是否存在
  const userOk = username.trim().toLowerCase() === expectedUser.trim().toLowerCase()
  const passwordOk = await verifyPassword(password, storedHash)
  if (!userOk || !passwordOk) return false

  const token = await new SignJWT({ sub: expectedUser })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_HOURS}h`)
    .sign(secret())

  const store = await cookies()
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_HOURS * 3600,
  })
  return true
}

export async function signOutAdmin(): Promise<void> {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
}

/** 回傳目前登入的管理者帳號，未登入則為 null。 */
export async function getAdminUser(): Promise<string | null> {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret())
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    // 過期或簽章不符
    return null
  }
}

export async function requireAdmin(): Promise<string> {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return user
}
