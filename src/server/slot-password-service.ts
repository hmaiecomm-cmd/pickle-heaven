/**
 * 時段共用密碼（版本三：共用時段密碼＋有效訂單控制）— 核心服務
 *
 * 原則：
 * - 同一場館、同一日期、同一時段（依業主規則切分）只有一組六位數密碼，所有有效訂單共用。
 * - 訂單取消、退款、付款失敗只移除「該訂單」的資格，不刪除共用密碼；
 *   時段內已沒有任何有效訂單時，整個時段改為 LOCKED，原密碼即使輸入也不能開門。
 *
 * ⚠ 安全限制（請勿對外宣稱可做到）：
 *   共用密碼無法分辨是哪一位顧客輸入。只要同一時段仍有其他有效訂單，
 *   已取消的顧客若記得密碼仍可能開門；系統能保證的只有
 *   「單筆取消不影響其他顧客」與「沒有任何有效訂單時整個時段鎖定」。
 *   需要逐人管控時，請改用「每筆訂單獨立密碼」模式。
 *
 * 儲存：
 * - codeHash：HMAC-SHA256(伺服器金鑰, 密碼)，用於門鎖比對與避免重複，無法反推。
 * - codeCiphertext：AES-256-GCM 密文，只在伺服器端解密，用於把同一組密碼經 LINE 發給同時段後來付款的顧客。
 * - maskedCode：後台顯示用，只顯示最後兩位。
 */

import 'server-only'
import crypto from 'node:crypto'
import type { Prisma, SlotPassword, SlotPasswordRule } from '@prisma/client'
import { prisma } from '@/lib/db'
import { now, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc } from '@/lib/time'

/* ────────────────────────────── 常數與型別 ────────────────────────────── */

export const GENERATION_MODES = ['PER_ORDER', 'DAILY', 'SPLIT_DAY', 'HOURLY'] as const
export type GenerationMode = (typeof GENERATION_MODES)[number]

export const OPEN_TIME_OPTIONS = ['10_MIN_BEFORE', '30_MIN_BEFORE', '1_HOUR_BEFORE', 'CUSTOM'] as const
export type OpenTimeOption = (typeof OPEN_TIME_OPTIONS)[number]

export const EXPIRE_TIME_OPTIONS = ['IMMEDIATE', '15_MIN_AFTER', '30_MIN_AFTER', '1_HOUR_AFTER'] as const
export type ExpireTimeOption = (typeof EXPIRE_TIME_OPTIONS)[number]

export const SLOT_STATUSES = ['SCHEDULED', 'ACTIVE', 'LOCKED', 'EXPIRED', 'CANCELLED'] as const
export type SlotStatus = (typeof SLOT_STATUSES)[number]

export const AHEAD_DAYS_MIN = 1
export const AHEAD_DAYS_MAX = 30
/** 上下午分界：台北時間 12:00 */
const SPLIT_MINUTE = 12 * 60
/** 只有 PAID／COMPLETED 的訂單算有效訂單；PENDING、CANCELLED、REFUND_PENDING、EXPIRED 都不算 */
export const VALID_BOOKING_STATUSES = ['PAID', 'COMPLETED'] as const

const OPEN_OFFSET_MIN: Record<Exclude<OpenTimeOption, 'CUSTOM'>, number> = {
  '10_MIN_BEFORE': 10,
  '30_MIN_BEFORE': 30,
  '1_HOUR_BEFORE': 60,
}
const EXPIRE_OFFSET_MIN: Record<ExpireTimeOption, number> = {
  IMMEDIATE: 0,
  '15_MIN_AFTER': 15,
  '30_MIN_AFTER': 30,
  '1_HOUR_AFTER': 60,
}

export const DEFAULT_RULE = {
  generationMode: 'SPLIT_DAY' as GenerationMode,
  generateAheadDays: 7,
  passwordOpenTime: '10_MIN_BEFORE' as OpenTimeOption,
  passwordExpireTime: '30_MIN_AFTER' as ExpireTimeOption,
  lockWhenNoOrders: true,
  allowSharedPassword: true,
}

