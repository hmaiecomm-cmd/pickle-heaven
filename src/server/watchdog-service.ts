/**
 * Watchdog 監控服務 — 系統健康狀態監測
 *
 * 責務：
 * 1. 監測地端控制服務心跳
 * 2. 監測 MQTT Broker 連接狀態
 * 3. 監測 Relay 設備在線／離線
 * 4. 監測命令確認情況
 * 5. 監測排程執行狀態
 * 6. 監測日誌同步情況
 * 7. 生成告警事件
 */

import 'server-only'
import { prisma } from '@/lib/db'
import { now, addMinutes } from '@/lib/time'
import { randomUUID } from 'crypto'
import { sendWatchdogAlertEmail } from '@/server/email-service'

type WatchdogAlertSeverity = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'ERROR'

interface HealthCheckResult {
  component: string
  status: WatchdogAlertSeverity
  message: string
  lastUpdate?: Date
  detailsJson?: Record<string, any>
}

/**
 * 定期 Watchdog 檢測（應每 30 秒運行一次）
 */
export async function runWatchdogCheck(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  // 檢查所有活躍場館
  const venues = await prisma.venue.findMany({
    where: { active: true },
    include: {
      circuits: true,
      deviceAdapters: true,
      operatingHours: true,
    },
  })

  for (const venue of venues) {
    // 1. 檢查 MQTT 連接狀態
    results.push(await checkMqttStatus(venue.id, venue.name))

    // 2. 檢查設備連接狀態
    for (const adapter of venue.deviceAdapters) {
      results.push(await checkDeviceStatus(venue.id, adapter.id, adapter.name))
    }

    // 3. 檢查命令確認狀態
    results.push(await checkCommandAckStatus(venue.id))

    // 4. 檢查排程執行狀態
    results.push(await checkScheduleStatus(venue.id))

    // 5. 檢查日誌同步狀態
    results.push(await checkEventLogStatus(venue.id))
  }

  // 根據檢測結果生成或更新告警
  await processCheckResults(results)

  return results
}

/**
 * 檢查 MQTT Broker 狀態
 */
