import { NextResponse, type NextRequest } from 'next/server'
import { buildAuthRequest, googleConfigured, googleRedirectUri, OAUTH_COOKIE, safeNextPath } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 開始 Google 登入：寫入短效狀態 Cookie 後導向 Google 授權畫面 */
export async function GET(req: NextRequest) {
  const next = safeNextPath(req.nextUrl.searchParams.get('next'))
  if (!googleConfigured()) {
    const back = new URL(next, req.nextUrl.origin)
    back.searchParams.set('auth', 'unavailable')
    return NextResponse.redirect(back)
  }

  const { url, cookie, maxAge } = await buildAuthRequest(next, googleRedirectUri(req.nextUrl.origin))
  const res = NextResponse.redirect(url)
  res.cookies.set(OAUTH_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
    maxAge,
  })
  return res
}
