import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

/**
 * 後台存取保護。
 *
 * /admin 下的頁面有些是 client component（無法呼叫 requireAdmin），
 * 因此統一在 middleware 驗證 ph_admin cookie；驗證邏輯與 lib/admin-auth.ts 相同。
 * 登入頁本身放行，未登入或 token 無效一律導向登入頁。
 */
const ADMIN_COOKIE = 'ph_admin'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return NextResponse.next()

  const token = req.cookies.get(ADMIN_COOKIE)?.value
  const secret = process.env.SESSION_SECRET
  if (token && secret && secret.length >= 16) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret))
      return NextResponse.next()
    } catch {
      // 過期或簽章不符，視同未登入
    }
  }

  const login = req.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = ''
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/admin/:path*'] }
