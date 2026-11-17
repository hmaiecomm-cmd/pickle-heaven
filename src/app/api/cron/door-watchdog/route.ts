/**
 * Cron Job — 門禁 Watchdog 定時檢測
 *
 * 配置在 vercel.json：
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/door-watchdog",
 *       "schedule": "每 6 小時執行一次"
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma as db } from '@/lib/db'
import { DoorWatchdogService } from '@/server/watchdog-door-extension'

// 驗證 Vercel Cron 請求
function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  // Vercel 的 Cron 請求會包含 'Bearer ...' token
  // 在生產環境中，應該驗證這個 token
  return authHeader?.startsWith('Bearer ') ?? false
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // 開發環境：允許所有請求；生產環境：只允許 Vercel Cron
  if (process.env.NODE_ENV === 'production' && !isValidCronRequest(request)) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }

  const startTime = Date.now()
  const results: Array<{ venueId: string; status: string; message: string; duration: number }> = []

  try {
    console.log('[Cron] 開始執行門禁 Watchdog 定時檢測')

    // 獲取所有活動的場館
    const venues = await db.venue.findMany({
      where: { active: true },
      select: { id: true, name: true },
    })

    console.log(`[Cron] 找到 ${venues.length} 個活動場館`)

    // 為每個場館執行檢測
    for (const venue of venues) {
      const venueStartTime = Date.now()

      try {
        const { summary, checkResults } = await DoorWatchdogService.runAllChecks(venue.id)

        const duration = Date.now() - venueStartTime
        const failedChecks = checkResults.filter((r) => !r.success).length

        results.push({
          venueId: venue.id,
          status: failedChecks > 0 ? 'PARTIAL_FAILURE' : 'SUCCESS',
          message: `${summary.passed}/${summary.total} 檢測通過${failedChecks > 0 ? `，${failedChecks} 項失敗` : ''}`,
          duration,
        })

        console.log(`[Cron] 場館 ${venue.name} (${venue.id}): ${results[results.length - 1].message} (${duration}ms)`)

        // 記錄定時檢測執行
        await db.credentialAlert.create({
          data: {
            venueId: venue.id,
            alertType: 'WATCHDOG_CRON_RUN',
            severity: failedChecks > 0 ? 'ERROR' : 'HEALTHY',
            title: `定時檢測 (${summary.passed}/${summary.total})`,
            description: `自動執行・通過: ${summary.passed}, 失敗: ${failedChecks}`,
            status: 'CLOSED',
            triggeredBy: 'CRON',
          },
        })
      } catch (error) {
        const duration = Date.now() - venueStartTime
        const errorMsg = error instanceof Error ? error.message : '未知錯誤'

        results.push({
          venueId: venue.id,
          status: 'ERROR',
          message: `執行失敗: ${errorMsg}`,
          duration,
        })

        console.error(`[Cron] 場館 ${venue.name} (${venue.id}) 檢測失敗:`, error)

        // 記錄錯誤
        await db.credentialAlert.create({
          data: {
            venueId: venue.id,
            alertType: 'WATCHDOG_CRON_FAILED',
            severity: 'ERROR',
            title: '定時檢測執行失敗',
            description: errorMsg,
            status: 'OPEN',
            triggeredBy: 'CRON',
          },
        })
      }
    }

    const totalDuration = Date.now() - startTime

    console.log(
      `[Cron] 定時檢測完成: ${results.length} 個場館，耗時 ${totalDuration}ms`
    )

    return NextResponse.json({
      success: true,
      timestamp: new Date(),
      executionTime: totalDuration,
      results,
      summary: {
        total: results.length,
        successful: results.filter((r) => r.status === 'SUCCESS').length,
        partial: results.filter((r) => r.status === 'PARTIAL_FAILURE').length,
        failed: results.filter((r) => r.status === 'ERROR').length,
      },
    })
  } catch (error) {
    console.error('[Cron] 定時檢測發生致命錯誤:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
        executionTime: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
