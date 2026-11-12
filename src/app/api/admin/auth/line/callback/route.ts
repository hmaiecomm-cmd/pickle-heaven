import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, getAdminContext } from '@/lib/admin-auth'
import { LineAuthError, PENDING_COOKIE, PENDING_COOKIE_PATH, completeLogin, noticeParams, readLoginRequest } from '@/server/admin-line-oauth'
import { AdminAccessError, acceptInvitation, bindOwnLine, loginWithLine } from '@/server/admin-line-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** LINE 回呼：驗證 state／PKCE／ID Token 後，依用途登入、接受邀請或綁定 */
export async function GET(req: NextRequest) {
  const pending = await readLoginRequest(req.cookies.get(PENDING_COOKIE)?.value)
  const meta = {
    ip: (req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim().slice(0, 64),
    userAgent: (req.headers.get('user-agent') ?? '').slice(0, 200),
  }
  const go = (path: string, params: Record<string, string> = {}, adminToken?: string) => {
    const url = new URL(path, req.nextUrl.origin)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = NextResponse.redirect(url)
    res.cookies.set(PENDING_COOKIE, '', { path: PENDING_COOKIE_PATH, maxAge: 0 })
    if (adminToken) res.cookies.set(ADMIN_COOKIE, adminToken, ADMIN_COOKIE_OPTIONS)
    return res
  }
  const failPath = pending?.intent === 'bind' ? '/admin/settings/line' : '/admin/login'

  try {
    const line = await completeLogin(
      { code: req.nextUrl.searchParams.get('code'), state: req.nextUrl.searchParams.get('state'), error: req.nextUrl.searchParams.get('error') },
      pending,
    )
    if (pending!.intent === 'bind') {
      const ctx = await getAdminContext()
      if (!ctx) return go('/admin/login', noticeParams('請先登入後台，再綁定 LINE'))
      await bindOwnLine(ctx, line)
      return go('/admin/settings/line', noticeParams('LINE 綁定完成', 'line_notice'))
    }
    if (pending!.intent === 'invite') {
      const { token } = await acceptInvitation(pending!.inviteToken ?? '', line, meta)
      return go('/admin', {}, token)
    }
    const { token } = await loginWithLine(line, meta)
    return go('/admin', {}, token)
  } catch (err) {
    const known = err instanceof LineAuthError || err instanceof AdminAccessError
    if (!known) console.error('[admin-line] 回呼處理失敗', err)
    return go(failPath, noticeParams(known ? err.message : 'LINE 登入失敗，請稍後再試'))
  }
}
