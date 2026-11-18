import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: '沒有上傳文件' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '只支援圖片文件' }, { status: 400 })
    }

    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    return NextResponse.json({
      success: true,
      imageId,
      filename: file.name,
      type,
    })
  } catch (error) {
    console.error('[home/upload] 錯誤:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上傳失敗' },
      { status: 500 }
    )
  }
}
