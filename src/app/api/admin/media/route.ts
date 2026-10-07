import { NextResponse, type NextRequest } from 'next/server'
import { audit, badRequest, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { MediaError, storeImage } from '@/server/media'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 上傳活動封面。multipart/form-data，欄位 file。回傳 { id, url, thumb, width, height, warning } */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi('activities')
  if (!admin) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('上傳內容格式錯誤')
  }
  const file = form.get('file')
  if (!(file instanceof File)) return badRequest('請選擇圖片')

  try {
    const asset = await storeImage(file, `admin:${admin}`)
    if (!asset.reused) await audit(admin, 'MEDIA_UPLOAD', file.name.slice(0, 80), { assetId: asset.id, width: asset.width, height: asset.height })
    return NextResponse.json({
      success: true,
      data: {
        id: asset.id,
        url: `/media/${asset.id}`,
        thumb: `/media/${asset.id}?size=thumb`,
        width: asset.width,
        height: asset.height,
        warning: asset.warning,
      },
    })
  } catch (err) {
    if (err instanceof MediaError) return badRequest(err.message)
    console.error('[media] 上傳失敗', err)
    return NextResponse.json({ success: false, error: '圖片處理失敗，請稍後再試' }, { status: 500 })
  }
}