async function checkMqttStatus(venueId: string, venueName: string): Promise<HealthCheckResult> {
  try {
    // 簡單檢查：查看最近 1 小時內是否有 MQTT 相關事件
    const recentEvents = await prisma.controlEvent.findMany({
      where: {
        venueId,
        eventType: { in: ['MQTT_CONNECTED', 'MQTT_DISCONNECTED'] },
        createdAt: { gte: addMinutes(new Date(), -60) },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    const lastEvent = recentEvents[0]
    const isConnected = lastEvent?.eventType === 'MQTT_CONNECTED'

    return {
      component: `MQTT Broker - ${venueName}`,
      status: isConnected ? 'HEALTHY' : 'OFFLINE',
      message: isConnected ? 'MQTT Broker 已連接' : 'MQTT Broker 已斷線',
      lastUpdate: lastEvent?.createdAt,
      detailsJson: {
        lastEventType: lastEvent?.eventType,
        minutesAgo: lastEvent ? Math.round((now().getTime() - lastEvent.createdAt.getTime()) / 60000) : null,
      },
    }
  } catch (error) {
    return {
      component: `MQTT Broker - ${venueName}`,
      status: 'ERROR',
      message: `MQTT 狀態檢查失敗: ${error}`,
    }
  }
}

/**
 * 檢查設備（Relay）連接狀態
 */
async function checkDeviceStatus(
  venueId: string,
  adapterId: string,
  adapterName: string,
): Promise<HealthCheckResult> {
  try {
    const adapter = await prisma.deviceAdapter.findUnique({
      where: { id: adapterId },
    })

    if (!adapter) {
      return {
        component: `Device - ${adapterName}`,
        status: 'ERROR',
        message: '設備適配器找不到',
      }
    }

    // 檢查最近的設備事件
    const recentEvents = await prisma.controlEvent.findMany({
      where: {
        venueId,
        eventType: { in: ['DEVICE_ONLINE', 'DEVICE_OFFLINE'] },
        createdAt: { gte: addMinutes(new Date(), -60) },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })

    const lastEvent = recentEvents[0]
    const isOnline = lastEvent?.eventType === 'DEVICE_ONLINE'
    const minutesSinceLastReport = lastEvent
      ? Math.round((now().getTime() - lastEvent.createdAt.getTime()) / 60000)
      : null

    // 5 分鐘以上無心跳視為離線
    const isStale = minutesSinceLastReport && minutesSinceLastReport > 5

    return {
      component: `Device - ${adapter.name} (${adapter.macId})`,
      status: isStale ? 'OFFLINE' : isOnline ? 'HEALTHY' : 'OFFLINE',
      message: isStale
        ? `設備離線（${minutesSinceLastReport} 分鐘無回報）`
        : isOnline
          ? '設備在線'
          : '設備離線',
      lastUpdate: lastEvent?.createdAt,
      detailsJson: {
        macId: adapter.macId,
        lastEventType: lastEvent?.eventType,
        minutesSinceLastReport,
      },
    }
  } catch (error) {
    return {
      component: `Device - ${adapterName}`,
      status: 'ERROR',
      message: `設備狀態檢查失敗: ${error}`,
    }
  }
}

/**
 * 檢查命令確認狀態
 */
async function checkCommandAckStatus(venueId: string): Promise<HealthCheckResult> {
  try {
    // 查找 1 分鐘內有未確認的命令
    const unackedCommands = await prisma.controlCommand.findMany({
      where: {
        circuit: { venueId },
        status: 'SENT',
        sentAt: { gte: addMinutes(new Date(), -1) },
      },
    })

    const expiredCommands = await prisma.controlCommand.findMany({
      where: {
        circuit: { venueId },
        status: { in: ['SENT', 'PENDING'] },
        expiresAt: { lt: new Date() },
      },
    })

    const hasIssues = unackedCommands.length > 0 || expiredCommands.length > 0

    return {
      component: `Command Acknowledgement - ${venueId}`,
      status: hasIssues ? 'DEGRADED' : 'HEALTHY',
      message: hasIssues
        ? `有 ${unackedCommands.length} 個未確認命令, ${expiredCommands.length} 個已過期命令`
        : '所有命令確認正常',
      detailsJson: {
        unackedCount: unackedCommands.length,
        expiredCount: expiredCommands.length,
      },
    }
  } catch (error) {
    return {
      component: `Command Acknowledgement - ${venueId}`,
      status: 'ERROR',
      message: `命令狀態檢查失敗: ${error}`,
    }
  }
}

/**
 * 檢查排程執行狀態
 */
async function checkScheduleStatus(venueId: string): Promise<HealthCheckResult> {
  try {
    // 檢查最近 1 小時是否有排程執行事件
    const scheduleEvents = await prisma.controlEvent.findMany({
      where: {
        venueId,
        eventType: { in: ['SCHEDULE_EXECUTED', 'SCHEDULE_RECALCULATED'] },
        createdAt: { gte: addMinutes(new Date(), -60) },
      },
    })

    const hasRecentSchedules = scheduleEvents.length > 0

    return {
      component: `Schedule Execution - ${venueId}`,
      status: hasRecentSchedules ? 'HEALTHY' : 'DEGRADED',
      message: hasRecentSchedules
        ? `排程執行正常（最近 1 小時 ${scheduleEvents.length} 次事件）`
        : '排程執行可能延遲（最近 1 小時無執行事件）',
      detailsJson: {
        recentEventCount: scheduleEvents.length,
      },
    }
  } catch (error) {
    return {
      component: `Schedule Execution - ${venueId}`,
      status: 'ERROR',
      message: `排程狀態檢查失敗: ${error}`,
    }
  }
}

/**
 * 檢查事件日誌同步狀態
 */
async function checkEventLogStatus(venueId: string): Promise<HealthCheckResult> {
  try {
    // 檢查是否有未同步的日誌
    const unsyncedEvents = await prisma.controlEvent.findMany({
      where: {
        venueId,
        syncedToNeon: false,
        createdAt: { gte: addMinutes(new Date(), -5) }, // 5 分鐘內的未同步日誌
      },
    })

    const hasUnsyncedLogs = unsyncedEvents.length > 0

    return {
      component: `Event Log Sync - ${venueId}`,
      status: hasUnsyncedLogs ? 'DEGRADED' : 'HEALTHY',
      message: hasUnsyncedLogs
        ? `有 ${unsyncedEvents.length} 個日誌待同步（可能 Neon 暫時不可用）`
        : '所有日誌已同步',
      detailsJson: {
        unsyncedCount: unsyncedEvents.length,
      },
    }
  } catch (error) {
    return {
      component: `Event Log Sync - ${venueId}`,
      status: 'ERROR',
      message: `日誌同步狀態檢查失敗: ${error}`,
    }
  }
}

/**
 * 根據檢測結果生成或更新告警
 */
async function processCheckResults(results: HealthCheckResult[]): Promise<void> {
  for (const result of results) {
    // 跳過 HEALTHY 狀態（除非已有開啟的告警要關閉）
    if (result.status === 'HEALTHY') {
      // 查找相關的開啟告警並標記為 RESOLVED
      const componentMatch = result.component.split(' - ')[0]
      const openAlerts = await prisma.watchdogAlert.findMany({
        where: {
          title: { contains: componentMatch },
          status: 'OPEN',
        },
      })

      for (const alert of openAlerts) {
        await prisma.watchdogAlert.update({
          where: { id: alert.id },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolveNote: '自動恢復',
          },
        })

        // 發送恢復郵件通知
        await sendWatchdogAlertEmail({
          type: alert.alertType,
          severity: 'HEALTHY',
          title: `✅ 問題已解決: ${alert.title.replace(/【.*?】/, '')}`,
          description: '系統已恢復正常運行',
          component: componentMatch,
          timestamp: new Date(),
        }).catch((e) => console.error('[Watchdog] 郵件發送失敗:', e))
      }

      continue
    }

    // DEGRADED / OFFLINE / ERROR 狀態：建立或更新告警
    const existingAlert = await prisma.watchdogAlert.findFirst({
      where: {
        title: { contains: result.component.split(' - ')[0] },
        status: 'OPEN',
      },
    })

    if (existingAlert) {
      // 更新現有告警的檢測計數
      await prisma.watchdogAlert.update({
        where: { id: existingAlert.id },
        data: {
          detectionCount: existingAlert.detectionCount + 1,
          description: result.message,
        },
      })
    } else {
      // 建立新告警
      const venueId = result.component.includes(' - ')
        ? result.component.split(' - ')[1] || 'unknown'
        : 'unknown'

      const venue = await prisma.venue.findFirst({
        where: { name: { contains: venueId } },
      })

      if (venue) {
        const newAlert = await prisma.watchdogAlert.create({
          data: {
            venueId: venue.id,
            alertType: mapComponentToAlertType(result.component),
            severity: result.status,
            title: `【${result.status}】${result.component}`,
            description: result.message,
            detectionSource: 'WATCHDOG_CHECK',
            detectionCount: 1,
            status: 'OPEN',
          },
        })

        // 發送告警郵件通知
        await sendWatchdogAlertEmail({
          type: newAlert.alertType,
          severity: result.status,
          title: newAlert.title,
          description: result.message,
          component: result.component,
          timestamp: new Date(),
        }).catch((e) => console.error('[Watchdog] 郵件發送失敗:', e))
      }
    }
  }
}

/**
 * 將監控元件對應到告警類型
 */
function mapComponentToAlertType(component: string): string {
  if (component.includes('MQTT')) return 'MQTT_DOWN'
  if (component.includes('Device')) return 'RELAY_OFFLINE'
  if (component.includes('Command')) return 'COMMAND_TIMEOUT'
  if (component.includes('Schedule')) return 'SCHEDULE_FAILED'
  if (component.includes('Event Log')) return 'SYNC_FAILED'
  return 'SYSTEM_ERROR'
}

/**
 * 取得場館的 Watchdog 摘要
 */
export async function getWatchdogSummary(venueId: string) {
  const totalAlerts = await prisma.watchdogAlert.count({
    where: { venueId },
  })

  const openAlerts = await prisma.watchdogAlert.count({
    where: { venueId, status: 'OPEN' },
  })

  const recentAlerts = await prisma.watchdogAlert.findMany({
    where: { venueId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  const highestSeverity = recentAlerts[0]?.severity || 'HEALTHY'

  return {
    totalAlerts,
    openAlerts,
    highestSeverity,
    recentAlerts: recentAlerts.map((a) => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

/**
 * 手動關閉告警
 */
export async function acknowledgeAlert(alertId: string, acknowledgedBy: string, note?: string) {
  return await prisma.watchdogAlert.update({
    where: { id: alertId },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedBy,
      acknowledgedNote: note,
    },
  })
}

/**
 * 解決告警
 */
export async function resolveAlert(alertId: string, resolvedBy: string, note?: string) {
  return await prisma.watchdogAlert.update({
    where: { id: alertId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy,
      resolveNote: note,
    },
  })
}
