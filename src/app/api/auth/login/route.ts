import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { createAdminSession, setAdminSessionCookie } from '@/lib/admin-session'
import { logAuditEvent } from '@/lib/admin-auth'

/**
 * POST /api/auth/login - 本地帳號登入
 */
export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Missing username or password' },
        { status: 400 }
      )
    }

    // 查詢管理員帳號
    const admin = await prisma.adminUser.findUnique({
      where: { username: username.toLowerCase() },
    })

    if (!admin) {
      // 記錄失敗嘗試
      await logAuditEvent(
        undefined,
        'login_failed_not_found',
        'admin_login',
        undefined,
        { username: username.toLowerCase(), reason: 'user_not_found' }
      )

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 檢查帳號狀態
    if (admin.status === 'disabled') {
      await logAuditEvent(
        admin.id,
        'login_failed_disabled',
        'admin_login',
        admin.id,
        { reason: 'account_disabled' }
      )

      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403 }
      )
    }

    // 檢查帳號是否被鎖定
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      await logAuditEvent(
        admin.id,
        'login_failed_locked',
        'admin_login',
        admin.id,
        { reason: 'account_locked', lockedUntil: admin.lockedUntil }
      )

      return NextResponse.json(
        { error: 'Account is temporarily locked due to failed login attempts' },
        { status: 403 }
      )
    }

    // 驗證密碼
    const passwordMatch = await verifyPassword(password, admin.passwordHash)

    if (!passwordMatch) {
      // 增加失敗計數
      const newFailureCount = admin.loginFailureCount + 1
      let lockedUntil: Date | null = null

      // 超過 5 次失敗後鎖定帳號 15 分鐘
      if (newFailureCount >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
      }

      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          loginFailureCount: newFailureCount,
          lockedUntil,
        },
      })

      await logAuditEvent(
        admin.id,
        'login_failed_password',
        'admin_login',
        admin.id,
        { failureCount: newFailureCount, reason: 'invalid_password' }
      )

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 密碼正確 - 重置失敗計數
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        loginFailureCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        mustChangePassword: false,
      },
    })

    // 建立 session
    const token = await createAdminSession({
      adminId: admin.id,
      email: admin.displayName,
      role: admin.role,
    })

    await setAdminSessionCookie(token)

    // 記錄成功登入
    await logAuditEvent(
      admin.id,
      'login_success',
      'admin_login',
      admin.id,
      { ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') }
    )

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
      },
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
