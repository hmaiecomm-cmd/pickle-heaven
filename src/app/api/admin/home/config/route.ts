import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { getOrCreateHomePageConfig } from '@/server/home-editor-service'

export async function GET() {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const result = await getOrCreateHomePageConfig()
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    console.error('[home/config] 錯誤:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得配置失敗' },
      { status: 500 }
    )
  }
}
