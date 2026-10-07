import { createHmac, timingSafeEqual } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

/**
 * 資料庫連線與資料範圍（tenant）。
 *
 * - main：正式資料庫（TURSO_DATABASE_URL）
 * - demo：展示資料庫（DEMO_DATABASE_URL），只放虛構資料
 *
 * 匯出的 `prisma` 不是固定連線：每次查詢都依「這個請求帶的後台登入憑證」決定要連哪個資料庫。
 * 展示帳號的憑證（伺服器簽章，含 tnt=demo）只會解析到展示資料庫，
 * 因此不論修改網址、請求參數、呼叫哪個 API 或透過 AI 操作，都碰不到正式資料。
 * 沒有登入憑證、憑證無效或不在請求情境中（排程、腳本）一律是 main。
 *
 * 後台帳號、登入 session 與登入嘗試只存在正式資料庫，一律使用 `mainPrisma`。
 */

export type Tenant = 'main' | 'demo'

const ADMIN_COOKIE = 'ph_admin'

const globalForPrisma = globalThis as unknown as { __phClients?: Partial<Record<Tenant, PrismaClient>> }
const clients = (globalForPrisma.__phClients ??= {})

export class DemoNotConfiguredError extends Error {
  constructor() {
    super('展示資料庫尚未設定（DEMO_DATABASE_URL）')
  }
}

export function isDemoConfigured(): boolean {
  return Boolean(process.env.DEMO_DATABASE_URL)
}

function createClient(url: string, authToken?: string) {
  const adapter = new PrismaLibSQL({ url, authToken })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export function clientFor(tenant: Tenant): PrismaClient {
  const existing = clients[tenant]
  if (existing) return existing
  if (tenant === 'demo') {
    const url = process.env.DEMO_DATABASE_URL
    if (!url) throw new DemoNotConfiguredError()
    if (url === process.env.TURSO_DATABASE_URL) throw new Error('展示資料庫不可與正式資料庫相同')
    return (clients.demo = createClient(url, process.env.DEMO_DATABASE_AUTH_TOKEN))
  }
  return (clients.main = createClient(process.env.TURSO_DATABASE_URL!, process.env.TURSO_AUTH_TOKEN))
}

/** 永遠連正式資料庫：後台帳號、登入 session、登入嘗試 */
export const mainPrisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    return Reflect.get(clientFor('main'), prop)
  },
})

/* ─────────────────────────── 由登入憑證判斷資料範圍 ─────────────────────────── */

const tenantCache = new Map<string, { tenant: Tenant; exp: number }>()

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/** 驗證 HS256 簽章與到期時間，回傳憑證中的 tnt。任何不符都回 null。 */
export function tenantFromToken(token: string): Tenant | null {
  const cached = tenantCache.get(token)
  const nowSec = Math.floor(Date.now() / 1000)
  if (cached) return cached.exp > nowSec ? cached.tenant : null
  const secret = process.env.SESSION_SECRET
  const parts = token.split('.')
  if (!secret || parts.length !== 3) return null
  const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest()
  const actual = b64urlDecode(parts[2])
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'))
    if (header.alg !== 'HS256') return null
    const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'))
    const exp = typeof payload.exp === 'number' ? payload.exp : 0
    if (exp <= nowSec) return null
    const tenant: Tenant = payload.tnt === 'demo' ? 'demo' : 'main'
    if (tenantCache.size > 500) tenantCache.clear()
    tenantCache.set(token, { tenant, exp })
    return tenant
  } catch {
    return null
  }
}

/** 目前請求的資料範圍 */
export async function currentTenant(): Promise<Tenant> {
  let token: string | undefined
  try {
    const { cookies } = await import('next/headers')
    token = (await cookies()).get(ADMIN_COOKIE)?.value
  } catch (err) {
    // 預先產生靜態頁時，cookies() 會丟出讓 Next 判斷為動態頁的錯誤，必須往外拋
    if (err && typeof err === 'object' && 'digest' in err && String((err as { digest: unknown }).digest).startsWith('DYNAMIC_SERVER_USAGE')) throw err
    return 'main' // 不在請求情境（排程、腳本）
  }
  if (!token) return 'main'
  return tenantFromToken(token) ?? 'main'
}

export async function isDemoTenant(): Promise<boolean> {
  return (await currentTenant()) === 'demo'
}

/** 依請求資料範圍取得連線（需要同一連線做多次操作時使用） */
export async function tenantPrisma(): Promise<PrismaClient> {
  return clientFor(await currentTenant())
}

/**
 * 依請求自動選擇資料庫的 Prisma 代理。
 * 每個模型方法（findMany、update…）與 $transaction(fn) 在呼叫當下解析資料範圍。
 * 注意：不支援 $transaction([...]) 陣列寫法，請改用 $transaction(async (tx) => …)。
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    if (typeof prop === 'symbol' || prop === 'then') return undefined
    if (prop.startsWith('$')) {
      return async (...args: unknown[]) => {
        if (prop === '$transaction' && Array.isArray(args[0])) {
          throw new Error('請改用 $transaction(async (tx) => …)，以確保在同一個資料範圍內執行')
        }
        const c = clientFor(await currentTenant()) as unknown as Record<string, (...a: unknown[]) => unknown>
        return c[prop](...args)
      }
    }
    return new Proxy(
      {},
      {
        get(_d, method) {
          if (typeof method === 'symbol' || method === 'then') return undefined
          return async (...args: unknown[]) => {
            const c = clientFor(await currentTenant()) as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>
            return c[prop][method](...args)
          }
        },
      },
    )
  },
})
