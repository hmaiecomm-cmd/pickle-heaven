/**
 * DUPR OAuth Callback 端點
 *
 * 處理 DUPR 授權完成後的回調
 * - 驗證 CSRF state
 * - 交換授權碼為 Token
 * - 連結用戶的 DUPR 帳號
 * - 重定向到成功或失敗頁面
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { DuprService } from '@/server/dupr/service'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * OAuth Callback 處理
 * GET /api/auth/dupr/callback?code=...&state=...&error=...
 */
export async function GET(request: NextRequest) {
  try {
    // 1️⃣ 取得當前用戶會話
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.redirect(
        new URL(
          '/login?error=unauthorized&reason=not-logged-in',
          request.nextUrl.origin
        )
      )
    }

    // 2️⃣ 解析 Query 參數
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // 3️⃣ 檢查是否有錯誤
    if (error) {
      console.warn('[DUPR Callback] OAuth 錯誤:', { error, errorDescription })
      return NextResponse.redirect(
        new URL(
          `/dupr/link-error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(errorDescription || '')}`,
          request.nextUrl.origin
        )
      )
    }

    // 4️⃣ 檢查必要參數
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          '/dupr/link-error?error=invalid_request&description=缺少授權碼或狀態參數',
          request.nextUrl.origin
        )
      )
    }

    // 5️⃣ 驗證 CSRF state
    const storedState = await prisma.duprApiLog.findFirst({
      where: {
        userId: user.id,
        endpoint: 'oauth_state_' + state,
        method: 'CSRF',
      },
      orderBy: { requestAt: 'desc' },
    })

    if (!storedState) {
      console.error('[DUPR Callback] CSRF 驗證失敗:', { state })
      return NextResponse.redirect(
        new URL(
          '/dupr/link-error?error=invalid_state&description=CSRF 驗證失敗',
          request.nextUrl.origin
        )
      )
    }

    // 6️⃣ 用服務層處理 OAuth callback
    const duprService = new DuprService()
    const result = await duprService.handleOAuthCallback(user.id, code)

    // 7️⃣ 重定向到成功或失敗頁面
    if (result.success && result.data) {
      // 成功連結
      return NextResponse.redirect(
        new URL(
          `/dupr/link-success?playerId=${encodeURIComponent(result.data.playerId)}&playerName=${encodeURIComponent(result.data.playerName)}&singlesRating=${result.data.singlesRating}&doublesRating=${result.data.doublesRating}`,
          request.nextUrl.origin
        )
      )
    } else {
      // 連結失敗
      return NextResponse.redirect(
        new URL(
          `/dupr/link-error?error=callback_failed&description=${encodeURIComponent(result.message)}`,
          request.nextUrl.origin
        )
      )
    }
  } catch (error) {
    console.error('[DUPR Callback] 未捕捉的錯誤:', error)
    const message = error instanceof Error ? error.message : '未知錯誤'
    return NextResponse.redirect(
      new URL(
        `/dupr/link-error?error=server_error&description=${encodeURIComponent(message)}`,
        request.nextUrl.origin
      )
    )
  }
}
