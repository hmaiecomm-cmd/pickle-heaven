import 'server-only'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

/**
 * 後台 LINE Login（OAuth 2.0 Authorization Code Flow + OpenID Connect）。
 *
 * - state：防 CSRF；nonce：綁定 ID Token 與這次登入；PKCE（S256）：防授權碼被攔截後冒用。
 * - 三者只存在短效、HttpOnly、已簽章的 Cookie，不經過前端程式。
 * - Channel Secret 只在伺服器端用來換取 token，不會送到瀏覽器。
 * - ID Token 交由 LINE 官方驗證端點驗證簽章，並再核對 aud、iss、nonce、exp。
 */

const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize'
const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token'
const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify'
const ISSUER = 'https://access.line.me'
export const PENDING_COOKIE = 'ph_admin_line'
export const PENDING_COOKIE_PATH = '/api/admin/auth/line'
const PENDING_TTL_SECONDS = 600

export type LineIntent = 'login' | 'bind' | 'invite'

export interface LinePending {
  state: string
  nonce: string
  verifier: string
  intent: LineIntent
  inviteToken?: string
}

export interface LineIdentity {
  lineUserId: string
  displayName: string
  pictureUrl: string | null
}

export class LineAuthError extends Error {}

export function lineConfig() {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID?.trim() || ''
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET?.trim() || ''
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
  const callbackUrl = process.env.ADMIN_LINE_CALLBACK_URL?.trim() || (appUrl ? `${appUrl}/api/admin/auth/line/callback` : '')
  const missing = [
    !channelId && 'LINE_LOGIN_CHANNEL_ID',
    !channelSecret && 'LINE_LOGIN_CHANNEL_SECRET',
    !callbackUrl && 'NEXT_PUBLIC_APP_URL 或 ADMIN_LINE_CALLBACK_URL',
  ].filter((x): x is string => Boolean(x))
  return { channelId, channelSecret, callbackUrl, configured: missing.length === 0, missing }
}

function signingKey(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new LineAuthError('缺少 SESSION_SECRET')
  return new TextEncoder().encode(s)
}

const b64url = (buf: Buffer) => buf.toString('base64url')

/**
 * 回呼帶回頁面的提示訊息要附簽章：頁面只顯示伺服器簽過的訊息，
 * 避免有人自組網址讓登入頁顯示誤導文字（例如釣魚指示）。
 */
export function noticeParams(message: string, key: 'line_error' | 'line_notice' = 'line_error'): Record<string, string> {
  return { [key]: message, line_sig: createHmac('sha256', signingKey()).update(`${key}:${message}`).digest('base64url') }
}

export function readNotice(params: Record<string, string | string[] | undefined>, key: 'line_error' | 'line_notice' = 'line_error'): string | null {
  const msg = params[key]
  const sig = params.line_sig
  if (typeof msg !== 'string' || typeof sig !== 'string' || msg.length > 200) return null
  const expected = createHmac('sha256', signingKey()).update(`${key}:${msg}`).digest('base64url')
  return sameString(sig, expected) ? msg : null
}

/** 產生授權網址與要寫入 Cookie 的待驗證資料 */
export async function createLoginRequest(intent: LineIntent, inviteToken?: string) {
  const cfg = lineConfig()
  if (!cfg.configured) throw new LineAuthError(`LINE 登入尚未設定：${cfg.missing.join('、')}`)
  const pending: LinePending = {
    state: b64url(randomBytes(32)),
    nonce: b64url(randomBytes(32)),
    verifier: b64url(randomBytes(48)),
    intent,
    ...(inviteToken ? { inviteToken } : {}),
  }
  const challenge = b64url(createHash('sha256').update(pending.verifier).digest())
  const url = new URL(AUTHORIZE_URL)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.channelId,
    redirect_uri: cfg.callbackUrl,
    state: pending.state,
    scope: 'openid profile',
    nonce: pending.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()
  const cookie = await new SignJWT({ ...pending, purpose: 'admin-line' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_SECONDS}s`)
    .sign(signingKey())
  return { authorizeUrl: url.toString(), cookie, maxAge: PENDING_TTL_SECONDS }
}

export async function readLoginRequest(cookie: string | undefined): Promise<LinePending | null> {
  if (!cookie) return null
  try {
    const { payload } = await jwtVerify(cookie, signingKey())
    if (payload.purpose !== 'admin-line') return null
    const { state, nonce, verifier, intent, inviteToken } = payload as Record<string, unknown>
    if (typeof state !== 'string' || typeof nonce !== 'string' || typeof verifier !== 'string') return null
    if (intent !== 'login' && intent !== 'bind' && intent !== 'invite') return null
    return { state, nonce, verifier, intent, ...(typeof inviteToken === 'string' ? { inviteToken } : {}) }
  } catch {
    return null
  }
}

function sameString(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** 回呼：核對 state → 以授權碼＋PKCE＋Channel Secret 換 token → 交由 LINE 驗證 ID Token 並核對 nonce、aud、iss、exp */
export async function completeLogin(
  params: { code: string | null; state: string | null; error?: string | null },
  pending: LinePending | null,
  fetchImpl: typeof fetch = fetch,
): Promise<LineIdentity> {
  if (params.error) throw new LineAuthError('已取消 LINE 登入')
  if (!pending) throw new LineAuthError('登入請求已逾時，請重新操作')
  if (!params.state || !sameString(params.state, pending.state)) throw new LineAuthError('登入驗證失敗（state 不符），請重新操作')
  if (!params.code) throw new LineAuthError('LINE 沒有回傳授權碼')

  const cfg = lineConfig()
  if (!cfg.configured) throw new LineAuthError('LINE 登入尚未設定')

  const tokenRes = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: cfg.callbackUrl,
      client_id: cfg.channelId,
      client_secret: cfg.channelSecret,
      code_verifier: pending.verifier,
    }),
    cache: 'no-store',
  })
  if (!tokenRes.ok) throw new LineAuthError('LINE 授權碼交換失敗')
  const token = (await tokenRes.json()) as { id_token?: string }
  if (!token.id_token) throw new LineAuthError('LINE 沒有回傳 ID Token')

  const verifyRes = await fetchImpl(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: token.id_token, client_id: cfg.channelId, nonce: pending.nonce }),
    cache: 'no-store',
  })
  if (!verifyRes.ok) throw new LineAuthError('LINE ID Token 驗證失敗')
  const claims = (await verifyRes.json()) as { iss?: string; sub?: string; aud?: string; exp?: number; nonce?: string; name?: string; picture?: string }
  if (claims.iss !== ISSUER) throw new LineAuthError('ID Token 發行者不符')
  if (claims.aud !== cfg.channelId) throw new LineAuthError('ID Token 對象不符')
  if (!claims.nonce || !sameString(claims.nonce, pending.nonce)) throw new LineAuthError('ID Token nonce 不符')
  if (!claims.exp || claims.exp * 1000 <= Date.now()) throw new LineAuthError('ID Token 已過期')
  if (!claims.sub) throw new LineAuthError('ID Token 缺少使用者識別')

  return { lineUserId: claims.sub, displayName: claims.name?.slice(0, 50) || 'LINE 使用者', pictureUrl: claims.picture ?? null }
}
