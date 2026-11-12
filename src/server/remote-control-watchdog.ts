/**
 * Remote Control Watchdog — 自動監控和恢復 Claude Code 與手機 Claude 的連線
 *
 * 功能：
 * 1. 監控 Remote Control 連線狀態
 * 2. 心跳檢測（每 15 秒）
 * 3. 自動重連機制（指數退避）
 * 4. 連線失敗告警
 * 5. Claude Code 重啟自動恢復
 * 6. 手機 Claude 斷訊自動恢復
 */

import 'server-only'
import { prisma } from '@/lib/db'
import { now, addSeconds, addMinutes } from '@/lib/time'
import { randomUUID } from 'crypto'

type RemoteControlStatus = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR'

interface RemoteControlHealthCheckResult {
  deviceId: string
  status: RemoteControlStatus
  message: string
  lastHeartbeat?: Date
  reconnectAttempts: number
  detailsJson?: Record<string, any>
}

/**
 * Remote Control 監控狀態追蹤
 */
const remoteControlState = new Map<
  string,
  {
    deviceId: string
    status: RemoteControlStatus
    lastHeartbeat: Date
    reconnectAttempts: number
    lastReconnectAttempt: Date
    nextRetryTime: Date
    alertId?: string
  }
>()

/**
 * 重連的指數退避設定
 */
const RECONNECT_CONFIG = {
  INITIAL_DELAY_SECONDS: 5,
  MAX_DELAY_SECONDS: 300, // 5 分鐘
  BACKOFF_MULTIPLIER: 1.5,
  MAX_ATTEMPTS: 10,
  HEARTBEAT_INTERVAL_SECONDS: 15,
  HEARTBEAT_TIMEOUT_SECONDS: 30,
}

/**
 * 定期 Remote Control Watchdog 檢測（應每 15 秒運行一次）
 */
export async function runRemoteControlWatchdog(): Promise<RemoteControlHealthCheckResult[]> {
  const results: RemoteControlHealthCheckResult[] = []

  // 從 prisma 查詢所有活躍的 Remote Control 會話
  // 假設有 remoteControlSession 或類似的表
  const remoteSessions = await getActiveRemoteControlSessions()

  for (const session of remoteSessions) {
    const result = await checkRemoteControlHealth(session.deviceId, session.clientId)
    results.push(result)

    // 根據結果更新狀態並執行恢復動作
    await processRemoteControlResult(result)
  }

  return results
}

/**
 * 檢查單個 Remote Control 設備的健康狀態
 */
async function checkRemoteControlHealth(
  deviceId: string,
  clientId: string,
): Promise<RemoteControlHealthCheckResult> {
  try {
    const storedState = remoteControlState.get(deviceId) || {
      deviceId,
      status: 'DISCONNECTED' as RemoteControlStatus,
      lastHeartbeat: new Date(0),
      reconnectAttempts: 0,
      lastReconnectAttempt: new Date(0),
      nextRetryTime: new Date(),
    }

    // 嘗試發送心跳
    const heartbeatSuccess = await sendHeartbeat(deviceId, clientId)

    if (heartbeatSuccess) {
      // 連線正常
      storedState.status = 'CONNECTED'
      storedState.lastHeartbeat = now()
      storedState.reconnectAttempts = 0

      // 如果之前有告警，標記為解決
      if (storedState.alertId) {
        await prisma.watchdogAlert.update({
          where: { id: storedState.alertId },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolveNote: '自動恢復連線',
          },
        })
        storedState.alertId = undefined
      }

      remoteControlState.set(deviceId, storedState)

      return {
        deviceId,
        status: 'CONNECTED',
        message: 'Remote Control 連線正常',
        lastHeartbeat: storedState.lastHeartbeat,
        reconnectAttempts: 0,
        detailsJson: {
          clientId,
          heartbeatTime: storedState.lastHeartbeat.toISOString(),
        },
      }
    } else {
      // 連線斷開 — 嘗試重連
      return await handleRemoteControlDisconnection(deviceId, clientId, storedState)
    }
  } catch (error) {
    console.error(`[RemoteControl-Watchdog] 檢測失敗 (${deviceId}):`, error)
    return {
      deviceId,
      status: 'ERROR',
      message: `Remote Control 檢測失敗: ${error}`,
      reconnectAttempts: 0,
    }
  }
}

/**
 * 處理 Remote Control 斷訊
 */
