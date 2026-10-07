import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { timingSafeEqual, scrypt as scryptCb, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { SignJWT, jwtVerify } from 'jose'
import { isDemoConfigured, mainPrisma, type Tenant } from './db'
import { can, permissionsOf, type AdminRole, type Permission } from './admin-permissions'

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>

const ADMIN_COOKIE = 'ph_admin'
/** 登入後最長有效時間 */
const ADMIN_SESSION_HOURS = 12
/** 閒置逾時：超過這段時間沒有任何操作就要重新登入 */
const IDLE_MINUTES = 120
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 64
/** 登入嘗試限制：同帳號 15 分鐘內失敗 5 次、同 IP 失敗 20 次即暫停 */
const ATTEMPT_WINDOW_MS = 15 * 60_000
const MAX_FAILS_PER_USER = 5
const MAX_FAILS_PER_IP = 20

/**
 * 後台身分驗證。
 *
 * - 帳號存在正式資料庫的 AdminAccount，密碼以 scrypt 雜湊（scrypt$salt$hash）。
 * - 登入建立 AdminSession，並發出 HttpOnly JWT（sub、sid、tnt、role）。每次請求都會核對 session
 *   是否已登出、逾時或帳號停用，登出後即使保留舊 Cookie 也無法再讀取。
 * - 擁有者帳號可由環境變數 ADMIN_USERNAME / ADMIN_PASSWORD_HASH 初始化；
 *   展示帳號 DEMO 由環境變數 DEMO_ACCOUNT_PASSWORD 初始化。兩者都只在帳號不存在時建立，不會重設既有密碼。
 */

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('缺少 SESSION_SECRET 環境變數（請設定至少 32 字元的隨機字串）')
  }
  return new TextEncoder().encode(s)
}

/** 產生 scrypt$salt$hash 格式的密碼雜湊 */
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
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// 帳號不存在時也做一次雜湊，避免由回應時間推測帳號是否存在
const DUMMY_HASH = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128)

export const normalizeUsername = (u: string) => u.trim().toLowerCase()

/**
 * 依伺服器端設定建立初始帳號。可重複執行：帳號已存在就略過，不會改密碼。
 */
export async function ensureBootstrapAccounts(): Promise<{ created: string[] }> {
  const created: string[] = []
  const owner = process.env.ADMIN_USERNAME?.trim()
  const ownerHash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (owner && ownerHash) {
    const key = normalizeUsername(owner)
    const exists = await mainPrisma.adminAccount.findUnique({ where: { usernameKey: key }, select: { id: true } })
    if (!exists) {
      await mainPrisma.adminAccount
        .create({ data: { username: owner, usernameKey: key, displayName: owner, passwordHash: ownerHash, role: 'OWNER', tenant: 'main', createdBy: 'bootstrap:env' } })
        .then(() => created.push(owner))
        .catch(() => {}) // 同時建立時唯一鍵擋下，視為已存在
    }
  }
  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD
  if (demoPassword) {
    const exists = await mainPrisma.adminAccount.findUnique({ where: { usernameKey: 'demo' }, select: { id: true } })
    if (!exists) {
      await mainPrisma.adminAccount
        .create({
          data: {
            username: 'DEMO',
            usernameKey: 'demo',
            displayName: '展示帳號',
            passwordHash: await hashPassword(demoPassword),
            role: 'DEMO',
            tenant: 'demo',
            createdBy: 'bootstrap:env',
          },
        })
        .then(() => created.push('DEMO'))
        .catch(() => {})
    }
  }
  return { created }
}

async function requestMeta() {
  const h = await headers()
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'unknown').trim().slice(0, 64)
  return { ip, userAgent: (h.get('user-agent') ?? '').slice(0, 200) }
}

export type SignInResult = { ok: true } | { ok: false; error: string }

