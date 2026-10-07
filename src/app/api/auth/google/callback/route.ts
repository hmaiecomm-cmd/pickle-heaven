import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createSession } from '@/lib/session'
import { completeAuth, GoogleAuthError, OAUTH_COOKIE, readOAuthCookie, safeNextPath } from '@/lib/google-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Google 授權回呼。
 * 成功：以 Google sub 找或建立會員、建立本站 session、回到原本要去的頁面。
 * 取消或失敗：回到原頁並帶上 auth=cancelled / auth=failed，由前端提示；不會建立 session。
 * 絕不以 Email 或姓名自動合併既有會員。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const stored = await readOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value)
  const next = stored?.next ?? safeNextPath(null)

  const finish = (path: string, auth?: 'cancelled' | 'failed' | 'ok') => {
    const url = new URL(path, req.nextUrl.origin)
    if (auth && auth !== 'ok') url.searchParams.set('auth', auth)
    const res = NextResponse.redirect(url)
    res.cookies.set(OAUTH_COOKIE, '', { httpOnly: true, path: '/api/auth/google', maxAge: 0 })
    return res
  }

  if (sp.get('error')) {
    // access_denied：使用者在 Google 畫面取消
    return finish(next, sp.get('error') === 'access_denied' ? 'cancelled' : 'failed')
  }
  const code = sp.get('code')
  const state = sp.get('state')
  if (!code || !state || !stored) return finish(next, 'failed')

  try {
    const profile = await completeAuth(code, state, stored)

    const existing = await prisma.user.findUnique({ where: { googleSub: profile.sub } })
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          // 顯示名稱由會員自行維護，不每次覆寫；頭像與已驗證的 Email 跟著 Google 更新
          data: {
            pictureUrl: profile.picture ?? existing.pictureUrl,
            email: profile.emailVerified && profile.email ? profile.email : existing.email,
            lastLoginAt: new Date(),
          },
        })
      : await prisma.user.create({
          data: {
            googleSub: profile.sub,
            displayName: profile.name,
            pictureUrl: profile.picture,
            email: profile.emailVerified ? profile.email : null,
            lastLoginAt: new Date(),
          },
        })

    await createSession(user.id)
    return finish(next, 'ok')
  } catch (err) {
    if (!(err instanceof GoogleAuthError)) console.error('[google] 回呼處理失敗', err)
    return finish(next, 'failed')
  }
}
