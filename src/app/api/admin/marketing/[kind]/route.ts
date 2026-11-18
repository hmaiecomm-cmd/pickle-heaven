import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { apiError, audit, badRequest, notFound, readJson, unauthorized } from '@/lib/admin-api'
import { KIND_LABEL } from '@/lib/marketing-content'
import { checkDraft, createItem, isKind, readDraft, resolveVenue, writeFailureMessage } from '@/server/marketing-content'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 新增橫幅／宣傳卡片／公告，一律存成草稿 */
export async function POST(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params
  if (!isKind(kind)) return notFound()
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'marketing')) return unauthorized()

  const body = await readJson<{ draft?: unknown }>(req)
  if (!body) return badRequest('送出的內容格式錯誤')
  const draft = readDraft(body.draft)
  const errors = await checkDraft(kind, draft)
  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: '請修正標示的欄位', fields: errors } }, { status: 422 })
  }

  try {
    const venue = await resolveVenue(ctx.venueId)
    if (!venue) return apiError(409, 'NO_VENUE', '找不到可寫入的場館，請先在系統設定建立場館')
    const item = await createItem(kind, draft, venue)
    await audit(ctx.username, 'MARKETING_CREATE', `${KIND_LABEL[kind]}：${draft.title.trim().slice(0, 60)}`, { kind, id: item.id })
    return NextResponse.json({ success: true, data: { id: item.id } }, { status: 201 })
  } catch (err) {
    console.error('[marketing] 新增失敗', err)
    return apiError(503, 'WRITE_FAILED', writeFailureMessage(err))
  }
}
