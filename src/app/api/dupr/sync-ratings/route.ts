/**
 * POST /api/dupr/sync-ratings
 *
 * 手動從 DUPR 同步最新評級
 * - 僅對已連結的用戶有效
 * - 調用 DUPR API 取得最新評級
 * - 更新本地數據庫
 * - 返回同步結果
 */

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { DuprService } from '@/server/dupr/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  try {
    // 1️⃣ 驗證用戶已登入
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 2️⃣ 使用服務層同步評級
    const duprService = new DuprService()
    const result = await duprService.syncRatings(user.id)

    // 3️⃣ 返回結果
    if (result.success && result.data) {
      return NextResponse.json({
        success: true,
        data: {
          singlesRating: result.data.singlesRating,
          doublesRating: result.data.doublesRating,
          syncedAt: result.data.syncedAt,
        },
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message || '未連結 DUPR 帳號或同步失敗',
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[DUPR Sync Ratings] 錯誤:', error)
    const message = error instanceof Error ? error.message : '未知錯誤'
    return NextResponse.json(
      { success: false, error: `同步評級失敗：${message}` },
      { status: 500 }
    )
  }
}
