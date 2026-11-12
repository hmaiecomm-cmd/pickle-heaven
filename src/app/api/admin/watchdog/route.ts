/**
 * 管理員 API：Watchdog 告警管理
 *
 * GET /api/admin/watchdog?venueId=... — 查詢告警
 * POST /api/admin/watchdog — 確認／解決告警
 */

import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { acknowledgeAlert, resolveAlert, getWatchdogSummary, runWatchdogCheck } from '@/server/watchdog-service'

export async function GET(req: NextRequest) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const { searchParams } = req.nextUrl

    const venueId = searchParams.get('venueId')
    const status = searchParams.get('status') || 'OPEN' // OPEN / ACKNOWLEDGED / RESOLVED
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action')

    if (!venueId) {
      return NextResponse.json(
        { error: '缺少必要參數: venueId' },
        { status: 400 },
      )
    }

    // 特殊動作：取得 Watchdog 摘要
    if (action === 'summary') {
      const summary = await getWatchdogSummary(venueId)
      return NextResponse.json({ success: true, data: summary }, { status: 200 })
    }

    // 特殊動作：執行 Watchdog 檢測
    if (action === 'check') {
      const results = await runWatchdogCheck()
      return NextResponse.json({ success: true, data: results }, { status: 200 })
    }

    // 查詢告警列表
    const alerts = await prisma.watchdogAlert.findMany({
      where: {
        venueId,
        status: status as any,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json(
      {
        success: true,
        data: alerts.map((a) => ({
          id: a.id,
          alertType: a.alertType,
          severity: a.severity,
          title: a.title,
          description: a.description,
          status: a.status,
          detectionCount: a.detectionCount,
          createdAt: a.createdAt.toISOString(),
          acknowledgedAt: a.acknowledgedAt?.toISOString(),
          resolvedAt: a.resolvedAt?.toISOString(),
        })),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[API] Watchdog 查詢失敗:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const ctx = await pagePermission('monitor')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { alertId, action, note } = body

    if (!alertId || !action) {
      return NextResponse.json(
        { error: '缺少必要參數: alertId, action' },
        { status: 400 },
      )
    }

    if (action === 'acknowledge') {
      // 確認告警
      const alert = await acknowledgeAlert(alertId, ctx.username, note)

      return NextResponse.json(
        {
          success: true,
          message: '告警已確認',
          data: {
            id: alert.id,
            status: alert.status,
            acknowledgedAt: alert.acknowledgedAt?.toISOString(),
          },
        },
        { status: 200 },
      )
    } else if (action === 'resolve') {
      // 解決告警
      const alert = await resolveAlert(alertId, ctx.username, note)

      return NextResponse.json(
        {
          success: true,
          message: '告警已解決',
          data: {
            id: alert.id,
            status: alert.status,
            resolvedAt: alert.resolvedAt?.toISOString(),
          },
        },
        { status: 200 },
      )
    } else {
      return NextResponse.json(
        { error: '未知的動作' },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error('[API] Watchdog 操作失敗:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      },
      { status: 500 },
    )
  }
}
