import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { apiError, badRequest, readJson, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { AiNotConfiguredError, isAiConfigured, runAdminChat, type ChatTurn } from '@/server/ai-assistant'
import { AiContextError, routeWithoutModel, runQuick, verifyContext, type AiContextInput } from '@/server/ai-quick'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** 工具迴圈可能需要多次呼叫模型 */
export const maxDuration = 120

const MAX_TURNS = 16
const MAX_CHARS = 2000
const QUICK_KINDS = new Set(['incidents', 'find', 'open_sessions', 'howto_weekly', 'refundable', 'devices'])

/**
 * AI 助理對話。
 * body: { messages: [{ role, text }], quick?: string, query?: string, context: { path, section, venueId, selection, filters } }
 * - quick：直接執行唯讀的系統查詢（不經過 AI 模型）。
 * - 其他：有設定 ANTHROPIC_API_KEY 時交給模型（工具依登入者權限開放）；沒有設定時改走關鍵字對應的快捷查詢或說明可用範圍。
 * 權限一律依登入者角色在伺服器端判斷，與手動操作相同；資料範圍（正式／展示）由登入憑證決定。
 */
export async function POST(req: NextRequest) {
  const ctx = await getAdminContext()
  if (!ctx || !can(ctx.role, 'ai')) return unauthorized()

  const body = await readJson<{ messages?: { role?: string; text?: unknown }[]; quick?: string; query?: string; context?: AiContextInput }>(req)
  const context: AiContextInput = body?.context ?? {}
  const raw = Array.isArray(body?.messages) ? body!.messages : []
  const history: ChatTurn[] = raw
    .slice(-MAX_TURNS)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', text: String(m.text).slice(0, MAX_CHARS) }))
  while (history.length && history[0].role !== 'user') history.shift()
  if (!history.length || history[history.length - 1].role !== 'user') return badRequest('最後一則必須是使用者訊息')
  const lastText = history[history.length - 1].text

  try {
    // 快捷查詢
    const quick = body?.quick && QUICK_KINDS.has(body.quick) ? body.quick : null
    if (quick) {
      return NextResponse.json({ success: true, data: await runQuick(quick, body?.query ?? lastText, context, ctx.role) })
    }

    // 沒有設定模型：不猜，導向對應的系統查詢
    if (!isAiConfigured()) {
      const routed = routeWithoutModel(lastText)
      if (routed) return NextResponse.json({ success: true, data: await runQuick(routed, lastText, context, ctx.role) })
      return NextResponse.json({
        success: true,
        data: {
          reply: 'AI 模型尚未設定（缺少 ANTHROPIC_API_KEY），目前只能使用下方的快捷查詢：異常事件、找客人預約、活動名額、新增每週活動、訂單可退項目、設備狀態。',
          queriedAt: new Date().toISOString(),
          mode: 'unavailable',
        },
      })
    }

    const verified = await verifyContext(context)
    const pageNote = [
      `目前功能：${context.section ?? '未提供'}`,
      verified.venue ? `場館：${verified.venue.name}` : '',
      verified.booking ? `使用者選取的訂單：${verified.booking.code}（id ${verified.booking.id}）` : '',
      context.filters ? `目前篩選：${context.filters}` : '',
      ctx.tenant === 'demo' ? '資料範圍：展示資料（虛構）' : '',
    ]
      .filter(Boolean)
      .join('；')
    const result = await runAdminChat(history, ctx.username, { pageNote, role: ctx.role })
    return NextResponse.json({
      success: true,
      data: {
        reply: result.reply,
        sources: result.sources.map((s) => ({ label: s, href: '/admin' })),
        queriedAt: new Date().toISOString(),
        mode: 'model',
        actions: result.actions,
      },
    })
  } catch (err) {
    if (err instanceof AiContextError) return apiError(409, 'AI_CONTEXT', err.message)
    if (err instanceof AiNotConfiguredError) return apiError(503, 'AI_NOT_CONFIGURED', 'AI 模型尚未設定。')
    if (err instanceof Anthropic.AuthenticationError) return apiError(503, 'AI_AUTH', 'AI 金鑰無效或已失效。')
    if (err instanceof Anthropic.RateLimitError) return apiError(429, 'AI_RATE_LIMIT', 'AI 使用量暫時過高，請稍後再試。')
    if (err instanceof Anthropic.APIError) {
      console.error('[ai-assistant] api error', err.status, err.message)
      return apiError(502, 'AI_UPSTREAM', 'AI 服務暫時無法回應，請稍後再試。')
    }
    console.error('[ai-assistant] unexpected', err)
    return apiError(500, 'AI_ERROR', 'AI 助理發生錯誤，請稍後再試。')
  }
}
