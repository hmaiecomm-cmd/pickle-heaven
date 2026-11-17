/**
 * 門禁 Watchdog API — 健康檢測與監控
 *
 * 端點：
 * POST /api/door/watchdog/check — 執行所有 13 項檢測
 * GET  /api/door/watchdog/check/:checkType — 執行單項檢測
 * GET  /api/door/watchdog/alerts — 查詢告警歷史
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi, unauthorized } from '@/lib/admin-api'
import { prisma as db } from '@/lib/db'
import { DoorWatchdogService } from '@/server/watchdog-door-extension'

export const dynamic = 'force-dynamic'

/**
 * POST /api/door/watchdog/check
 * 執行所有 13 項檢測
 */
export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdminApi('venue.admin'))) return unauthorized()

    const body = await request.json().catch(() => ({}))
    const venueId = body.venueId

    if (!venueId) {
      return NextResponse.json(
        { error: '缺少 venueId' },
        { status: 400 }
      )
    }

    // 驗證場館存在
    const venue = await db.venue.findUnique({ where: { id: venueId } })
    if (!venue) {
      return NextResponse.json(
        { error: '場館不存在' },
        { status: 404 }
      )
    }

    console.log(`[Watchdog] 開始執行場館 ${venueId} 的健康檢測`)

    // 執行所有檢測
    const { checkResults, summary } = await DoorWatchdogService.runAllChecks(venueId)

    // 記錄檢測歷史
    await db.credentialAlert.create({
      data: {
        venueId,
        alertType: 'WATCHDOG_CHECK_RUN',
        severity: summary.failed > 0 ? 'ERROR' : 'CLEARED',
        title: `健康檢測完成 (${summary.passed}/${summary.total})`,
        description: `通過: ${summary.passed}, 失敗: ${summary.failed}`,
        status: 'CLOSED',
        triggeredBy: 'API',
      },
    })

    return NextResponse.json({
      success: true,
      venueId,
      runAt: new Date(),
      summary,
      checkResults: checkResults.map((r) => ({
        checkType: r.checkType,
        success: r.success,
        message: r.message,
        detectedAt: r.detectedAt,
        affectedResourceCount: r.affectedResources?.length ?? 0,
      })),
    })
  } catch (error) {
    console.error('[Watchdog] API 錯誤:', error)
    return NextResponse.json(
      { error: '檢測執行失敗' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/door/watchdog/alerts
 * 查詢告警歷史（門禁相關）
 */
export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdminApi('venue.admin'))) return unauthorized()

    const url = new URL(request.url)
    const venueId = url.searchParams.get('venueId')
    const limit = parseInt(url.searchParams.get('limit') ?? '20')
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    if (!venueId) {
      return NextResponse.json(
        { error: '缺少 venueId' },
        { status: 400 }
      )
    }

    const alerts = await db.credentialAlert.findMany({
      where: {
        venueId,
        alertType: {
          in: [
            'SCHEDULE_TO_MQTT_TIMEOUT',
            'MQTT_TO_PI_TIMEOUT',
            'PI_TO_CONTROLLER_TIMEOUT',
            'CREDENTIAL_APPLY_MISMATCH',
            'CANCELLED_CREDENTIAL_STILL_ACTIVE',
            'EXPIRED_CREDENTIAL_NOT_REMOVED',
            'CONTROLLER_CLOCK_DRIFT',
            'PI_CLOCK_DRIFT',
            'DOOR_HELD_OPEN_TIMEOUT',
            'ACCESS_LOG_VS_DOOR_MISMATCH',
            'MISSING_CONTROLLER_TRANSACTION_LOG',
            'REVOKE_PENDING_UNRESOLVED',
            'WATCHDOG_CHECK_RUN',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })

    const total = await db.credentialAlert.count({
      where: {
        venueId,
        alertType: {
          in: [
            'SCHEDULE_TO_MQTT_TIMEOUT',
            'MQTT_TO_PI_TIMEOUT',
            'PI_TO_CONTROLLER_TIMEOUT',
            'CREDENTIAL_APPLY_MISMATCH',
            'CANCELLED_CREDENTIAL_STILL_ACTIVE',
            'EXPIRED_CREDENTIAL_NOT_REMOVED',
            'CONTROLLER_CLOCK_DRIFT',
            'PI_CLOCK_DRIFT',
            'DOOR_HELD_OPEN_TIMEOUT',
            'ACCESS_LOG_VS_DOOR_MISMATCH',
            'MISSING_CONTROLLER_TRANSACTION_LOG',
            'REVOKE_PENDING_UNRESOLVED',
            'WATCHDOG_CHECK_RUN',
          ],
        },
      },
    })

    const summary = {
      total,
      openCount: alerts.filter((a) => a.status === 'OPEN').length,
      errorCount: alerts.filter((a) => a.severity === 'ERROR').length,
      warningCount: alerts.filter((a) => a.severity === 'DEGRADED').length,
    }

    return NextResponse.json({
      success: true,
      venueId,
      summary,
      alerts,
    })
  } catch (error) {
    console.error('[Watchdog] 查詢告警失敗:', error)
    return NextResponse.json(
      { error: '查詢失敗' },
      { status: 500 }
    )
  }
}