async function handleRemoteControlDisconnection(
  deviceId: string,
  clientId: string,
  storedState: any,
): Promise<RemoteControlHealthCheckResult> {
  const now_time = now()

  // 如果已超過最大重試次數，停止嘗試
  if (storedState.reconnectAttempts >= RECONNECT_CONFIG.MAX_ATTEMPTS) {
    storedState.status = 'ERROR'

    return {
      deviceId,
      status: 'ERROR',
      message: `Remote Control 已斷訊超過 ${RECONNECT_CONFIG.MAX_ATTEMPTS} 次嘗試，停止重連`,
      reconnectAttempts: storedState.reconnectAttempts,
      detailsJson: {
        clientId,
        maxAttemptsReached: true,
        lastHeartbeat: storedState.lastHeartbeat.toISOString(),
      },
    }
  }

  // 檢查是否可以進行下一次重試
  if (now_time < storedState.nextRetryTime) {
    return {
      deviceId,
      status: 'RECONNECTING',
      message: `等待重連... (下一次重試在 ${Math.ceil((storedState.nextRetryTime.getTime() - now_time.getTime()) / 1000)} 秒後)`,
      reconnectAttempts: storedState.reconnectAttempts,
      detailsJson: {
        clientId,
        nextRetryIn: Math.ceil((storedState.nextRetryTime.getTime() - now_time.getTime()) / 1000),
      },
    }
  }

  // 執行重連
  storedState.status = 'RECONNECTING'
  storedState.reconnectAttempts += 1
  storedState.lastReconnectAttempt = now_time

  // 計算下次重試時間（指數退避）
  const nextDelay = Math.min(
    RECONNECT_CONFIG.INITIAL_DELAY_SECONDS *
      Math.pow(RECONNECT_CONFIG.BACKOFF_MULTIPLIER, storedState.reconnectAttempts - 1),
    RECONNECT_CONFIG.MAX_DELAY_SECONDS,
  )
  storedState.nextRetryTime = addSeconds(now_time, Math.ceil(nextDelay))

  remoteControlState.set(deviceId, storedState)

  // 嘗試重連
  const reconnectSuccess = await attemptRemoteControlReconnect(deviceId, clientId)

  if (reconnectSuccess) {
    // 重連成功
    storedState.status = 'CONNECTED'
    storedState.lastHeartbeat = now_time
    storedState.reconnectAttempts = 0
    remoteControlState.set(deviceId, storedState)

    return {
      deviceId,
      status: 'CONNECTED',
      message: '重連成功',
      reconnectAttempts: 0,
    }
  }

  // 重連失敗，返回重連中狀態
  return {
    deviceId,
    status: 'RECONNECTING',
    message: `重連失敗 (第 ${storedState.reconnectAttempts} 次嘗試)，下一次重試在 ${Math.ceil(nextDelay)} 秒後`,
    reconnectAttempts: storedState.reconnectAttempts,
    detailsJson: {
      clientId,
      nextRetryIn: Math.ceil(nextDelay),
      attempt: storedState.reconnectAttempts,
    },
  }
}

/**
 * 發送心跳信號
 */
async function sendHeartbeat(deviceId: string, clientId: string): Promise<boolean> {
  try {
    // 模擬向 Remote Control 發送心跳
    // 實際應調用真實的 Remote Control API
    const response = await fetch(`http://localhost:3000/api/remote-control/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        clientId,
        timestamp: now().toISOString(),
      }),
      timeout: RECONNECT_CONFIG.HEARTBEAT_TIMEOUT_SECONDS * 1000,
    })

    return response.ok
  } catch (error) {
    console.warn(`[RemoteControl-Watchdog] 心跳失敗 (${deviceId}):`, error)
    return false
  }
}

/**
 * 嘗試重新連接
 */
async function attemptRemoteControlReconnect(deviceId: string, clientId: string): Promise<boolean> {
  try {
    // 向手機 Claude 發送重新連接信號
    const response = await fetch(`http://localhost:3000/api/remote-control/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        clientId,
        timestamp: now().toISOString(),
      }),
      timeout: 10000,
    })

    return response.ok
  } catch (error) {
    console.warn(`[RemoteControl-Watchdog] 重連嘗試失敗 (${deviceId}):`, error)
    return false
  }
}

/**
 * 根據檢測結果處理告警和恢復
 */
