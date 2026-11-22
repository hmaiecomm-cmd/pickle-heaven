/**
 * Cron API 路由：每分鐘檢查排程狀態變化
 *
 * Vercel Cron 設定：
 *   cron: "* * * * *"  (每分鐘)
 *
 * 驗證：Vercel Cron 會帶入 Authorization: Bearer $CRON_SECRET（與其他 cron 一致）
 * 手動測試：
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/check-schedules
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAndUpdateSchedules } from '@/server/scheduling-service'
import { checkMqttHeartbeat } from '@/server/mqtt-service'
import { iotGatewayConfig } from '@/server/iot/gateway-client'

export const maxDuration = 60 // 最長執行時間 60 秒

export async function GET(req: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET 未設定' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  try {
    console.log('[Cron] 開始檢查排程狀態...')

    // 檢查並更新排程
    await checkAndUpdateSchedules()

    // 檢查 MQTT 心跳
    // 已改用 IoT Gateway 時不再檢查舊的模擬 MQTT（避免每分鐘寫一筆 MQTT 斷線告警）
    const mqttOk = iotGatewayConfig() ? true : await checkMqttHeartbeat()

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
