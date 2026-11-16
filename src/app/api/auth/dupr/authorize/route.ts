/**
 * DUPR 授權 URL 生成端點
 *
 * 生成授權 URL 並保存 CSRF state
 * - 生成隨機 state 字符串
 * - 在數據庫中記錄 state（用於 callback 時驗證）
 * - 返回授權 URL 給前端
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSessionUser } from '@/lib/session'
import { DuprService } from '@/server/dupr/service'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // 1️⃣ 驗證用戶已登入
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json(
        { error: '用戶未登入' },
        { status: 401 }
      )
    }

    // 2️⃣ 生成 CSRF state
    const state = crypto.randomBytes(32).toString('hex')

    // 3️⃣ 在數據庫中記錄 state（用於 callback 驗證）
    await prisma.duprApiLog.create({
      data: {
        userId: user.id,
        endpoint: 'oauth_state_' + state,
        method: 'CSRF',
        statusCode: 200,
        duration: 0,
        requestAt: new Date(),
      },
    })

    // 4️⃣ 使用服務層生成授權 URL
    const duprService = new DuprService()
    const authUrl = duprService.getAuthorizationUrl(user.id, state)

    // 5️⃣ 返回授權 URL
    return NextResponse.json({
      success: true,
      authUrl,
      state,
    })
  } catch (error) {
    console.error('[DUPR Authorize] 錯誤:', error)
    const message = error instanceof Error ? error.message : '未知錯誤'
    return NextResponse.json(
      { error: `生成授權 URL 失敗：${message}` },
      { status: 500 }
    )
  }
}
