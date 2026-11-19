import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import type { EditorState } from '@/app/admin/home/editor-types'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const { versionId } = await request.json()
    if (!versionId) {
      return NextResponse.json({ error: '版本 ID 未提供' }, { status: 400 })
    }

    const version = await prisma.homePageVersion.findUnique({
      where: { id: versionId },
      include: { homePageConfig: true },
    })

    if (!version) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 })
    }

    const configData = JSON.parse(version.config) as EditorState

    // 更新草稿為選定版本的內容
    await prisma.homePageConfig.update({
      where: { id: version.homePageConfigId },
      data: {
        draftConfig: version.config,
        draftUpdatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, data: configData })
  } catch (error) {
    console.error('[home/restore] 錯誤:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '還原失敗' },
      { status: 500 }
    )
  }
}
