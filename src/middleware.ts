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

/** 放行並標記為後台區域，根版面據此套用後台配色 */
function pass(req: NextRequest) {
  const headers = new Headers(req.headers)
  headers.set('x-ph-area', 'admin')
  // 讓後台版面知道目前路徑（session 失效時導回登入頁）；一律覆寫用戶端送來的同名標頭
  headers.set('x-ph-path', req.nextUrl.pathname)
  return NextResponse.next({ request: { headers } })
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) return pass(req)

  const token = req.cookies.get(ADMIN_COOKIE)?.value
  const secret = process.env.SESSION_SECRET
  if (token && secret && secret.length >= 16) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret))
      return pass(req)
    } catch {
      // 過期或簽章不符，視同未登入
    }
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: '請先登入' } }, { status: 401 })
  }
  const login = req.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = ''
  return NextResponse.redirect(login)
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }
