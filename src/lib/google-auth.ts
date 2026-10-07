import 'server-only'
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose'

/**
 * Google 官方授權登入（OAuth 2.0 授權碼 + PKCE）。
 *
 * - 使用者在 Google 的授權畫面完成驗證，本站不接收、不儲存任何 Google 密碼。
 * - state、nonce、PKCE verifier 與返回網址放在短效的 HttpOnly 簽章 Cookie，回呼時逐一核對。
 * - id_token 由伺服器以 Google 公開金鑰驗證簽章、發行者、受眾與 nonce，才建立本站 session。
 * - 返回網址只允許站內路徑，避免開放式轉址。
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export const OAUTH_COOKIE = 'ph_oauth'
const OAUTH_COOKIE_MINUTES = 10

export interface GoogleProfile {
  sub: string
  email: string | null
  emailVerified: boolean
  name: string
  picture: string | null
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('缺少 SESSION_SECRET 環境變數（請設定至少 32 字元的隨機字串）')
  return new TextEncoder().encode(s)
}

/** 尚未設定的項目；全部設定好才會顯示 Google 登入按鈕 */
export function googleMissingConfig(): string[] {
  const missing: string[] = []
  if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID')
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET')
  return missing
}

export function googleConfigured(): boolean {
  return googleMissingConfig().length === 0
}

/** 回呼網址：可用 GOOGLE_REDIRECT_URI 固定（正式站），否則依目前請求的來源組成（本機、預覽） */
export function googleRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`
}

/**
 * 只接受站內相對路徑：以單一 "/" 開頭、不是 "//"、不含反斜線與協定。
 * 不合法一律回帳戶頁。
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/account'): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (/[\\\r\n]/.test(raw) || /^\/[^/?#]*:/.test(raw)) return fallback
  // 不允許回到授權流程本身或後台
  if (raw.startsWith('/api/') || raw.startsWith('/admin')) return fallback
  return raw.length > 2000 ? fallback : raw
}

function randomToken(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url')
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Buffer.from(digest).toString('base64url')
}

/** 產生授權網址與要寫入 Cookie 的簽章內容 */
export async function buildAuthRequest(next: string, redirectUri: string): Promise<{ url: string; cookie: string; maxAge: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('缺少 GOOGLE_CLIENT_ID')

  const state = randomToken(24)
  const nonce = randomToken(24)
  const verifier = randomToken(48)
  const challenge = await sha256Base64Url(verifier)

  const cookie = await new SignJWT({ st: state, nc: nonce, cv: verifier, next, ru: redirectUri })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_COOKIE_MINUTES}m`)
    .sign(secret())

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return { url: `${AUTH_URL}?${params}`, cookie, maxAge: OAUTH_COOKIE_MINUTES * 60 }
}

export class GoogleAuthError extends Error {
  constructor(message: string, public readonly kind: 'invalid_state' | 'exchange' | 'token' | 'config' = 'exchange') {
    super(message)
  }
}

/** 解析授權流程 Cookie（回呼時先取 next，錯誤也能回到原頁） */
export async function readOAuthCookie(token: string | undefined): Promise<{ state: string; nonce: string; verifier: string; next: string; redirectUri: string } | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    return {
      state: String(payload.st ?? ''),
      nonce: String(payload.nc ?? ''),
      verifier: String(payload.cv ?? ''),
      next: safeNextPath(typeof payload.next === 'string' ? payload.next : null),
      redirectUri: String(payload.ru ?? ''),
    }
  } catch {
    return null
  }
}

/** 以授權碼換 token，並驗證 id_token 後回傳使用者資料 */
export async function completeAuth(code: string, state: string, stored: NonNullable<Awaited<ReturnType<typeof readOAuthCookie>>>): Promise<GoogleProfile> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new GoogleAuthError('Google 登入尚未設定', 'config')
  if (!state || state !== stored.state) throw new GoogleAuthError('登入狀態不符，請重新登入', 'invalid_state')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: stored.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: stored.verifier,
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[google] 換取 token 失敗', res.status, detail.slice(0, 300))
    throw new GoogleAuthError('向 Google 換取授權失敗', 'exchange')
  }
  const data = (await res.json()) as { id_token?: string }
  if (!data.id_token) throw new GoogleAuthError('Google 未回傳身分資料', 'token')

  const { payload } = await jwtVerify(data.id_token, JWKS, { issuer: ISSUERS, audience: clientId })
  if (!payload.sub) throw new GoogleAuthError('身分資料不完整', 'token')
  if (payload.nonce !== stored.nonce) throw new GoogleAuthError('身分資料與本次登入不符', 'token')

  const email = typeof payload.email === 'string' ? payload.email : null
  const emailVerified = payload.email_verified === true
  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : email?.split('@')[0] || 'Google 使用者'
  return {
    sub: payload.sub,
    email,
    emailVerified,
    name,
    picture: typeof payload.picture === 'string' ? payload.picture : null,
  }
}
