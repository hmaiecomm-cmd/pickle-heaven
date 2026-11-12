/**
 * Watchdog 監控系統
 *
 * 監測項目：
 * 1. MQTT Broker 連接狀態
 * 2. RS-485 序列埠健康狀況
 * 3. 命令執行延遲
 * 4. 設備回報超時
 * 5. 狀態不一致
 * 6. 本地持久化隊列深度
 *
 * 告警等級：HEALTHY → DEGRADED → OFFLINE → ERROR
 */

import { logger } from './logger.js'
import { mqttClient } from './mqtt-client.js'
import { rs485Adapter } from './rs485-adapter.js'
import { getConfig } from './config.js'
import { differenceInSeconds } from 'date-fns'

export type WatchdogStatus = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'ERROR'

export interface HealthMetrics {
  status: WatchdogStatus
  timestamp: Date
  checks: {
    mqttConnected: boolean
    mqttLastHeartbeatAgeSeconds: number
    rs485Connected: boolean
    rs485LastHeartbeatAgeSeconds: number
    lastCommandExecutedAgeSeconds: number
    failedCommandCount: number
    statusMismatchCount: number
    persistenceQueueLength: number
  }
  details: string[]
  recommendations: string[]
}

export class Watchdog {
  private metrics: HealthMetrics | null = null
  private commandExecutionTimes: Map<string, Date> = new Map()
  private failedCommands: string[] = []
  private statusMismatches: number = 0
  private lastHealthCheck: Date = new Date()
  private checkInterval: NodeJS.Timeout | null = null

  /**
   * 啟動定期健康檢查
   */
  start(intervalSeconds: number = 60): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    logger.info('Watchdog 已啟動', {
      module: 'Watchdog',
      intervalSeconds,
    })

    this.checkInterval = setInterval(() => {
      this.performHealthCheck().catch((error) => {
        logger.error('健康檢查異常', error as Error, { module: 'Watchdog' })
      })
    }, intervalSeconds * 1000)

