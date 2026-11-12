/**
 * Cron API：Watchdog 定期監控
 *
 * 執行頻率：建議每 30 秒一次
 * Vercel Cron：cron: "*/0.5 * * * *" （每 30 秒）
 * 或每分鐘一次：cron: "* * * * *"
 */

import { NextRequest, NextResponse } from 'next/server'
import { runWatchdogCheck } from '@/server/watchdog-service'
import { syncPendingEventsToNeon } from '@/server/event-logger'

export const maxDuration = 60 // 最長執行時間 60 秒

export async function GET(req: NextRequest) {
  // 驗證 Cron secret
  const secret = req.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET 未設定' },
      { status: 500 },
    )
  }

  if (secret !== expectedSecret) {
    return NextResponse.json(
      { error: '無效的 Cron secret' },
      { status: 401 },
    )
  }

  try {
    console.log('[Cron] Watchdog 監控開始...')

    // 1. 執行 Watchdog 檢測
    const checkResults = await runWatchdogCheck()

    // 統計檢測結果
    const summary = {
      healthy: checkResults.filter((r) => r.status === 'HEALTHY').length,
      degraded: checkResults.filter((r) => r.status === 'DEGRADED').length,
      offline: checkResults.filter((r) => r.status === 'OFFLINE').length,
      error: checkResults.filter((r) => r.status === 'ERROR').length,
    }

    console.log('[Cron] Watchdog 檢測結果:', summary)

    // 2. 嘗試同步待同步的事件到 Neon（非同步）
    const syncedCount = await syncPendingEventsToNeon(100)

    return NextResponse.json(
      {
        success: true,
        message: 'Watchdog 監控完成',
        timestamp: new Date().toISOString(),
        checks: {
          total: checkResults.length,
          ...summary,
        },
        eventSync: {
          synced: syncedCount,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[Cron] Watchdog 監控失敗:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
