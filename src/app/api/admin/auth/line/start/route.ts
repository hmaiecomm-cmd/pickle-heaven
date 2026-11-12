import { NextResponse, type NextRequest } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { LineAuthError, PENDING_COOKIE, PENDING_COOKIE_PATH, createLoginRequest, lineConfig, noticeParams, type LineIntent } from '@/server/admin-line-oauth'
import { findInvitation, inviteState } from '@/server/admin-line-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 開始 LINE 登入：產生 state、nonce、PKCE，寫入短效 Cookie 後導向 LINE 授權頁 */
export async function GET(req: NextRequest) {
  const intentParam = req.nextUrl.searchParams.get('intent')
  const intent: LineIntent = intentParam === 'bind' || intentParam === 'invite' ? intentParam : 'login'
  const inviteToken = req.nextUrl.searchParams.get('token') ?? undefined
  const back = (path: string, error: string) => {
    const url = new URL(path, req.nextUrl.origin)
    for (const [k, v] of Object.entries(noticeParams(error))) url.searchParams.set(k, v)
    return NextResponse.redirect(url)
  }

  if (!lineConfig().configured) return back(intent === 'bind' ? '/admin/settings/line' : '/admin/login', 'LINE 登入尚未設定完成')

  if (intent === 'bind' && !(await getAdminContext())) return back('/admin/login', '請先登入後台，再綁定 LINE')
  if (intent === 'invite') {
    const inv = inviteToken ? await findInvitation(inviteToken) : null
    if (!inv || inviteState(inv) !== 'PENDING') return back('/admin/login', '邀請連結無效、已使用或已過期')
  }

  try {
    const { authorizeUrl, cookie, maxAge } = await createLoginRequest(intent, intent === 'invite' ? inviteToken : undefined)
    const res = NextResponse.redirect(authorizeUrl)
    res.cookies.set(PENDING_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: PENDING_COOKIE_PATH,
      maxAge,
    })
    return res
  } catch (err) {
    return back('/admin/login', err instanceof LineAuthError ? err.message : 'LINE 登入暫時無法使用')
  }
}
