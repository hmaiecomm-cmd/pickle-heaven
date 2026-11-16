import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/ws/anomalies
 * Server-Sent Events (SSE) 端点：实时异常推送
 *
 * 使用 SSE 而不是 WebSocket 以支持无服务器环境
 */
export async function GET(req: NextRequest) {
  // 设置 SSE 响应头
  const responseHeaders = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // 创建一个长连接的可读流
  const encoder = new TextEncoder()
  let isAlive = true

  const stream = new ReadableStream({
    start(controller) {
      // 发送连接建立消息
      controller.enqueue(
        encoder.encode(':connected\n\n')
      )

      // 心跳保持连接活跃（每 30 秒）
      const heartbeatInterval = setInterval(() => {
        if (isAlive) {
          controller.enqueue(encoder.encode(':ping\n\n'))
        } else {
          clearInterval(heartbeatInterval)
          controller.close()
        }
      }, 30000)

      // 模拟异常更新推送（Demo）
      // 实际使用中应该订阅数据库变更或消息队列
      const demoInterval = setInterval(() => {
        if (!isAlive) {
          clearInterval(demoInterval)
          return
        }

        // 随机模拟异常事件（仅用于演示）
        if (Math.random() > 0.95) {
          const circuits = ['01', '05', '12', '15']
          const types = ['controller_offline', 'command_failed', 'state_mismatch', 'overload']
          const randomCircuit = circuits[Math.floor(Math.random() * circuits.length)]
          const randomType = types[Math.floor(Math.random() * types.length)]

          const event = {
            type: 'updated' as const,
            circuitId: randomCircuit,
            anomaly: {
              id: `anom_${Date.now()}`,
              type: randomType,
              severity: Math.random() > 0.5 ? 'critical' : 'warning',
              status: 'pending' as const,
              occurredAt: new Date().toISOString(),
              lastReportedAt: new Date().toISOString(),
              acknowledgedBy: null,
              acknowledgedAt: null,
              resolvedBy: null,
              resolvedAt: null,
              notes: null,
            },
            timestamp: new Date().toISOString(),
          }

          controller.enqueue(
            encoder.encode(
              `event: anomaly-update\ndata: ${JSON.stringify(event)}\n\n`
            )
          )
        }
      }, 5000)

      // 清理函数
      const cleanup = () => {
        isAlive = false
        clearInterval(heartbeatInterval)
        clearInterval(demoInterval)
      }

      // 客户端断开连接时清理
      req.signal.addEventListener('abort', cleanup)
    },
  })

  return new NextResponse(stream, { headers: responseHeaders })
}

/**
 * OPTIONS /api/ws/anomalies
 * CORS 预检请求处理
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