type Db = Prisma.TransactionClient | typeof prisma

/* ────────────────────────────── 密碼產生與加解密 ────────────────────────────── */

function secretKey(): Buffer {
  const secret = process.env.SLOT_PASSWORD_SECRET || process.env.SESSION_SECRET
  if (!secret) throw new Error('缺少 SLOT_PASSWORD_SECRET 或 SESSION_SECRET，無法保護門禁密碼')
  return crypto.createHash('sha256').update(`slot-password:${secret}`).digest()
}

/** 密碼指紋（同一組密碼永遠得到同一個值，可用來比對與檢查重複） */
export function fingerprintCode(code: string): string {
  return crypto.createHmac('sha256', secretKey()).update(code).digest('hex')
}

export function encryptCode(code: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv)
  const enc = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.')
}

export function decryptCode(payload: string): string {
  const [iv, tag, enc] = payload.split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(enc, 'base64')), decipher.final()]).toString('utf8')
}

/** 過於簡單或可預測的密碼：全部相同、連號（遞增／遞減）、兩位或三位一組重複 */
export function isWeakCode(code: string): boolean {
  if (!/^\d{6}$/.test(code)) return true
  if (/^(\d)\1{5}$/.test(code)) return true
  const d = code.split('').map(Number)
  const steps = d.slice(1).map((x, i) => x - d[i])
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) return true
  if (/^(\d\d)\1\1$/.test(code)) return true
  if (/^(\d\d\d)\1$/.test(code)) return true
  return false
}

/** 隨機六位數（000000～999999，保留前導零），使用密碼學安全亂數，不含訂單編號、電話等可預測資料 */
export function generateCode(): string {
  for (let i = 0; i < 1000; i++) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    if (!isWeakCode(code)) return code
  }
  throw new Error('無法產生有效密碼')
}

export function maskCode(code: string): string {
  return `****${code.slice(-2)}`
}

/** 產生一組與其他「尚未失效」時段都不重複的密碼 */
async function generateUniqueCode(db: Db, at: Date): Promise<{ code: string; codeHash: string }> {
  for (let i = 0; i < 50; i++) {
    const code = generateCode()
    const codeHash = fingerprintCode(code)
    const clash = await db.slotPassword.findFirst({
      where: { codeHash, status: { in: ['SCHEDULED', 'ACTIVE'] }, expireAt: { gt: at } },
      select: { id: true },
    })
    if (!clash) return { code, codeHash }
  }
  throw new Error('無法產生不重複的密碼')
}

/* ────────────────────────────── 規則 ────────────────────────────── */

export async function getOrCreateRule(venueId: string, db: Db = prisma): Promise<SlotPasswordRule> {
  const existing = await db.slotPasswordRule.findUnique({ where: { venueId } })
  if (existing) return existing
  try {
    return await db.slotPasswordRule.create({ data: { venueId, ...DEFAULT_RULE } })
  } catch {
    // 同時建立造成的唯一鍵衝突：改讀已建立的那筆
    return db.slotPasswordRule.findUniqueOrThrow({ where: { venueId } })
  }
}

export function openOffsetMinutes(rule: Pick<SlotPasswordRule, 'passwordOpenTime' | 'passwordOpenCustomMinutes'>): number {
  if (rule.passwordOpenTime === 'CUSTOM') return Math.max(0, Math.min(24 * 60, rule.passwordOpenCustomMinutes ?? 10))
  return OPEN_OFFSET_MIN[rule.passwordOpenTime as Exclude<OpenTimeOption, 'CUSTOM'>] ?? 10
}

export function expireOffsetMinutes(rule: Pick<SlotPasswordRule, 'passwordExpireTime' | 'passwordExpireCustomMinutes'>): number {
  if (rule.passwordExpireTime === 'CUSTOM') return Math.max(0, Math.min(24 * 60, rule.passwordExpireCustomMinutes ?? 30))
  return EXPIRE_OFFSET_MIN[rule.passwordExpireTime as ExpireTimeOption] ?? 30
}

