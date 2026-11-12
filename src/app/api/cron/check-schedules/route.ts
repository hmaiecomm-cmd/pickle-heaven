/**
 * Cron API 路由：每分鐘檢查排程狀態變化
 *
 * Vercel Cron 設定：
 *   cron: "* * * * *"  (每分鐘)
 *
 * 或手動測試：
 *   curl -X GET "http://localhost:3000/api/cron/check-schedules?secret=YOUR_CRON_SECRET"
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAndUpdateSchedules } from '@/server/scheduling-service'
import { checkMqttHeartbeat } from '@/server/mqtt-service'

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
    console.log('[Cron] 開始檢查排程狀態...')

    // 檢查並更新排程
    await checkAndUpdateSchedules()

    // 檢查 MQTT 心跳
    const mqttOk = await checkMqttHeartbeat()

    return NextResponse.json(
      {
        success: true,
        message: '排程檢查完成',
        timestamp: new Date().toISOString(),
        mqttStatus: mqttOk ? 'ONLINE' : 'OFFLINE',
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[Cron] 檢查排程失敗:', error)

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
