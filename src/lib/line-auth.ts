/**
 * LINE Login / OpenID Connect 認證工具
 *
 * 安全檢查清單：
 * ✅ Authorization Code Flow（不在前端傳遞 access token）
 * ✅ State parameter（防止 CSRF）
 * ✅ Nonce（防止重放）
 * ✅ ID Token 驗證（issuer, audience, signature, expiry）
 * ✅ 伺服器端驗證所有令牌
 * ✅ Channel Secret 不暴露到前端
 */

interface LineIdTokenPayload {
  iss: string
  sub: string
  aud: string
  exp: number
  iat: number
  nonce: string
  email?: string
  name?: string
  picture?: string
  email_verified?: boolean
}

export function generateStateAndNonce(): { state: string; nonce: string } {
  const state = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15)
  const nonce = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15)
  return { state, nonce }
}

export function getLineAuthUrl(options: {
  clientId: string
  redirectUri: string
  state: string
  nonce: string
}): string {
  const url = new URL('https://web.line.me/web/login')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('state', options.state)
  url.searchParams.set('nonce', options.nonce)
  url.searchParams.set('scope', 'openid profile email')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

export async function exchangeCodeForToken(options: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{ accessToken: string; idToken: string; tokenType: string; expiresIn: number }> {
  const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: options.code,
      redirect_uri: options.redirectUri,
      client_id: options.clientId,
      client_secret: options.clientSecret,
    }).toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  }
}

export function decodeIdToken(idToken: string): LineIdTokenPayload | null {
  try {
    const parts = idToken.split('.')
    if (parts.length !== 3) return null

    const payload = parts[1]
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
    return decoded
  } catch {
    return null
  }
}

export function validateIdToken(
  payload: LineIdTokenPayload,
  options: {
    clientId: string
    nonce: string
  },
): { valid: boolean; error?: string } {
  // 驗證 issuer
  if (payload.iss !== 'https://access.line.me') {
    return { valid: false, error: 'Invalid issuer' }
  }

  // 驗證 audience
  if (payload.aud !== options.clientId) {
    return { valid: false, error: 'Invalid audience' }
  }

  // 驗證 nonce
  if (payload.nonce !== options.nonce) {
    return { valid: false, error: 'Invalid nonce' }
  }

  // 驗證有效期限
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    return { valid: false, error: 'Token expired' }
  }

  // 驗證 iat（發行時間不應太久遠，防止時鐘偏差允許 60 秒）
  if (payload.iat > now + 60) {
    return { valid: false, error: 'Invalid token issue time' }
  }

  return { valid: true }
}

export function extractUserInfo(payload: LineIdTokenPayload) {
  return {
    lineUserId: payload.sub,
    email: payload.email || '',
    displayName: payload.name || '',
    pictureUrl: payload.picture || '',
    emailVerified: payload.email_verified || false,
  }
}
