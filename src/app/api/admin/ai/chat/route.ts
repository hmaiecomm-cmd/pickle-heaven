import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { apiError, badRequest, readJson, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { AiNotConfiguredError, runAdminChat, type ChatTurn } from '@/server/ai-assistant'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** 工具迴圈可能需要多次呼叫模型 */
export const maxDuration = 120

const MAX_TURNS = 20
const MAX_CHARS = 4000

/** AI 管理助理對話。body: { messages: [{ role: 'user' | 'assistant', text }] }，最後一則必須是 user。 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()

  const body = await readJson<{ messages?: { role?: string; text?: unknown }[] }>(req)
  const raw = body?.messages
  if (!Array.isArray(raw) || raw.length === 0) return badRequest('缺少對話內容')

  const history: ChatTurn[] = raw
    .slice(-MAX_TURNS)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', text: String(m.text).slice(0, MAX_CHARS) }))
  // 第一則必須是 user
  while (history.length && history[0].role !== 'user') history.shift()
  if (!history.length || history[history.length - 1].role !== 'user') return badRequest('最後一則必須是使用者訊息')

  try {
    const result = await runAdminChat(history, admin)
    console.info('[ai-assistant]', { actor: admin, tools: result.toolsUsed, model: result.model, ...result.usage })
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      return apiError(503, 'AI_NOT_CONFIGURED', 'AI 助理尚未設定：請在 Vercel 環境變數加入 ANTHROPIC_API_KEY 後重新部署。')
    }
    if (err instanceof Anthropic.AuthenticationError) return apiError(503, 'AI_AUTH', 'AI 金鑰無效或已失效，請更新 ANTHROPIC_API_KEY。')
    if (err instanceof Anthropic.PermissionDeniedError) return apiError(503, 'AI_PERMISSION', 'AI 金鑰沒有使用此模型的權限。')
    if (err instanceof Anthropic.RateLimitError) return apiError(429, 'AI_RATE_LIMIT', 'AI 使用量暫時過高，請稍後再試。')
    if (err instanceof Anthropic.BadRequestError) {
      console.error('[ai-assistant] bad request', err.message)
      return apiError(502, 'AI_BAD_REQUEST', 'AI 服務拒絕了這次請求，請稍後再試或回報管理員。')
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[ai-assistant] api error', err.status, err.message)
      return apiError(502, 'AI_UPSTREAM', 'AI 服務暫時無法回應，請稍後再試。')
    }
    console.error('[ai-assistant] unexpected', err)
    return apiError(500, 'AI_ERROR', 'AI 助理發生錯誤，請稍後再試。')
  }
}
