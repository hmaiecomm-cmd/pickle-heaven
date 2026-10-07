import { NextResponse, type NextRequest } from 'next/server'
import { audit, badRequest, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 記錄擁有者對 AI 操作預覽的決定。只寫稽核紀錄，不執行任何操作。
 * body: { decision: 'confirm' | 'decline', action: { actionType, title, items, impact } }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi('ai')
  if (!admin) return unauthorized()
  const body = await readJson<{ decision?: string; action?: { actionType?: string; title?: string; items?: unknown; impact?: string } }>(req)
  const decision = body?.decision
  const a = body?.action
  if ((decision !== 'confirm' && decision !== 'decline') || !a || typeof a.title !== 'string') return badRequest('內容不完整')

  await audit(admin, decision === 'confirm' ? 'AI_ACTION_CONFIRMED' : 'AI_ACTION_DECLINED', 'ai-assistant', {
    actionType: typeof a.actionType === 'string' ? a.actionType : 'other',
    title: a.title.slice(0, 120),
    items: Array.isArray(a.items) ? a.items.filter((x): x is string => typeof x === 'string').slice(0, 50) : [],
    impact: typeof a.impact === 'string' ? a.impact.slice(0, 500) : '',
    executed: false,
  })
  return NextResponse.json({ success: true, data: { recorded: true, executed: false } })
}
