/**
 * DELETE /api/dupr/link
 *
 * 解除用戶的 DUPR 帳號連結
 * - 標記 unlinkedAt 時間戳
 * - 保留歷史數據（不删除）
 * - 用戶可以重新連結
 */

import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'
import { DuprService } from '@/server/dupr/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE() {
  try {
    // 1️⃣ 驗證用戶已登入
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: '未授權' },
        { status: 401 }
      )
    }

    // 2️⃣ 使用服務層解除連結
    const duprService = new DuprService()
    const unlinked = await duprService.unlinkAccount(user.id)

    // 3️⃣ 返回結果
    if (unlinked) {
      return NextResponse.json({
        success: true,
        message: '已解除 DUPR 帳號連結',
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: '未連結任何 DUPR 帳號或解除失敗',
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[DUPR Link Delete] 錯誤:', error)
    const message = error instanceof Error ? error.message : '未知錯誤'
    return NextResponse.json(
      { success: false, error: `解除連結失敗：${message}` },
      { status: 500 }
    )
  }
}
