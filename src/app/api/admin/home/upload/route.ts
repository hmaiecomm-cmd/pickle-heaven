import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { MediaError, storeImage } from '@/server/media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'settings')) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: '上傳內容格式錯誤' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '請選擇圖片' }, { status: 400 })
  }

  try {
    const asset = await storeImage(file, `admin:${ctx.username}`)
    return NextResponse.json({ success: true, url: `/media/${asset.id}`, warning: asset.warning })
  } catch (err) {
    if (err instanceof MediaError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('[home/upload] 錯誤:', err)
    return NextResponse.json({ error: '圖片處理失敗，請稍後再試' }, { status: 500 })
  }
}
