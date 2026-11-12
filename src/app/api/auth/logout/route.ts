import { NextRequest, NextResponse } from 'next/server'
import { clearAdminSessionCookie } from '@/lib/admin-session'
import { logAuditEvent } from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    // 從 session 中獲取 adminId（用於 audit log）
    const sessionCookie = req.cookies.get('admin_session')?.value
    let adminId: string | undefined

    if (sessionCookie) {
      try {
        // 簡單解碼 JWT payload（不驗證簽名）
        const parts = sessionCookie.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
          adminId = payload.adminId
        }
      } catch (e) {
        // 忽略解碼錯誤
      }
    }

    // 記錄登出事件
    if (adminId) {
      await logAuditEvent(adminId, 'logout', 'admin_session')
    }

    // 清除 session cookie
    await clearAdminSessionCookie()

    const response = NextResponse.json({ success: true })
    response.cookies.delete('admin_session')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    )
  }
}
