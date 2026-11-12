/**
 * Remote Control Watchdog API
 *
 * 端點：
 * - GET /api/remote-control/watchdog?action=check — 執行 Watchdog 檢測
 * - GET /api/remote-control/watchdog?action=summary — 取得摘要
 * - POST /api/remote-control/watchdog — 手動重連
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  runRemoteControlWatchdog,
  getRemoteControlWatchdogSummary,
  triggerManualReconnect,
  markDeviceOffline,
  markDeviceOnline,
} from '@/server/remote-control-watchdog'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const deviceId = searchParams.get('deviceId')
    const clientId = searchParams.get('clientId')

    // 執行 Watchdog 檢測
    if (action === 'check') {
      const results = await runRemoteControlWatchdog()
      return NextResponse.json({
        success: true,
        message: 'Watchdog 檢測完成',
        data: results,
      })
    }

    // 取得摘要
    if (action === 'summary') {
      const summary = await getRemoteControlWatchdogSummary()
      return NextResponse.json({
        success: true,
        message: 'Remote Control 監控摘要',
        data: summary,
      })
    }

    // 未知的 action
    return NextResponse.json(
      {
        success: false,
        error: '未知的操作',
      },
      { status: 400 },
    )
  } catch (error) {
    console.error('[RemoteControl-API] GET 錯誤:', error)
    return NextResponse.json(
      {
        success: false,
        error: `錯誤: ${error}`,
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, deviceId, clientId, reason } = body

    // 手動重連
    if (action === 'reconnect') {
      if (!deviceId || !clientId) {
        return NextResponse.json(
          {
            success: false,
            error: '缺少必要參數: deviceId, clientId',
          },
          { status: 400 },
        )
      }

      const success = await triggerManualReconnect(deviceId, clientId)
      return NextResponse.json({
        success,
        message: success ? '重連已啟動' : '重連啟動失敗',
        deviceId,
      })
    }

    // 標記為離線
    if (action === 'offline') {
      if (!deviceId) {
        return NextResponse.json(
          {
            success: false,
            error: '缺少必要參數: deviceId',
          },
          { status: 400 },
        )
      }

      await markDeviceOffline(deviceId, reason)
      return NextResponse.json({
        success: true,
        message: '設備已標記為離線',
        deviceId,
      })
    }

    // 標記為在線
    if (action === 'online') {
      if (!deviceId || !clientId) {
        return NextResponse.json(
          {
            success: false,
            error: '缺少必要參數: deviceId, clientId',
          },
          { status: 400 },
        )
      }

      await markDeviceOnline(deviceId, clientId)
      return NextResponse.json({
        success: true,
        message: '設備已標記為在線',
        deviceId,
      })
    }

    // 未知的 action
    return NextResponse.json(
      {
        success: false,
        error: '未知的操作',
      },
      { status: 400 },
    )
  } catch (error) {
    console.error('[RemoteControl-API] POST 錯誤:', error)
    return NextResponse.json(
      {
        success: false,
        error: `錯誤: ${error}`,
      },
      { status: 500 },
    )
  }
}