/** 檢查帳密；成功則建立 session 並寫入 Cookie。 */
export async function signInAdmin(username: string, password: string): Promise<SignInResult> {
  const key = normalizeUsername(username)
  const { ip, userAgent } = await requestMeta()
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS)

  const [userFails, ipFails] = await Promise.all([
    mainPrisma.adminLoginAttempt.count({ where: { usernameKey: key, success: false, createdAt: { gte: since } } }),
    mainPrisma.adminLoginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } }),
  ])
  if (userFails >= MAX_FAILS_PER_USER || ipFails >= MAX_FAILS_PER_IP) {
    return { ok: false, error: '登入失敗次數過多，請 15 分鐘後再試' }
  }

  await ensureBootstrapAccounts()
  const account = await mainPrisma.adminAccount.findUnique({ where: { usernameKey: key } })
  const passwordOk = await verifyPassword(password, account?.passwordHash ?? DUMMY_HASH)
  const ok = Boolean(account && account.active && passwordOk)
  await mainPrisma.adminLoginAttempt.create({ data: { usernameKey: key, ip, success: ok } })
  if (!ok || !account) return { ok: false, error: '帳號或密碼錯誤' }

  const tenant: Tenant = account.tenant === 'demo' ? 'demo' : 'main'
  if (tenant === 'demo' && !isDemoConfigured()) {
    return { ok: false, error: '展示環境尚未完成設定，請聯絡系統管理者' }
  }

  const expiresAt = new Date(Date.now() + ADMIN_SESSION_HOURS * 3600_000)
  const session = await mainPrisma.adminSession.create({
    data: { accountId: account.id, tenant, expiresAt, ip, userAgent },
  })
  await mainPrisma.adminAccount.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } })

  const token = await new SignJWT({ sid: session.id, tnt: tenant, role: account.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(account.username)
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
  return { ok: true }
}

/** 登出：撤銷伺服器端 session 並刪除 Cookie */
export async function signOutAdmin(): Promise<void> {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE)?.value
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret())
      if (typeof payload.sid === 'string') {
        await mainPrisma.adminSession.updateMany({ where: { id: payload.sid, revokedAt: null }, data: { revokedAt: new Date() } })
      }
    } catch {
      /* 憑證已無效，直接刪 Cookie */
    }
  }
  store.delete(ADMIN_COOKIE)
}

export interface AdminContext {
  accountId: string
  username: string
  displayName: string
  role: AdminRole
  tenant: Tenant
  sessionId: string
  permissions: Permission[]
}

/** 目前登入者（同一請求內快取）。session 被撤銷、逾時或帳號停用時回 null。 */
export const getAdminContext = cache(async (): Promise<AdminContext | null> => {
  const store = await cookies()
  const token = store.get(ADMIN_COOKIE)?.value
  if (!token) return null
  let payload: { sub?: string; sid?: unknown; tnt?: unknown }
  try {
    payload = (await jwtVerify(token, secret())).payload
  } catch {
    return null
  }
  if (typeof payload.sid !== 'string') return null // 舊版憑證（無 session），需重新登入

  const session = await mainPrisma.adminSession.findUnique({ where: { id: payload.sid }, include: { account: true } })
  const now = Date.now()
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now || !session.account.active) return null
  if (session.lastSeenAt.getTime() < now - IDLE_MINUTES * 60_000) {
    await mainPrisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } })
    return null
  }
  // 憑證的資料範圍必須與 session 一致（防止竄改）
  const tenant: Tenant = session.tenant === 'demo' ? 'demo' : 'main'
  if ((payload.tnt === 'demo' ? 'demo' : 'main') !== tenant) return null

  if (session.lastSeenAt.getTime() < now - 5 * 60_000) {
    await mainPrisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {})
  }
  const role = session.account.role as AdminRole
  return {
    accountId: session.account.id,
    username: session.account.username,
    displayName: session.account.displayName,
    role,
    tenant,
    sessionId: session.id,
    permissions: permissionsOf(role),
  }
})

/** 回傳目前登入的管理者帳號名稱，未登入則為 null（相容既有呼叫） */
export async function getAdminUser(): Promise<string | null> {
  return (await getAdminContext())?.username ?? null
}

/** 頁面與 server action 用：未登入導向登入頁 */
export async function requireAdmin(): Promise<string> {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/admin/login')
  return ctx.username
}

export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super('沒有執行這項操作的權限')
  }
}

/** 需要特定權限；沒有權限時丟出 PermissionError（由呼叫端轉成錯誤訊息） */
export async function requirePermission(p: Permission): Promise<AdminContext> {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/admin/login')
  if (!can(ctx.role, p)) throw new PermissionError(p)
  return ctx
}

/** 頁面用：沒有權限時顯示無權限頁 */
export async function pagePermission(p: Permission): Promise<AdminContext | 'forbidden'> {
  const ctx = await getAdminContext()
  if (!ctx) redirect('/admin/login')
  return can(ctx.role, p) ? ctx : 'forbidden'
}