async function processRemoteControlResult(result: RemoteControlHealthCheckResult): Promise<void> {
  const storedState = remoteControlState.get(result.deviceId)

  if (!storedState) return

  // CONNECTED 狀態：確保沒有開啟的告警
  if (result.status === 'CONNECTED') {
    if (storedState.alertId) {
      await prisma.watchdogAlert.update({
        where: { id: storedState.alertId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
          resolveNote: '連線已恢復',
        },
      })
      storedState.alertId = undefined
    }
    remoteControlState.set(result.deviceId, storedState)
    return
  }

  // DISCONNECTED / RECONNECTING / ERROR 狀態：建立或更新告警
  if (result.status === 'DISCONNECTED' || result.status === 'RECONNECTING' || result.status === 'ERROR') {
    const severity = result.status === 'ERROR' ? 'ERROR' : 'DEGRADED'

    // 查找現有告警
    let alertId = storedState.alertId

    if (!alertId) {
      // 建立新告警
      const alert = await prisma.watchdogAlert.create({
        data: {
          alertType: 'REMOTE_CONTROL_DISCONNECTED',
          severity,
          title: `【${severity}】Remote Control 斷訊 - ${result.deviceId}`,
          description: result.message,
          detectionSource: 'REMOTE_CONTROL_WATCHDOG',
          detectionCount: 1,
          status: 'OPEN',
          detailsJson: result.detailsJson,
        },
      })
      alertId = alert.id
      storedState.alertId = alertId
    } else {
      // 更新現有告警
      await prisma.watchdogAlert.update({
        where: { id: alertId },
        data: {
          description: result.message,
          detectionCount: { increment: 1 },
          detailsJson: result.detailsJson,
        },
      })
    }

    remoteControlState.set(result.deviceId, storedState)
  }
}

/**
 * 取得活躍的 Remote Control 會話
 * 注意：此處使用 mock 實現，實際應根據您的數據庫架構調整
 */
async function getActiveRemoteControlSessions(): Promise<Array<{ deviceId: string; clientId: string }>> {
  try {
    // TODO: 根據您的實際 schema，查詢活躍的 Remote Control 會話
    // 範例：
    // const sessions = await prisma.remoteControlSession.findMany({
    //   where: { active: true, lastActivity: { gte: addMinutes(new Date(), -5) } }
    // })
    // return sessions.map(s => ({ deviceId: s.deviceId, clientId: s.clientId }))

    // 暫時返回空陣列，您需要根據實際情況實現
    return []
  } catch (error) {
    console.error('[RemoteControl-Watchdog] 查詢會話失敗:', error)
    return []
  }
}

/**
 * 手動觸發重連
 */
export async function triggerManualReconnect(deviceId: string, clientId: string): Promise<boolean> {
  const storedState = remoteControlState.get(deviceId)

  if (storedState) {
    // 重置重連狀態
    storedState.reconnectAttempts = 0
    storedState.nextRetryTime = now()
    storedState.status = 'RECONNECTING'
    remoteControlState.set(deviceId, storedState)
  }

  return await attemptRemoteControlReconnect(deviceId, clientId)
}

/**
 * 取得 Remote Control 監控摘要
 */
export async function getRemoteControlWatchdogSummary() {
  const allDevices = Array.from(remoteControlState.values())

  return {
    totalDevices: allDevices.length,
    connectedDevices: allDevices.filter((d) => d.status === 'CONNECTED').length,
    disconnectedDevices: allDevices.filter((d) => d.status === 'DISCONNECTED').length,
    reconnectingDevices: allDevices.filter((d) => d.status === 'RECONNECTING').length,
    errorDevices: allDevices.filter((d) => d.status === 'ERROR').length,
    devices: allDevices.map((d) => ({
      deviceId: d.deviceId,
      status: d.status,
      lastHeartbeat: d.lastHeartbeat.toISOString(),
      reconnectAttempts: d.reconnectAttempts,
    })),
  }
}

/**
 * 明確標記設備為離線（例如用戶手動關閉連線）
 */
export async function markDeviceOffline(deviceId: string, reason?: string): Promise<void> {
  const storedState = remoteControlState.get(deviceId)

  if (storedState) {
    storedState.status = 'DISCONNECTED'
    storedState.reconnectAttempts = 0
    storedState.nextRetryTime = now()
    remoteControlState.set(deviceId, storedState)
  }

  // 建立一條日誌
  console.log(`[RemoteControl-Watchdog] 設備標記為離線: ${deviceId} (原因: ${reason || '未指定'})`)
}

/**
 * 明確標記設備為在線（例如用戶手動連線）
 */
export async function markDeviceOnline(deviceId: string, clientId: string): Promise<void> {
  const storedState = remoteControlState.get(deviceId) || {
    deviceId,
    status: 'CONNECTED' as RemoteControlStatus,
    lastHeartbeat: now(),
    reconnectAttempts: 0,
    lastReconnectAttempt: new Date(0),
    nextRetryTime: now(),
  }

  storedState.status = 'CONNECTED'
  storedState.lastHeartbeat = now()
  storedState.reconnectAttempts = 0

  remoteControlState.set(deviceId, storedState)

  console.log(`[RemoteControl-Watchdog] 設備標記為在線: ${deviceId}`)
}
