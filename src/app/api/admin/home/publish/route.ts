import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import type { EditorState } from '@/app/admin/home/editor-types'

export async function POST() {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const config = await prisma.homePageConfig.findFirst()
    if (!config) {
      return NextResponse.json({ error: '配置不存在' }, { status: 404 })
    }

    // 驗證 draftConfig 是有效的 JSON
    let draftState: EditorState
    try {
      draftState = JSON.parse(config.draftConfig)
    } catch {
      return NextResponse.json({ error: '草稿配置無效' }, { status: 400 })
    }

    // 發布草稿配置
    const updated = await prisma.homePageConfig.update({
      where: { id: config.id },
      data: {
        publishedConfig: config.draftConfig,
        publishedAt: new Date(),
        publishedBy: ctx.username,
      },
    })

    return NextResponse.json({
      success: true,
      message: '已發布到正式首頁',
      data: draftState,
    })
  } catch (error) {
    console.error('[home/publish] 錯誤:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '發布失敗',
      },
      { status: 500 }
    )
  }
}
