import { getAdminContext } from '@/lib/admin-auth'
import { executeOperation, canExecuteOperation } from '@/server/ai-operation-executor'
import type { OperationType } from '@/server/ai-operations'

export const runtime = 'nodejs'

/**
 * AI 操作確認與執行端點 — Phase 4
 * POST /api/ai/operations
 * body: { operationId, operationType, targetId, confirmed, metadata }
 */
export async function POST(req: Request) {
  try {
    const ctx = await getAdminContext()
    if (!ctx) {
      return new Response(
        JSON.stringify({ error: '請先登入' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { operationId, operationType, targetId, confirmed, metadata } = await req.json()

    // 驗證必要欄位
    if (!operationId || !operationType || !targetId) {
      return new Response(
        JSON.stringify({ error: '缺少必要的操作信息' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 檢查操作是否可執行
    const { canExecute, reason } = await canExecuteOperation(operationType as OperationType, targetId)
    if (!canExecute) {
      return new Response(
        JSON.stringify({ error: `無法執行此操作: ${reason}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 檢查用戶確認
    if (!confirmed) {
      return new Response(
        JSON.stringify({ error: '操作需要用戶確認' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 執行操作
    const result = await executeOperation(
      operationId,
      operationType as OperationType,
      targetId,
      ctx.username,
      metadata
    )

    if (!result.success) {
      return new Response(
        JSON.stringify(result),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[AI Operations Error]', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: '發生錯誤，請稍後再試' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
