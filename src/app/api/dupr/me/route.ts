/**
 * GET /api/dupr/me
 *
 * 查詢當前用戶的 DUPR 連結狀態
 * - 已連結：返回球員信息、評級
 * - 未連結：返回 null
 */

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { DuprService } from '@/server/dupr/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // 1️⃣ 驗證用戶已登入
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 2️⃣ 使用服務層查詢連結狀態
    const duprService = new DuprService()
    const link = await duprService.getLink(user.id)

    // 3️⃣ 返回結果
    return NextResponse.json({
      success: true,
      linked: link !== null,
      data: link ? {
        duprPlayerId: link.duprPlayerId,
        playerName: link.playerName,
        singlesRating: link.singlesRating,
        doublesRating: link.doublesRating,
        linkedAt: link.linkedAt,
        ratingUpdatedAt: link.ratingUpdatedAt,
      } : null,
    })
  } catch (error) {
    console.error('[DUPR Me] 錯誤:', error)
    const message = error instanceof Error ? error.message : '未知錯誤'
    return NextResponse.json(
      { success: false, error: `查詢失敗：${message}` },
      { status: 500 }
    )
  }
}
