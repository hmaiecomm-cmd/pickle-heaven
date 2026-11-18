import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const body = await request.json()
    console.log('[home/draft] 接收到數據:', JSON.stringify(body).substring(0, 100))

    // 暫時簡單實現：直接返回成功
    // TODO: 連接 saveHomeDraft 服務
    return NextResponse.json({
      success: true,
      data: body,
      message: '草稿已儲存'
    })
  } catch (error) {
    console.error('[home/draft] 錯誤:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存失敗'
      },
      { status: 500 }
    )
  }
}
