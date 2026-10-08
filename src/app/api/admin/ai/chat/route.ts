import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { apiError, badRequest, readJson, unauthorized } from '@/lib/admin-api'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { AiNotConfiguredError, isAiConfigured, runAdminChat, type ChatTurn } from '@/server/ai-assistant'
import { AiContextError, routeWithoutModel, runQuick, verifyContext, type AiContextInput } from '@/server/ai-quick'
import { GUIDES, guideList, matchGuide, renderGuide } from '@/server/ai-guide'

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

  const withLabel = <T extends { mode: string; label?: string }>(d: T) => ({ ...d, demo: ctx.tenant === 'demo', label: d.label ?? (ctx.tenant === 'demo' ? '展示範例（隔離示範資料）' : d.mode === 'quick' ? '即時查詢' : d.mode === 'model' ? 'AI 回答（依權限查詢）' : '操作指南') })
  const unavailable = (reason: string) => ({
    reply: `即時查詢暫不可用：${reason}。操作指南仍可使用，點選下方題目即可；需要即時資料請直接到對應頁面查看。`,
    cards: [{ kind: 'faq', title: '操作指南', items: guideList() }],
    queriedAt: new Date().toISOString(),
    mode: 'unavailable' as const,
    label: '操作指南',
    demo: ctx.tenant === 'demo',
  })

  try {
    // 操作指南（指定題目）：不需要模型
    if (body?.quick?.startsWith('guide:')) {
      const g = GUIDES.find((x) => x.id === body!.quick!.slice(6))
      if (g) return NextResponse.json({ success: true, data: await renderGuide(g, ctx.role, ctx.tenant) })
    }
    // 快捷查詢
    const quick = body?.quick && QUICK_KINDS.has(body.quick) ? body.quick : null
    if (quick) {
      return NextResponse.json({ success: true, data: withLabel(await runQuick(quick, body?.query ?? lastText, context, ctx.role)) })
    }
    // 自由提問：先比對操作指南（固定說明，不需即時資料）
    const guide = matchGuide(lastText)
    if (guide) return NextResponse.json({ success: true, data: await renderGuide(guide, ctx.role, ctx.tenant) })

    // 沒有設定模型：不猜，導向對應的系統查詢；判斷不了就提供操作指南
    if (!isAiConfigured()) {
      const routed = routeWithoutModel(lastText)
      if (routed) return NextResponse.json({ success: true, data: withLabel(await runQuick(routed, lastText, context, ctx.role)) })
      return NextResponse.json({ success: true, data: unavailable('AI 模型尚未設定') })
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
      data: withLabel({
        reply: result.reply,
        sources: result.sources.map((s) => ({ label: s, href: '/admin' })),
        queriedAt: new Date().toISOString(),
        mode: 'model',
        actions: result.actions,
      }),
    })
  } catch (err) {
    // 異常來源分開回報；AI 服務失敗時操作指南仍可使用
    if (err instanceof AiContextError) return apiError(409, 'AI_CONTEXT', err.message)
    if (err instanceof AiNotConfiguredError) return NextResponse.json({ success: true, data: unavailable('AI 模型尚未設定') })
    if (err instanceof Anthropic.AuthenticationError) return NextResponse.json({ success: true, data: unavailable('AI 金鑰無效或已失效，請擁有者檢查設定') })
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ success: true, data: unavailable('AI 使用量暫時過高，請稍後再試') })
    if (err instanceof Anthropic.APIConnectionTimeoutError) return NextResponse.json({ success: true, data: unavailable('AI 服務逾時') })
    if (err instanceof Anthropic.APIError) {
      console.error('[ai-assistant] api error', err.status, err.message)
      return NextResponse.json({ success: true, data: unavailable('AI 服務暫時無法回應') })
    }
    console.error('[ai-assistant] unexpected', err)
    return apiError(500, 'AI_ERROR', 'AI 助理發生錯誤，請稍後再試。')
  }
}
