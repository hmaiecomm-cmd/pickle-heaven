import { NextResponse, type NextRequest } from 'next/server'
import { apiError, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { ExpenseError, pruneLooseAttachments, storeAttachment } from '@/server/expense-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 上傳收據附件（拍照或檔案）。multipart/form-data，欄位 file。
 * 檔案存在私有資料表，之後只能經 /api/admin/expenses/attachments/[id] 驗證權限讀取。
 * 上傳成功才回傳附件 id；登錄費用時再與費用綁定（同一交易）。
 */
export async function POST(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'expenses.own')) return unauthorized()
  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return apiError(400, 'BAD_REQUEST', '上傳內容不正確')
  }
  if (!file) return apiError(400, 'BAD_REQUEST', '沒有收到檔案')
  try {
    const row = await storeAttachment(file, ctx)
    pruneLooseAttachments().catch(() => {})
    return NextResponse.json({ success: true, data: { ...row, createdAt: row.createdAt.toISOString(), isPdf: row.mime === 'application/pdf' } }, { status: 201 })
  } catch (err) {
    if (err instanceof ExpenseError) return apiError(err.status, 'ATTACHMENT', err.message)
    console.error('[expenses] upload', err)
    return apiError(500, 'ERROR', '上傳失敗，請重試')
  }
}
