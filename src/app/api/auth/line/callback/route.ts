import { type NextRequest, NextResponse } from 'next/server'
import { createAdminSession, setAdminSessionCookie } from '@/lib/admin-session'
import { getAdminByLineUserId, updateLastLineLogin, redeemInvitation } from '@/server/admin-invitation-service'
import { prisma } from '@/lib/db'

/**
 * LINE Login OAuth 2.0 / OpenID Connect 回調端點
 *
 * 流程：
 * 1. 使用者從 LINE 授權後回到此端點
 * 2. 驗證 state 防止 CSRF
 * 3. 交換 code 獲取 ID token
 * 4. 驗證 ID token（issuer, audience, signature, expiry）
 * 5. 綁定或建立後台使用者帳號
 * 6. 建立安全的後台 Session
 */

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || ''
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || ''

interface LineTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  id_token: string
  scope: string
}

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
}

function decodeIdToken(idToken: string): LineIdTokenPayload | null {
  try {
    // 分割 JWT
    const parts = idToken.split('.')
    if (parts.length !== 3) return null

    // 解碼 payload
    const payload = parts[1]
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
    return decoded
  } catch (e) {
    console.error('Failed to decode ID token:', e)
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    // 取得查詢參數
    const searchParams = req.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // 檢查是否有錯誤
    if (error) {
      return NextResponse.json(
        { error: error, description: errorDescription },
        { status: 400 },
      )
    }

    // 驗證 code 和 state
    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state parameter' },
        { status: 400 },
      )
    }

    // 驗證 CSRF token（從 cookie 或 localStorage 讀取，實際應使用 secure session）
    const storedState = req.cookies.get('line_auth_state')?.value
    if (!storedState || storedState !== state) {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 },
      )
    }

    // 交換 code 獲取 ID token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${req.nextUrl.origin}/api/auth/line/callback`,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('LINE token exchange failed:', errorData)
      return NextResponse.json(
        { error: 'Token exchange failed' },
        { status: 400 },
      )
    }

    const tokenData = (await tokenResponse.json()) as LineTokenResponse
    const idToken = tokenData.id_token

    // 解碼 ID token
    const idTokenPayload = decodeIdToken(idToken)
    if (!idTokenPayload) {
      return NextResponse.json(
        { error: 'Invalid ID token' },
        { status: 400 },
      )
    }

    // 驗證 ID token
    // 1. 驗證 issuer
    if (idTokenPayload.iss !== 'https://access.line.me') {
      return NextResponse.json(
        { error: 'Invalid token issuer' },
        { status: 400 },
      )
    }

    // 2. 驗證 audience（應為 LINE_CHANNEL_ID）
    if (idTokenPayload.aud !== LINE_CHANNEL_ID) {
      return NextResponse.json(
        { error: 'Invalid token audience' },
        { status: 400 },
      )
    }

    // 3. 驗證 nonce（防止重放攻擊）
    const storedNonce = req.cookies.get('line_auth_nonce')?.value
    if (!storedNonce || storedNonce !== idTokenPayload.nonce) {
      return NextResponse.json(
        { error: 'Invalid nonce' },
        { status: 400 },
      )
    }

    // 4. 驗證有效期限
    const now = Math.floor(Date.now() / 1000)
    if (idTokenPayload.exp < now) {
      return NextResponse.json(
        { error: 'ID token expired' },
        { status: 400 },
      )
    }

    // 提取使用者信息
    const lineUserId = idTokenPayload.sub
    const email = idTokenPayload.email || ''
    const displayName = idTokenPayload.name || ''

    // 1. 檢查 LINE 身份是否已綁定到現有帳號
    const existingBinding = await getAdminByLineUserId(lineUserId)

    let adminId: string | null = null

    if (existingBinding) {
      // 已綁定 - 更新登入時間並建立 session
      adminId = existingBinding.adminId
      await updateLastLineLogin(adminId)

      const admin = await prisma.adminUser.findUnique({
        where: { id: adminId },
        select: { id: true, role: true, email: true, status: true },
      })

      if (!admin || admin.status === 'disabled') {
        return NextResponse.json(
          { error: 'Account is disabled' },
          { status: 403 }
        )
      }

      // 建立 session
      const token = await createAdminSession({
        adminId: admin.id,
        email: admin.email || email,
        role: admin.role || 'STAFF',
      })

      const response = NextResponse.redirect(new URL('/admin', req.nextUrl.origin))
      await setAdminSessionCookie(token)
      response.cookies.delete('line_auth_state')
      response.cookies.delete('line_auth_nonce')

      return response
    }

    // 2. 未綁定 - 檢查是否有有效的邀請
    const invitationToken = req.nextUrl.searchParams.get('state')?.split('_')[1]

    if (invitationToken) {
      // 嘗試使用邀請建立新帳號
      const result = await redeemInvitation({
        invitationToken,
        email,
        lineUserId,
        lineEmail: email,
        displayName,
      })

      if (result.success && result.adminId) {
        adminId = result.adminId

        const admin = await prisma.adminUser.findUnique({
          where: { id: adminId },
          select: { id: true, role: true, email: true },
        })

        if (admin) {
          // 建立 session
          const token = await createAdminSession({
            adminId: admin.id,
            email: admin.email || email,
            role: admin.role || 'STAFF',
          })

          const response = NextResponse.redirect(new URL('/admin', req.nextUrl.origin))
          await setAdminSessionCookie(token)
          response.cookies.delete('line_auth_state')
          response.cookies.delete('line_auth_nonce')

          return response
        }
      }
    }

    // 3. 未授權 - 無有效邀請
    console.log('LINE login rejected - no valid invitation:', {
      lineUserId,
      email,
    })

    return NextResponse.json(
      { error: 'No valid invitation found' },
      { status: 403 }
    )
  } catch (error) {
    console.error('LINE callback error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
