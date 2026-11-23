import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * 請求簽章（HMAC-SHA256），三方共用。
 *
 * 簽章字串 = METHOD \n PATH(含 query) \n 時間戳(毫秒) \n nonce \n SHA256(body) 十六進位
 * Header：
 *   x-gh-key    金鑰識別：場館為 siteId；平台呼叫 Gateway 為 "platform"；Gateway 呼叫平台為 "gateway"
 *   x-gh-ts     毫秒時間戳
 *   x-gh-nonce  隨機字串（同一把金鑰 10 分鐘內不可重複，防重送）
 *   x-gh-sig    base64url 簽章
 *
 * 時間誤差超過 MAX_SKEW_MS 一律拒絕，所以場館電腦必須開 NTP 校時。
 */

export const HEADER_KEY = 'x-gh-key'
export const HEADER_TS = 'x-gh-ts'
export const HEADER_NONCE = 'x-gh-nonce'
export const HEADER_SIG = 'x-gh-sig'
export const MAX_SKEW_MS = 5 * 60_000
export const NONCE_TTL_MS = 10 * 60_000

export function sha256Hex(body: string | Uint8Array): string {
  return createHash('sha256').update(body).digest('hex')
}

export function canonicalString(method: string, pathWithQuery: string, ts: string, nonce: string, body: string): string {
  return [method.toUpperCase(), pathWithQuery, ts, nonce, sha256Hex(body)].join('\n')
}

export function sign(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function newNonce(): string {
  return randomBytes(16).toString('base64url')
}

/** 產生要附在請求上的簽章 header */
export function signRequest(opts: {
  keyId: string
  secret: string
  method: string
  pathWithQuery: string
  body?: string
  now?: number
  nonce?: string
}): Record<string, string> {
  const ts = String(opts.now ?? Date.now())
  const nonce = opts.nonce ?? newNonce()
  const sig = sign(opts.secret, canonicalString(opts.method, opts.pathWithQuery, ts, nonce, opts.body ?? ''))
  return { [HEADER_KEY]: opts.keyId, [HEADER_TS]: ts, [HEADER_NONCE]: nonce, [HEADER_SIG]: sig }
}

export type VerifyFailure = 'MISSING_HEADERS' | 'CLOCK_SKEW' | 'BAD_SIGNATURE'

/** 驗證簽章（nonce 是否重複由呼叫端用 Redis／記憶體檢查） */
export function verifySignature(opts: {
  secret: string
  method: string
  pathWithQuery: string
  body: string
  headers: { ts?: string | null; nonce?: string | null; sig?: string | null }
  now?: number
}): { ok: true } | { ok: false; reason: VerifyFailure } {
  const { ts, nonce, sig } = opts.headers
  if (!ts || !nonce || !sig || nonce.length < 8 || nonce.length > 64) return { ok: false, reason: 'MISSING_HEADERS' }
  const t = Number(ts)
  if (!Number.isFinite(t) || Math.abs((opts.now ?? Date.now()) - t) > MAX_SKEW_MS) return { ok: false, reason: 'CLOCK_SKEW' }
  const expected = sign(opts.secret, canonicalString(opts.method, opts.pathWithQuery, ts, nonce, opts.body))
  return safeEqual(expected, sig) ? { ok: true } : { ok: false, reason: 'BAD_SIGNATURE' }
}

/**
 * 場館金鑰 = HMAC(主金鑰, "site:<siteId>:v<版本>")。
 * Gateway 不用保存每個場館的金鑰；換金鑰只要把版本 +1，舊金鑰立即失效。
 */
export function deriveSiteSecret(masterKey: string, siteId: string, keyVersion: number): string {
  return createHmac('sha256', masterKey).update(`site:${siteId}:v${keyVersion}`).digest('base64url')
}

/** siteId 格式：小寫英數與連字號，3–40 字，例如 xindian001 */
export const SITE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/