/** 實際採用的模式：關閉「允許共用」時，一律每筆訂單獨立密碼 */
export function effectiveMode(rule: Pick<SlotPasswordRule, 'generationMode' | 'allowSharedPassword'>): GenerationMode {
  if (!rule.allowSharedPassword) return 'PER_ORDER'
  return (GENERATION_MODES as readonly string[]).includes(rule.generationMode) ? (rule.generationMode as GenerationMode) : 'SPLIT_DAY'
}

/* ────────────────────────────── 時段切分（台北時間） ────────────────────────────── */

export interface SlotKey {
  slotDate: string
  slotType: string
  slotStartAt: Date
  slotEndAt: Date
}

/** 依模式把一個預約時段對應到密碼時段（台北時間，不受伺服器時區影響） */
export function slotKeyFor(startsAt: Date, mode: GenerationMode, bookingCode: string): SlotKey {
  const slotDate = taipeiDateString(startsAt)
  const minute = taipeiMinuteOfDay(startsAt)
  if (mode === 'DAILY') {
    return { slotDate, slotType: 'DAY', slotStartAt: taipeiToUtc(slotDate, 0), slotEndAt: taipeiToUtc(slotDate, 24 * 60) }
  }
  if (mode === 'SPLIT_DAY') {
    return minute < SPLIT_MINUTE
      ? { slotDate, slotType: 'MORNING', slotStartAt: taipeiToUtc(slotDate, 0), slotEndAt: taipeiToUtc(slotDate, SPLIT_MINUTE) }
      : { slotDate, slotType: 'AFTERNOON', slotStartAt: taipeiToUtc(slotDate, SPLIT_MINUTE), slotEndAt: taipeiToUtc(slotDate, 24 * 60) }
  }
  if (mode === 'HOURLY') {
    const h = Math.floor(minute / 60)
    return { slotDate, slotType: `HOUR_${String(h).padStart(2, '0')}`, slotStartAt: taipeiToUtc(slotDate, h * 60), slotEndAt: taipeiToUtc(slotDate, (h + 1) * 60) }
  }
  // PER_ORDER：每筆訂單一個時段（以訂單編號區分，不與其他訂單共用）
  return { slotDate, slotType: `ORDER_${bookingCode}`, slotStartAt: taipeiToUtc(slotDate, 0), slotEndAt: taipeiToUtc(slotDate, 24 * 60) }
}

export const SLOT_TYPE_LABEL = (slotType: string): string => {
  if (slotType === 'DAY') return '全天'
  if (slotType === 'MORNING') return '上午'
  if (slotType === 'AFTERNOON') return '下午'
  if (slotType.startsWith('HOUR_')) return `${slotType.slice(5)}:00 時段`
  if (slotType.startsWith('ORDER_')) return `訂單 ${slotType.slice(6)}`
  return slotType
}

/* ────────────────────────────── 時段狀態 ────────────────────────────── */

/** 依目前有效訂單數與時間，決定時段應有的狀態（CANCELLED 為人工作廢，不自動改變） */
export function computeStatus(
  slot: Pick<SlotPassword, 'status' | 'openAt' | 'expireAt' | 'activeOrderCount'>,
  rule: Pick<SlotPasswordRule, 'lockWhenNoOrders'>,
  at: Date = now(),
): SlotStatus {
  if (slot.status === 'CANCELLED') return 'CANCELLED'
  if (at >= slot.expireAt) return 'EXPIRED'
  if (slot.activeOrderCount <= 0) return rule.lockWhenNoOrders ? 'LOCKED' : slot.status === 'LOCKED' ? 'LOCKED' : 'SCHEDULED'
  return at >= slot.openAt ? 'ACTIVE' : 'SCHEDULED'
}