    // 立即執行一次檢查
    this.performHealthCheck().catch((error) => {
      logger.error('初始健康檢查異常', error as Error, { module: 'Watchdog' })
    })
  }

  /**
   * 停止監控
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      logger.info('Watchdog 已停止', { module: 'Watchdog' })
    }
  }

  /**
   * 執行健康檢查
   */
  async performHealthCheck(): Promise<HealthMetrics> {
    const config = getConfig()
    const now = new Date()
    const details: string[] = []
    const recommendations: string[] = []
    let statusScore = 100 // 滿分 100

    // ─────────────────────────────────────────
    // 1. MQTT 連接狀態
    // ─────────────────────────────────────────

    const mqttConnected = mqttClient.getStatus() === 'CONNECTED'
    const mqttLastHeartbeat = mqttClient.getLastHeartbeat()
    const mqttAgeSeconds = differenceInSeconds(now, mqttLastHeartbeat)

    if (!mqttConnected) {
      details.push('❌ MQTT Broker 未連接')
      statusScore -= 40
      recommendations.push('檢查 Broker 狀態與網路連接')
    } else if (mqttAgeSeconds > 120) {
      // 超過 2 分鐘無心跳
      details.push(`⚠️ MQTT 心跳落後 ${mqttAgeSeconds} 秒`)
      statusScore -= 20
      recommendations.push('重新連接 MQTT Broker')
    } else {
      details.push('✓ MQTT Broker 正常')
    }

    // ─────────────────────────────────────────
    // 2. RS-485 連接狀態
    // ─────────────────────────────────────────

    const rs485Connected = rs485Adapter.isReady()
    const rs485LastHeartbeat = rs485Adapter.getLastHeartbeat()
    const rs485AgeSeconds = differenceInSeconds(now, rs485LastHeartbeat)

    if (!rs485Connected) {
      details.push('❌ RS-485 序列埠未連接')
      statusScore -= 40
      recommendations.push(`檢查 ${config.rs485.port} 序列埠連接`)
    } else if (rs485AgeSeconds > 180) {
      // 超過 3 分鐘無動作
      details.push(`⚠️ RS-485 無動作 ${rs485AgeSeconds} 秒`)
      statusScore -= 15
      recommendations.push('檢查設備連接與電源')
    } else {
      details.push('✓ RS-485 序列埠正常')
    }

    // ─────────────────────────────────────────
    // 3. 命令執行延遲
    // ─────────────────────────────────────────

    let lastCommandAgeSeconds = 999
    if (this.commandExecutionTimes.size > 0) {
      const times = Array.from(this.commandExecutionTimes.values())
      const lastTime = times[times.length - 1]
      lastCommandAgeSeconds = differenceInSeconds(now, lastTime)

      if (lastCommandAgeSeconds > 300) {
        details.push(`⚠️ 最後命令執行 ${lastCommandAgeSeconds} 秒前`)
        statusScore -= 10
      } else {
        details.push(`✓ 命令執行正常（${lastCommandAgeSeconds}s 前）`)
      }
    }

    // ─────────────────────────────────────────
    // 4. 失敗命令計數
    // ─────────────────────────────────────────

    const failedCount = this.failedCommands.length
    if (failedCount > 5) {
      details.push(`❌ 過去 5 分鐘失敗命令 ${failedCount} 次`)
      statusScore -= 25
      recommendations.push('檢查設備狀態與日誌')
    } else if (failedCount > 0) {
      details.push(`⚠️ 最近有 ${failedCount} 個失敗命令`)
      statusScore -= 10
    } else {
      details.push('✓ 無失敗命令')
    }

    // ─────────────────────────────────────────
    // 5. 狀態不一致
    // ─────────────────────────────────────────

    if (this.statusMismatches > 3) {
      details.push(`❌ 狀態不一致 ${this.statusMismatches} 次`)
      statusScore -= 20
      recommendations.push('檢查 Relay 狀態與期望值是否一致')
    } else if (this.statusMismatches > 0) {
      details.push(`⚠️ 狀態不一致 ${this.statusMismatches} 次`)
      statusScore -= 5
    } else {
      details.push('✓ 狀態一致')
    }

    // ─────────────────────────────────────────
    // 6. 本地持久化隊列
    // ─────────────────────────────────────────

    // TODO: 從 PersistenceQueue 取得隊列深度
    const queueLength = 0

    if (queueLength > 1000) {
      details.push(`⚠️ 本地隊列深度 ${queueLength}（可能離線）`)
      statusScore -= 15
      recommendations.push('檢查網路連接，待隊列自動同步')
    }

    // ─────────────────────────────────────────
    // 決定整體狀態
    // ─────────────────────────────────────────

    let overallStatus: WatchdogStatus = 'HEALTHY'

    if (statusScore <= 0) {
      overallStatus = 'ERROR'
    } else if (statusScore < 40) {
      overallStatus = 'OFFLINE'
    } else if (statusScore < 70) {
      overallStatus = 'DEGRADED'
    }

    // 日誌記錄
    logger.logHealthCheck(overallStatus, {
      module: 'Watchdog',
      statusScore,
      mqttConnected,
      rs485Connected,
      failedCommands: failedCount,
      statusMismatches: this.statusMismatches,
    })

    // ─────────────────────────────────────────
    // 構建指標物件
    // ─────────────────────────────────────────

    this.metrics = {
      status: overallStatus,
      timestamp: now,
      checks: {
        mqttConnected,
        mqttLastHeartbeatAgeSeconds: mqttAgeSeconds,
        rs485Connected,
        rs485LastHeartbeatAgeSeconds: rs485AgeSeconds,
        lastCommandExecutedAgeSeconds: lastCommandAgeSeconds,
        failedCommandCount: failedCount,
        statusMismatchCount: this.statusMismatches,
        persistenceQueueLength: queueLength,
      },
      details,
      recommendations,
    }

    this.lastHealthCheck = now

    return this.metrics
  }

  /**
   * 記錄命令執行
   */
  recordCommandExecution(commandId: string): void {
    this.commandExecutionTimes.set(commandId, new Date())

    // 清理舊記錄（5 分鐘以前）
    const cutoffTime = new Date(Date.now() - 300000)
    for (const [id, time] of this.commandExecutionTimes) {
      if (time < cutoffTime) {
        this.commandExecutionTimes.delete(id)
      }
    }
  }

  /**
   * 記錄命令失敗
   */
  recordCommandFailure(commandId: string): void {
    this.failedCommands.push(commandId)

    // 保持列表大小
    if (this.failedCommands.length > 50) {
      this.failedCommands = this.failedCommands.slice(-50)
    }

    logger.warn('命令失敗已記錄', {
      module: 'Watchdog',
      commandId,
      totalFailures: this.failedCommands.length,
    })
  }

  /**
   * 記錄狀態不一致
   */
  recordStatusMismatch(): void {
    this.statusMismatches++
    logger.warn('狀態不一致已記錄', {
      module: 'Watchdog',
      totalMismatches: this.statusMismatches,
    })
  }

  /**
   * 取得最後一次健康檢查結果
   */
  getLastMetrics(): HealthMetrics | null {
    return this.metrics
  }

  /**
   * 發佈健康狀態到 MQTT
   */
  async publishHealthStatus(): Promise<void> {
    const metrics = await this.performHealthCheck()
    const config = getConfig()

    const topic = `${config.siteId}/gateway/health`
    const payload = {
      status: metrics.status,
      timestamp: metrics.timestamp.toISOString(),
      statusScore: this.calculateStatusScore(metrics),
      checks: metrics.checks,
      details: metrics.details,
      recommendations: metrics.recommendations.slice(0, 3), // 只發送前 3 條建議
    }

    try {
      await mqttClient.publishStatus(
        'gateway',
        metrics.status === 'HEALTHY' ? 'OK' : 'WARN',
        metrics.timestamp.toISOString(),
        payload
      )
    } catch (error) {
      logger.error('健康狀態發佈失敗', error as Error, { module: 'Watchdog' })
    }
  }

  /**
   * 計算狀態分數（0-100）
   */
  private calculateStatusScore(metrics: HealthMetrics): number {
    let score = 100

    if (!metrics.checks.mqttConnected) score -= 40
    else if (metrics.checks.mqttLastHeartbeatAgeSeconds > 120) score -= 20

    if (!metrics.checks.rs485Connected) score -= 40
    else if (metrics.checks.rs485LastHeartbeatAgeSeconds > 180) score -= 15

    if (metrics.checks.failedCommandCount > 5) score -= 25
    else if (metrics.checks.failedCommandCount > 0) score -= 10

    if (metrics.checks.statusMismatchCount > 3) score -= 20
    else if (metrics.checks.statusMismatchCount > 0) score -= 5

    return Math.max(0, score)
  }

  /**
   * 清除統計（重置）
   */
  reset(): void {
    this.commandExecutionTimes.clear()
    this.failedCommands = []
    this.statusMismatches = 0
    logger.info('Watchdog 統計已重置', { module: 'Watchdog' })
  }
}

export const watchdog = new Watchdog()
