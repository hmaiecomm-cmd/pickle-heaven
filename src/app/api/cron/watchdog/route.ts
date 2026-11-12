/**
 * Cron API：Watchdog 定期監控
 *
 * 執行頻率：建議每 30 秒一次
 * Vercel Cron: '* * * * *' (每分鐘)
 * 或每 30 秒一次：使用 Vercel Edge Cron
 */

import { NextRequest, NextResponse } from 'next/server'
import { runWatchdogCheck } from '@/server/watchdog-service'
import { runRemoteControlWatchdog } from '@/server/remote-control-watchdog'
import { syncPendingEventsToNeon } from '@/server/event-logger'

export const maxDuration = 60 // 最長執行時間 60 秒

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET 未設定' },
      { status: 500 },
    )
  }

  if (req.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return NextResponse.json(
      { error: '無效的 Cron secret' },
      { status: 401 },
    )
  }

  try {
    console.log('[Cron] Watchdog 監控開始...')

    // 1. 執行系統 Watchdog 檢測
    const checkResults = await runWatchdogCheck()

    // 2. 執行 Remote Control Watchdog 檢測
    const remoteControlResults = await runRemoteControlWatchdog()

    // 統計系統 Watchdog 檢測結果
    const summary = {
      healthy: checkResults.filter((r) => r.status === 'HEALTHY').length,
      degraded: checkResults.filter((r) => r.status === 'DEGRADED').length,
      offline: checkResults.filter((r) => r.status === 'OFFLINE').length,
      error: checkResults.filter((r) => r.status === 'ERROR').length,
    }

    // 統計 Remote Control Watchdog 檢測結果
    const remoteControlSummary = {
      connected: remoteControlResults.filter((r) => r.status === 'CONNECTED').length,
      disconnected: remoteControlResults.filter((r) => r.status === 'DISCONNECTED').length,
      reconnecting: remoteControlResults.filter((r) => r.status === 'RECONNECTING').length,
      error: remoteControlResults.filter((r) => r.status === 'ERROR').length,
    }

    console.log('[Cron] 系統 Watchdog 檢測結果:', summary)
    console.log('[Cron] Remote Control Watchdog 檢測結果:', remoteControlSummary)

    // 3. 嘗試同步待同步的事件到 Neon（非同步）
    const syncedCount = await syncPendingEventsToNeon(100)

    return NextResponse.json(
      {
        success: true,
        message: 'Watchdog 監控完成',
        timestamp: new Date().toISOString(),
        systemWatchdog: {
          total: checkResults.length,
          ...summary,
        },
        remoteControlWatchdog: {
          total: remoteControlResults.length,
          ...remoteControlSummary,
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
