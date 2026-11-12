/**
 * 管理員 API：查詢控制系統日誌
 *
 * GET /api/admin/logs?venueId=...&eventType=...&startDate=...&limit=50
 *
 * 查詢參數：
 * - venueId: 場館 ID（必填）
 * - eventType: 事件類型（可選，逗號分隔）
 * - severity: 嚴重程度（可選：INFO,WARNING,ERROR）
 * - environment: 環境（可選：SIMULATION,PRODUCTION）
 * - startDate: 開始日期（可選，ISO 格式）
 * - endDate: 結束日期（可選，ISO 格式）
 * - circuitId: 迴路 ID（可選）
 * - commandId: 命令 ID（可選）
 * - reservationId: 預約 ID（可選）
 * - limit: 每頁數量（預設 50）
 * - offset: 分頁偏移（預設 0）
 */

import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { queryEvents, getEventStats, getEventTimeline } from '@/server/event-logger'

export async function GET(req: NextRequest) {
  // 驗證管理員權限
  const ctx = await pagePermission('logs')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const {
      searchParams,
    } = req.nextUrl

    // 解析查詢參數
    const venueId = searchParams.get('venueId')
    const eventTypeStr = searchParams.get('eventType')
    const severityStr = searchParams.get('severity')
    const environment = searchParams.get('environment') as 'SIMULATION' | 'PRODUCTION' | null
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const circuitId = searchParams.get('circuitId')
    const commandId = searchParams.get('commandId')
    const reservationId = searchParams.get('reservationId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500) // 最多 500
    const offset = parseInt(searchParams.get('offset') || '0')

    // 驗證必填參數
    if (!venueId) {
      return NextResponse.json(
        { error: '缺少必要參數: venueId' },
        { status: 400 },
      )
    }

    // 解析可選參數
    const eventTypes = eventTypeStr ? (eventTypeStr.split(',') as any[]) : undefined
    const severity = severityStr ? (severityStr.split(',') as any[]) : undefined
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined

    // 查詢事件
    const result = await queryEvents({
      venueId,
      eventTypes,
      severity,
      environment: environment || undefined,
      startDate,
      endDate,
      circuitId: circuitId || undefined,
      commandId: commandId || undefined,
      reservationId: reservationId || undefined,
      limit,
      offset,
    })

    return NextResponse.json(
      {
        success: true,
        data: result.events,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: result.hasMore,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[API] 查詢日誌失敗:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 },
    )
  }
}

/**
 * GET /api/admin/logs/stats — 日誌統計
 */
export async function POST(req: NextRequest) {
  const ctx = await pagePermission('logs')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { venueId, hours = 24, action } = body

    if (!venueId) {
      return NextResponse.json(
        { error: '缺少必要參數: venueId' },
        { status: 400 },
      )
    }

    // 檢查是否是特殊動作
    if (action === 'getStats') {
      const stats = await getEventStats(venueId, hours)
      return NextResponse.json({ success: true, data: stats }, { status: 200 })
    }

    if (action === 'getTimeline') {
      const { reservationId } = body
      if (!reservationId) {
        return NextResponse.json(
          { error: '缺少必要參數: reservationId' },
          { status: 400 },
        )
      }

      const timeline = await getEventTimeline(reservationId)
      return NextResponse.json({ success: true, data: timeline }, { status: 200 })
    }

    return NextResponse.json(
      { error: '未知的動作' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[API] 日誌操作失敗:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 },
    )
  }
}
