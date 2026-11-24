import { pagePermission, getAdminContext } from '@/lib/admin-auth'
import { openai, DEFAULT_MODEL, MAX_TOKENS, INPUT_MAX_LENGTH } from '@/lib/openai'
import { getSystemPrompt } from '@/lib/ai-system-prompts'
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

    // 解析請求
    const { message, pageName } = await req.json()

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

    // 取得用戶角色
    const userRole: UserRole = (ctx.role as UserRole) || 'ADMIN'

    // 設置 SSE 頭部
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 建立 OpenAI 串流
          const response = await openai.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: [
              {
                role: 'system',
                content: getSystemPrompt(userRole, pageName)
              },
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
              const event = `data: ${JSON.stringify({ content: delta })}\n\n`
              controller.enqueue(encoder.encode(event))
            }
          }

          // 完成信號
          controller.enqueue(encoder.encode('data: {"done": true}\n\n'))
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
