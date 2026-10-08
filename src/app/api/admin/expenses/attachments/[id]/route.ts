import { NextResponse, type NextRequest } from 'next/server'
import { apiError, readJson, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { deleteLooseAttachment, ExpenseError, loadAttachment, rotateAttachment } from '@/server/expense-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 讀取附件（?thumb=1 取縮圖）。只有擁有者或上傳者本人可讀；回應不快取、不提供公開網址。 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const { id } = await params
  try {
    const a = await loadAttachment(id, ctx, req.nextUrl.searchParams.get('thumb') === '1' ? 'thumb' : 'full')
    const download = req.nextUrl.searchParams.get('download') === '1'
    return new NextResponse(new Uint8Array(a.data), {
      status: 200,
      headers: {
        'Content-Type': a.mime,
        'Content-Length': String(a.data.length),
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'ATTACHMENT', err.message)
    throw err
  }
}

/** 旋轉附件。body: { rotate: 90 | 180 | 270 } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const { id } = await params
  const body = await readJson<{ rotate?: number }>(req)
  const deg = body?.rotate
  if (deg !== 90 && deg !== 180 && deg !== 270) return apiError(400, 'BAD_REQUEST', '旋轉角度不正確')
  try {
    return NextResponse.json({ success: true, data: await rotateAttachment(id, ctx, deg) })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'ATTACHMENT', err.message)
    console.error('[expenses] rotate', err)
    return apiError(500, 'ERROR', '旋轉失敗，請重試')
  }
}

/** 刪除尚未綁定費用的附件（放棄登錄） */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  const { id } = await params
  try {
    return NextResponse.json({ success: true, data: { deleted: await deleteLooseAttachment(id, ctx) } })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'ATTACHMENT', err.message)
    throw err
  }
}
