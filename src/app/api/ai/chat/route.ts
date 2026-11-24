import { pagePermission, getAdminContext } from '@/lib/admin-auth'
import { openai, DEFAULT_MODEL, MAX_TOKENS, INPUT_MAX_LENGTH } from '@/lib/openai'
import { getSystemPrompt } from '@/lib/ai-system-prompts'
import { getOrCreateConversation, getConversationHistory, addMessageToConversation } from '@/server/ai-conversation-service'
import { extractPageContext } from '@/server/ai-page-context'
import { queryRecentBookings, queryVenueSummary, queryMemberStats } from '@/server/ai-data-queries'
import type { UserRole } from '@/lib/ai-system-prompts'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    // 驗證登入和權限
    const ctx = await getAdminContext()
    if (!ctx) {
      return new Response(
        JSON.stringify({ error: '請先登入' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 驗證儀表板權限
    if (!ctx.permissions.includes('dashboard')) {
      return new Response(
        JSON.stringify({ error: '您沒有使用 AI 助理的權限' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 驗證 OpenAI API key
    if (!openai) {
      return new Response(
        JSON.stringify({ error: '❌ OPENAI_API_KEY 未設置。AI 助理目前無法使用。' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 解析請求
    const { message, pageName, conversationId: providedConversationId } = await req.json()

    // 驗證輸入
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: '訊息不能為空' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const trimmedMessage = message.trim()
    if (trimmedMessage.length === 0) {
      return new Response(
        JSON.stringify({ error: '訊息不能為空白' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (trimmedMessage.length > INPUT_MAX_LENGTH) {
      return new Response(
        JSON.stringify({ error: `訊息超過長度限制 (${INPUT_MAX_LENGTH} 字元)` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 取得或建立對話
    const conversationId = providedConversationId || await getOrCreateConversation(ctx.username)

    // 取得對話歷史
    const history = await getConversationHistory(conversationId, ctx.username)

    // 取得用戶角色
    const userRole: UserRole = (ctx.role as UserRole) || 'ADMIN'

    // 提取頁面上下文（Phase 3）
    const pageContext = extractPageContext(pageName || '未知頁面', '', userRole, ctx.permissions)

    // 設置 SSE 頭部
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = ''

          // 構建包含頁面上下文的系統提示
          let systemPrompt = getSystemPrompt(userRole, pageName)
          systemPrompt += `\n\n【頁面上下文】\n${pageContext.contextSummary}`

          // Phase 3 擴展：加入實時資料查詢（如果頁面支持）
          let contextData = ''
          if (pageContext.permissions.includes('bookings') && pageName?.includes('booking')) {
            const bookingData = await queryRecentBookings('', 5, true)
            if (bookingData.success) {
              contextData += `\n\n【最近預約】\n${JSON.stringify(bookingData.data, null, 2)}`
            }
          }
          if (pageContext.permissions.includes('dashboard')) {
            const summaryData = await queryVenueSummary('', true)
            if (summaryData.success) {
              contextData += `\n\n【場館摘要】\n${JSON.stringify(summaryData.data, null, 2)}`
            }
          }
          if (pageContext.permissions.includes('members')) {
            const memberData = await queryMemberStats('', true)
            if (memberData.success) {
              contextData += `\n\n【會員統計】\n${JSON.stringify(memberData.data, null, 2)}`
            }
          }

          if (contextData) {
            systemPrompt += contextData
          }

          // 建立 OpenAI 串流（包含對話歷史和頁面上下文）
          const response = await openai!.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              ...history,
              {
                role: 'user',
                content: trimmedMessage
              }
            ],
            temperature: 0.7,
            max_tokens: MAX_TOKENS,
            stream: true,
          })

          // 串流回應文字
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) {
              buffer += delta
              const event = `data: ${JSON.stringify({ content: delta })}\n\n`
              controller.enqueue(encoder.encode(event))
            }
          }

          // 保存用戶訊息和 AI 回應到資料庫
          if (buffer) {
            await addMessageToConversation(conversationId, ctx.username, 'user', trimmedMessage)
            await addMessageToConversation(conversationId, ctx.username, 'assistant', buffer)
          }

          // 完成信號
          const completeEvent = JSON.stringify({ done: true, conversationId })
          controller.enqueue(encoder.encode(`data: ${completeEvent}\n\n`))
          controller.close()
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知錯誤'
          console.error('[AI Chat Error]', errorMessage)

          const errorEvent = `data: ${JSON.stringify({ error: '無法生成回應，請稍後再試' })}\n\n`
          controller.enqueue(encoder.encode(errorEvent))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  } catch (error) {
    console.error('[AI Chat Route Error]', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: '發生錯誤，請稍後再試' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
