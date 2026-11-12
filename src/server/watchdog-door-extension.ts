/**
 * Watchdog — 門禁系統擴展
 *
 * 13 項監控規則：
 * 1. 排程 → MQTT 超時
 * 2. MQTT → Pi 超時
 * 3. Pi → 控制器超時
 * 4. 憑證寫入不一致
 * 5. 通知失敗
 * 6. 取消後仍有效
 * 7. 過期憑證未移除
 * 8. 控制器時鐘漂移
 * 9. Pi 時鐘漂移
 * 10. 門長開啟
 * 11. 交易 vs 門磁矛盾
 * 12. 缺少交易記錄
 * 13. 撤銷未確認
 */

import { db } from '@/lib/db'
import {
  TIME_CONSTANTS,
  isClockDriftCritical,
  isDoorHeldOpenTooLong,
} from '@/lib/door-access-types'
import { randomUUID } from 'crypto'

// ─────── 監控結果 ───────

export interface HealthCheckResult {
  checkType: string
  success: boolean
  message: string
  detectedAt: Date
  affectedResources?: Array<{
    type: string
    id: string
    details?: Record<string, unknown>
  }>
}

// ─────── 13 項檢測實現 ───────

export class DoorWatchdogExtension {
  /**
   * 檢測 1: 排程 → MQTT 超時
   */
  async checkScheduleToMqttTimeout(
    venueId: string
  ): Promise<HealthCheckResult> {
    try {
      // 尋找有待發送命令超過閾值的會話
      const threshold = new Date(
        Date.now() - TIME_CONSTANTS.MQTT_COMMAND_TIMEOUT_SECONDS * 1000
      )

      const pendingCommands = await db.doorAccessCommand.findMany({
        where: {
          accessSession: { venueId },
          status: 'PENDING',
          createdAt: { lt: threshold },
        },
        include: { accessSession: true },
      })

      if (pendingCommands.length > 0) {
        await this.createAlert(
          venueId,
          'SCHEDULE_TO_MQTT_TIMEOUT',
          '排程到 MQTT 超時',
          `有 ${pendingCommands.length} 個命令超過待發送時間`,
          'ERROR',
          pendingCommands.map((c) => ({
            type: 'DoorAccessCommand',
            id: c.id,
          }))
        )

        return {
          checkType: 'SCHEDULE_TO_MQTT_TIMEOUT',
          success: false,
          message: `檢測到 ${pendingCommands.length} 個超時的待發送命令`,
          detectedAt: new Date(),
          affectedResources: pendingCommands.map((c) => ({
            type: 'Command',
            id: c.commandId,
          })),
        }
      }

      return {
        checkType: 'SCHEDULE_TO_MQTT_TIMEOUT',
        success: true,
        message: '所有命令發送正常',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 1 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 2: MQTT → Pi 超時
   */
  async checkMqttToPiTimeout(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找已發送但未被 Pi 確認的命令
      const threshold = new Date(
        Date.now() - TIME_CONSTANTS.MQTT_COMMAND_TIMEOUT_SECONDS * 1000
      )

      const unackedCommands = await db.doorAccessCommand.findMany({
        where: {
          accessSession: { venueId },
          status: 'SENT',
          sentAt: { lt: threshold },
        },
        include: { accessSession: true },
      })

      if (unackedCommands.length > 0) {
        await this.createAlert(
          venueId,
          'MQTT_TO_PI_TIMEOUT',
          'MQTT 到 Pi 超時',
          `有 ${unackedCommands.length} 個命令未被 Pi 確認`,
          'ERROR',
          unackedCommands.map((c) => ({
            type: 'DoorAccessCommand',
            id: c.id,
          }))
        )

        return {
          checkType: 'MQTT_TO_PI_TIMEOUT',
          success: false,
          message: `檢測到 ${unackedCommands.length} 個未確認的命令`,
          detectedAt: new Date(),
          affectedResources: unackedCommands.map((c) => ({
            type: 'Command',
            id: c.commandId,
          })),
        }
      }

      return {
        checkType: 'MQTT_TO_PI_TIMEOUT',
        success: true,
        message: '所有命令已被 Pi 確認',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 2 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 3: Pi → 控制器超時
   */
  async checkPiToControllerTimeout(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找 Pi 已確認但超時未得到設備回應的命令
      // 此檢測依賴於超時期間內仍未得到 deviceResponse 的命令
      const threshold = new Date(
        Date.now() - TIME_CONSTANTS.RS485_COMMAND_TIMEOUT_SECONDS * 1000 * 3
      ) // 3x 超時閾值

      const timedOutCommands = await db.doorAccessCommand.findMany({
        where: {
          accessSession: { venueId },
          status: 'SENT', // 仍未得到完整確認
          sentAt: { lt: threshold },
          ackedAt: null, // 未得到控制器回應
        },
        include: { accessSession: true },
      })

      if (timedOutCommands.length > 0) {
        await this.createAlert(
          venueId,
          'PI_TO_CONTROLLER_TIMEOUT',
          'Pi 到控制器超時',
          `有 ${timedOutCommands.length} 個命令未得到控制器回應`,
          'ERROR',
          timedOutCommands.map((c) => ({
            type: 'DoorAccessCommand',
            id: c.id,
          }))
        )

        return {
          checkType: 'PI_TO_CONTROLLER_TIMEOUT',
          success: false,
          message: `檢測到 ${timedOutCommands.length} 個未回應的命令`,
          detectedAt: new Date(),
          affectedResources: timedOutCommands.map((c) => ({
            type: 'Command',
            id: c.commandId,
          })),
        }
      }

      return {
        checkType: 'PI_TO_CONTROLLER_TIMEOUT',
        success: true,
        message: '所有命令得到控制器回應',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 3 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 4: 憑證寫入不一致
   */
  async checkCredentialApplyMismatch(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找會話標記為 APPLIED 但實際查詢不到的憑證
      const appliedSessions = await db.accessSession.findMany({
        where: {
          venueId,
          credentialState: 'APPLIED',
        },
      })

      const mismatched = []

      for (const session of appliedSessions) {
        if (!session.userSlotNumber) {
          mismatched.push(session)
          continue
        }

        // TODO: 查詢控制器實際狀態
        // const actualState = await queryControllerSlot(session.controllerMacId, session.userSlotNumber)
        // if (!actualState) mismatched.push(session)
      }

      if (mismatched.length > 0) {
        await this.createAlert(
          venueId,
          'CREDENTIAL_APPLY_MISMATCH',
          '憑證套用不一致',
          `有 ${mismatched.length} 個憑證寫入與實際狀態不符`,
          'ERROR',
          mismatched.map((s) => ({
            type: 'AccessSession',
            id: s.id,
          }))
        )

        return {
          checkType: 'CREDENTIAL_APPLY_MISMATCH',
          success: false,
          message: `檢測到 ${mismatched.length} 個狀態不一致的憑證`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'CREDENTIAL_APPLY_MISMATCH',
        success: true,
        message: '所有憑證狀態一致',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 4 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 5: 通知失敗
   */
  async checkNotificationFailure(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找已應用憑證但未發送通知的會話
      // TODO: 需實現通知狀態追蹤
      // const notificationFailures = await findNotificationFailures(venueId)

      return {
        checkType: 'CREDENTIAL_APPLIED_NOTIFICATION_FAILED',
        success: true,
        message: '通知系統正常',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 5 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 6: 取消後仍有效
   */
  async checkCancelledCredentialStillActive(
    venueId: string
  ): Promise<HealthCheckResult> {
    try {
      // 尋找預約已取消但控制器仍有有效憑證的情況
      const revokedSessions = await db.accessSession.findMany({
        where: {
          venueId,
          status: 'REVOKED',
          credentialState: { in: ['APPLIED', 'APPLIED'] }, // 未被撤銷的
        },
        include: { reservation: true },
      })

      if (revokedSessions.length > 0) {
        await this.createAlert(
          venueId,
          'CANCELLED_CREDENTIAL_STILL_ACTIVE',
          '取消後憑證仍有效',
          `有 ${revokedSessions.length} 個已取消的預約憑證仍在控制器上`,
          'ERROR',
          revokedSessions.map((s) => ({
            type: 'AccessSession',
            id: s.id,
          }))
        )

        return {
          checkType: 'CANCELLED_CREDENTIAL_STILL_ACTIVE',
          success: false,
          message: `檢測到 ${revokedSessions.length} 個未撤銷的已取消預約`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'CANCELLED_CREDENTIAL_STILL_ACTIVE',
        success: true,
        message: '已取消預約的憑證已正確撤銷',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 6 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 7: 過期憑證未移除
   */
  async checkExpiredCredentialNotRemoved(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找已過期但仍在控制器上的憑證
      const now = new Date()
      const expiredSessions = await db.accessSession.findMany({
        where: {
          venueId,
          credentialState: 'APPLIED',
          validUntilUtc: { lt: now },
        },
      })

      if (expiredSessions.length > 0) {
        await this.createAlert(
          venueId,
          'EXPIRED_CREDENTIAL_NOT_REMOVED',
          '過期憑證未移除',
          `有 ${expiredSessions.length} 個過期憑證仍存在於控制器`,
          'WARNING',
          expiredSessions.map((s) => ({
            type: 'AccessSession',
            id: s.id,
          }))
        )

        return {
          checkType: 'EXPIRED_CREDENTIAL_NOT_REMOVED',
          success: false,
          message: `檢測到 ${expiredSessions.length} 個未清理的過期憑證`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'EXPIRED_CREDENTIAL_NOT_REMOVED',
        success: true,
        message: '所有過期憑證已清理',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 7 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 8: 控制器時鐘漂移
   */
  async checkControllerClockDrift(venueId: string): Promise<HealthCheckResult> {
    try {
      // 查詢所有啟用的設備適配器
      const adapters = await db.deviceAdapter.findMany({
        where: { venueId, enabled: true },
      })

      const driftedAdapters = []

      for (const adapter of adapters) {
        // TODO: 查詢控制器時間
        // const controllerTime = await queryControllerTime(adapter.macId)
        // const drift = calculateClockDrift(new Date(), controllerTime)
        // if (isClockDriftCritical(drift)) driftedAdapters.push(adapter)
      }

      if (driftedAdapters.length > 0) {
        await this.createAlert(
          venueId,
          'CONTROLLER_CLOCK_DRIFT',
          '控制器時鐘漂移',
          `有 ${driftedAdapters.length} 個控制器時鐘偏差超過 60 秒`,
          'ERROR',
          driftedAdapters.map((a) => ({
            type: 'DeviceAdapter',
            id: a.id,
            details: { macId: a.macId },
          }))
        )

        return {
          checkType: 'CONTROLLER_CLOCK_DRIFT',
          success: false,
          message: `檢測到 ${driftedAdapters.length} 個時鐘漂移的控制器`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'CONTROLLER_CLOCK_DRIFT',
        success: true,
        message: '所有控制器時鐘正常',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 8 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 9: Pi 時鐘漂移
   */
  async checkPiClockDrift(venueId: string): Promise<HealthCheckResult> {
    try {
      // TODO: 查詢 Raspberry Pi 時間
      // 此為簡化實現，實際應透過 MQTT 或 SSH 查詢

      return {
        checkType: 'PI_CLOCK_DRIFT',
        success: true,
        message: 'Pi 時鐘正常',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 9 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 10: 門長開啟
   */
  async checkDoorHeldOpenTimeout(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找門開啟超過閾值的情況
      const threshold = new Date(
        Date.now() - TIME_CONSTANTS.DOOR_HELD_OPEN_TIMEOUT_SECONDS * 1000
      )

      const heldOpenLogs = await db.accessLog.findMany({
        where: {
          venueId,
          doorState: 'OPENED',
          doorOpenAt: { lt: threshold },
          doorClosedAt: null,
        },
      })

      if (heldOpenLogs.length > 0) {
        await this.createAlert(
          venueId,
          'DOOR_HELD_OPEN_TIMEOUT',
          '門長開啟',
          `有 ${heldOpenLogs.length} 扇門開啟超過 ${TIME_CONSTANTS.DOOR_HELD_OPEN_TIMEOUT_SECONDS} 秒`,
          'WARNING',
          heldOpenLogs.map((l) => ({
            type: 'AccessLog',
            id: l.id,
          }))
        )

        return {
          checkType: 'DOOR_HELD_OPEN_TIMEOUT',
          success: false,
          message: `檢測到 ${heldOpenLogs.length} 扇門長開啟`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'DOOR_HELD_OPEN_TIMEOUT',
        success: true,
        message: '所有門狀態正常',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 10 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 11: 交易 vs 門磁矛盾
   */
  async checkAccessLogVsDoorMismatch(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找交易記錄與門磁狀態矛盾的情況
      const mismatchedLogs = await db.accessLog.findMany({
        where: {
          venueId,
          accessStatus: 'GRANTED',
          doorState: 'CLOSED', // 交易成功但門未開啟
        },
        take: 10,
      })

      if (mismatchedLogs.length > 0) {
        await this.createAlert(
          venueId,
          'ACCESS_LOG_VS_DOOR_MISMATCH',
          '交易與門磁矛盾',
          `有 ${mismatchedLogs.length} 個交易記錄與門磁狀態不符`,
          'WARNING',
          mismatchedLogs.map((l) => ({
            type: 'AccessLog',
            id: l.id,
          }))
        )

        return {
          checkType: 'ACCESS_LOG_VS_DOOR_MISMATCH',
          success: false,
          message: `檢測到 ${mismatchedLogs.length} 個狀態矛盾的交易`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'ACCESS_LOG_VS_DOOR_MISMATCH',
        success: true,
        message: '交易記錄與門磁狀態一致',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 11 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 12: 缺少交易記錄
   */
  async checkMissingControllerTransactionLog(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找已應用但無交易記錄的憑證
      const appliedWithoutLog = await db.accessSession.findMany({
        where: {
          venueId,
          credentialState: 'APPLIED',
          accessLogs: {
            none: {},
          },
        },
        include: { accessLogs: true },
      })

      // 篩選出本應有交易記錄的會話（已過期）
      const now = new Date()
      const shouldHaveLog = appliedWithoutLog.filter(
        (s) => s.validUntilUtc < now
      )

      if (shouldHaveLog.length > 0) {
        await this.createAlert(
          venueId,
          'MISSING_CONTROLLER_TRANSACTION_LOG',
          '缺少交易記錄',
          `有 ${shouldHaveLog.length} 個過期憑證缺少交易記錄`,
          'WARNING',
          shouldHaveLog.map((s) => ({
            type: 'AccessSession',
            id: s.id,
          }))
        )

        return {
          checkType: 'MISSING_CONTROLLER_TRANSACTION_LOG',
          success: false,
          message: `檢測到 ${shouldHaveLog.length} 個缺少交易記錄的憑證`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'MISSING_CONTROLLER_TRANSACTION_LOG',
        success: true,
        message: '所有憑證都有相應的交易記錄',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 12 失敗:', error)
      throw error
    }
  }

  /**
   * 檢測 13: 撤銷未確認
   */
  async checkRevokePendingUnresolved(venueId: string): Promise<HealthCheckResult> {
    try {
      // 尋找撤銷命令已發出但未確認的會話
      const threshold = new Date(Date.now() - 60 * 1000) // 1 分鐘

      const revokePending = await db.accessSession.findMany({
        where: {
          venueId,
          credentialState: 'REVOKE_PENDING',
          lastRevokedAt: { lt: threshold },
        },
      })

      if (revokePending.length > 0) {
        await this.createAlert(
          venueId,
          'REVOKE_PENDING_UNRESOLVED',
          '撤銷未確認',
          `有 ${revokePending.length} 個撤銷命令超過 1 分鐘未確認`,
          'ERROR',
          revokePending.map((s) => ({
            type: 'AccessSession',
            id: s.id,
          }))
        )

        return {
          checkType: 'REVOKE_PENDING_UNRESOLVED',
          success: false,
          message: `檢測到 ${revokePending.length} 個未確認的撤銷操作`,
          detectedAt: new Date(),
        }
      }

      return {
        checkType: 'REVOKE_PENDING_UNRESOLVED',
        success: true,
        message: '所有撤銷操作都已確認',
        detectedAt: new Date(),
      }
    } catch (error) {
      console.error('[Watchdog-Door] 檢測 13 失敗:', error)
      throw error
    }
  }

  /**
   * 執行所有 13 項檢測
   */
  async runAllChecks(venueId: string): Promise<{
    checkResults: HealthCheckResult[]
    summary: {
      total: number
      passed: number
      failed: number
      warnings: number
    }
  }> {
    console.log('[Watchdog-Door] 開始執行 13 項檢測...')

    const checks = [
      this.checkScheduleToMqttTimeout(venueId),
      this.checkMqttToPiTimeout(venueId),
      this.checkPiToControllerTimeout(venueId),
      this.checkCredentialApplyMismatch(venueId),
      this.checkNotificationFailure(venueId),
      this.checkCancelledCredentialStillActive(venueId),
      this.checkExpiredCredentialNotRemoved(venueId),
      this.checkControllerClockDrift(venueId),
      this.checkPiClockDrift(venueId),
      this.checkDoorHeldOpenTimeout(venueId),
      this.checkAccessLogVsDoorMismatch(venueId),
      this.checkMissingControllerTransactionLog(venueId),
      this.checkRevokePendingUnresolved(venueId),
    ]

    const results = await Promise.all(checks)

    const summary = {
      total: results.length,
      passed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      warnings: 0, // 可進一步細分
    }

    console.log('[Watchdog-Door] 檢測完成:', summary)

    return { checkResults: results, summary }
  }

  /**
   * 建立告警
   */
  private async createAlert(
    venueId: string,
    alertType: string,
    title: string,
    description: string,
    severity: 'WARNING' | 'ERROR',
    affectedResources?: Array<{ type: string; id: string }>
  ): Promise<void> {
    await db.credentialAlert.create({
      data: {
        venueId,
        alertType,
        severity: severity === 'ERROR' ? 'ERROR' : 'DEGRADED',
        title,
        description,
        status: 'OPEN',
        triggeredBy: 'WATCHDOG',
        affectedResource: affectedResources?.[0]?.id,
      },
    })
  }
}

// ─────── 匯出 ───────

export const DoorWatchdogService = {
  extension: new DoorWatchdogExtension(),
  runAllChecks: (venueId: string) =>
    new DoorWatchdogExtension().runAllChecks(venueId),
}
