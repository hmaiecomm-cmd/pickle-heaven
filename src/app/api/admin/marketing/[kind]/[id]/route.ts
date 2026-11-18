import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { apiError, audit, badRequest, notFound, readJson, unauthorized } from '@/lib/admin-api'
import { KIND_LABEL } from '@/lib/marketing-content'
import { checkDraft, contentColumns, findItem, isKind, readDraft, updateItem, writeFailureMessage } from '@/server/marketing-content'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Params = { params: Promise<{ kind: string; id: string }> }

function guarded(fn: (req: Request, p: Params) => Promise<Response>) {
  return async (req: Request, p: Params) => {
    try {
      return await fn(req, p)
    } catch (err) {
      console.error('[marketing] 寫入失敗', err)
      return apiError(503, 'WRITE_FAILED', writeFailureMessage(err))
    }
  }
}

async function guard({ params }: Params) {
  const { kind, id } = await params
  if (!isKind(kind)) return { res: notFound() } as const
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'marketing')) return { res: unauthorized() } as const
  const item = await findItem(kind, id, ctx.venueId)
  if (!item) return { res: notFound('找不到這筆資料，可能已被刪除') } as const
  return { res: null, kind, item, actor: ctx.username } as const
}

/**
 * { draft } 更新內容（不改變發布狀態）；
 * { action: 'publish' | 'unpublish' } 發布或下架，與編輯分開操作。
 */
export const PATCH = guarded(async (req: Request, p: Params) => {
  const g = await guard(p)
  if (g.res) return g.res
  const { kind, item, actor } = g

  const body = await readJson<{ draft?: unknown; action?: unknown }>(req)
  if (!body) return badRequest('送出的內容格式錯誤')

  if (body.action === 'publish' || body.action === 'unpublish') {
    const active = body.action === 'publish'
    await updateItem(kind, item.id, { active })
    await audit(actor, active ? 'MARKETING_PUBLISH' : 'MARKETING_UNPUBLISH', `${KIND_LABEL[kind]}：${item.title.slice(0, 60)}`, { kind, id: item.id })
    return NextResponse.json({ success: true, data: { id: item.id, active } })
  }

  if (body.draft === undefined) return badRequest('缺少要更新的內容')
  const draft = readDraft(body.draft)
  const errors = await checkDraft(kind, draft)
  if (Object.keys(errors).length) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: '請修正標示的欄位', fields: errors } }, { status: 422 })
  }
  await updateItem(kind, item.id, contentColumns(kind, draft))
  await audit(actor, 'MARKETING_UPDATE', `${KIND_LABEL[kind]}：${draft.title.trim().slice(0, 60)}`, { kind, id: item.id })
  return NextResponse.json({ success: true, data: { id: item.id } })
})

/** 軟刪除：前後台都不再顯示，資料保留供稽核 */
export const DELETE = guarded(async (_req: Request, p: Params) => {
  const g = await guard(p)
  if (g.res) return g.res
  const { kind, item, actor } = g
  await updateItem(kind, item.id, { deletedAt: new Date(), active: false })
  await audit(actor, 'MARKETING_DELETE', `${KIND_LABEL[kind]}：${item.title.slice(0, 60)}`, { kind, id: item.id })
  return NextResponse.json({ success: true })
})