/**
 * 依關聯表重新計算一個時段的有效訂單數、開放／失效時間與狀態（可重複執行）。
 * 有效訂單 = 關聯到此時段、且訂單狀態為 PAID／COMPLETED。
 */
export async function recountSlot(slotPasswordId: string, at: Date = now(), db: Db = prisma): Promise<SlotPassword | null> {
  const slot = await db.slotPassword.findUnique({ where: { id: slotPasswordId }, include: { rule: true } })
  if (!slot) return null
  const links = await db.bookingSlotPassword.findMany({
    where: { slotPasswordId, booking: { status: { in: [...VALID_BOOKING_STATUSES] } } },
    select: { bookingId: true, itemStartAt: true, itemEndAt: true },
  })
  const activeOrderCount = new Set(links.map((l) => l.bookingId)).size

  // 開放／失效時間以「時段內實際被預約的時間」為準，沒有有效訂單時保留原值
  let { openAt, expireAt } = slot
  if (links.length) {
    const first = Math.min(...links.map((l) => l.itemStartAt.getTime()))
    const last = Math.max(...links.map((l) => l.itemEndAt.getTime()))
    openAt = new Date(first - openOffsetMinutes(slot.rule) * 60_000)
    expireAt = new Date(last + expireOffsetMinutes(slot.rule) * 60_000)
  }

  const status = computeStatus({ status: slot.status, openAt, expireAt, activeOrderCount }, slot.rule, at)
  const data: Prisma.SlotPasswordUpdateInput = { activeOrderCount, openAt, expireAt, status }
  if (status === 'ACTIVE' && !slot.activatedAt) data.activatedAt = at
  if (status === 'EXPIRED' && !slot.expiredAt) data.expiredAt = at
  if (status === 'LOCKED' && slot.status !== 'LOCKED') {
    data.revokedAt = at
    data.revokeReason = '時段已無有效訂單（取消／退款／付款失敗）'
  }
  if (status !== 'LOCKED' && slot.status === 'LOCKED') {
    data.revokedAt = null
    data.revokeReason = null
  }
  return db.slotPassword.update({ where: { id: slotPasswordId }, data })
}

/**
 * 取得某時段可用的密碼列；沒有就建立。
 * 時段已 LOCKED／EXPIRED／CANCELLED 時（原密碼可能已在取消顧客手上），在同一列換發新密碼，
 * 確保「同一場館＋日期＋時段」永遠只有一組有效密碼（資料庫唯一鍵保證）。
 * 回傳 rotated=true 表示這次產生了新密碼。
 */
export async function ensureSlot(
  venueId: string,
  rule: SlotPasswordRule,
  key: SlotKey,
  at: Date = now(),
): Promise<{ slot: SlotPassword; created: boolean; rotated: boolean }> {
  const where = { venueId_slotDate_slotType: { venueId, slotDate: key.slotDate, slotType: key.slotType } }
  const existing = await prisma.slotPassword.findUnique({ where })
  const reusable = existing && (existing.status === 'SCHEDULED' || existing.status === 'ACTIVE') && existing.expireAt > at
  if (existing && reusable) return { slot: existing, created: false, rotated: false }

  const { code, codeHash } = await generateUniqueCode(prisma, at)
  const fresh = {
    codeHash,
    codeCiphertext: encryptCode(code),
    maskedCode: maskCode(code),
    // 先以時段範圍暫填，recountSlot 會改成實際預約時間 ± 規則
    openAt: new Date(key.slotStartAt.getTime() - openOffsetMinutes(rule) * 60_000),
    expireAt: new Date(key.slotEndAt.getTime() + expireOffsetMinutes(rule) * 60_000),
    status: 'SCHEDULED',
    activatedAt: null,
    expiredAt: null,
    revokedAt: null,
    revokeReason: null,
  }

  if (existing) {
    const slot = await prisma.slotPassword.update({ where: { id: existing.id }, data: { ...fresh, ruleId: rule.id, activeOrderCount: 0 } })
    return { slot, created: false, rotated: true }
  }
  try {
    const slot = await prisma.slotPassword.create({
      data: { venueId, ruleId: rule.id, slotDate: key.slotDate, slotType: key.slotType, slotStartAt: key.slotStartAt, slotEndAt: key.slotEndAt, activeOrderCount: 0, ...fresh },
    })
    return { slot, created: true, rotated: false }
  } catch {
    // 兩筆付款同時建立同一時段：以先建立的那組為準（不產生第二組）
    const slot = await prisma.slotPassword.findUniqueOrThrow({ where })
    return { slot, created: false, rotated: false }
  }
}

/* ────────────────────────────── 門鎖驗證 ────────────────────────────── */

export type VerifyResult =
  | { ok: true; slotPasswordId: string; activeOrderCount: number }
  | { ok: false; reason: 'FORMAT' | 'NOT_FOUND' | 'NOT_OPEN' | 'EXPIRED' | 'LOCKED' | 'NO_ORDERS' | 'NO_GRANT'; message: string }

/**
 * 門鎖輸入密碼時的驗證。必須同時符合：
 * 1. 密碼正確（比對指紋）　2. 已到 openAt　3. 未超過 expireAt
 * 4. 時段狀態為 ACTIVE（SCHEDULED 且已到開放時間會在此即時轉為 ACTIVE）
 * 5. activeOrderCount > 0　6. 至少一筆有效訂單的門禁授權仍有效（未被撤銷，例如黑名單）
 *
 * 共用密碼無法辨識是哪位顧客輸入：只要時段仍有其他有效訂單，就會放行。
 */
export async function verifyDoorCode(venueId: string, input: string, at: Date = now()): Promise<VerifyResult> {
  const code = String(input ?? '').trim()
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'FORMAT', message: '密碼須為六位數字' }
  const codeHash = fingerprintCode(code)
  const candidates = await prisma.slotPassword.findMany({
    where: { venueId, codeHash },
    orderBy: { openAt: 'desc' },
    include: { rule: true },
  })
  if (!candidates.length) return { ok: false, reason: 'NOT_FOUND', message: '密碼不正確' }

  // 同一組密碼只會在一個未失效時段使用；優先找時間範圍涵蓋現在的那一筆
  const slot = candidates.find((s) => s.openAt <= at && at < s.expireAt) ?? candidates[0]
  if (slot.status === 'CANCELLED') return { ok: false, reason: 'LOCKED', message: '此時段密碼已作廢' }
  if (slot.status === 'LOCKED' || slot.activeOrderCount <= 0) {
    return slot.status === 'LOCKED'
      ? { ok: false, reason: 'LOCKED', message: '此時段已無有效訂單，已鎖定' }
      : { ok: false, reason: 'NO_ORDERS', message: '此時段沒有有效訂單' }
  }
  if (at < slot.openAt) return { ok: false, reason: 'NOT_OPEN', message: '密碼尚未到開放時間' }
  if (at >= slot.expireAt) return { ok: false, reason: 'EXPIRED', message: '密碼已失效' }

  const fresh = await recountSlot(slot.id, at)
  if (!fresh || fresh.status !== 'ACTIVE' || fresh.activeOrderCount <= 0) {
    return { ok: false, reason: 'LOCKED', message: '此時段已無有效訂單，已鎖定' }
  }

  const links = await prisma.bookingSlotPassword.findMany({
    where: { slotPasswordId: slot.id, booking: { status: { in: [...VALID_BOOKING_STATUSES] } } },
    select: { bookingId: true },
  })
  const grants = await prisma.doorAccessGrant.count({
    where: { status: 'ACTIVE', bookingId: { in: links.map((l) => l.bookingId) } },
  })
  if (grants === 0) return { ok: false, reason: 'NO_GRANT', message: '此時段沒有有效的門禁授權' }

  return { ok: true, slotPasswordId: slot.id, activeOrderCount: fresh.activeOrderCount }
}
