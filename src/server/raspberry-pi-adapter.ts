/**
 * Raspberry Pi 適配器
 *
 * 職責：
 * 1. 接收並驗證 MQTT 命令
 * 2. 透過 RS-485 與 AR-721 控制器通信
 * 3. 回報命令執行結果
 * 4. 查詢控制器狀態與交易日誌
 * 5. 校時同步
 * 6. 離線模式管理
 */

import { db } from '@/lib/db'
import {
  RS485Config,
  ControllerResponse,
  ControllerStatus,
  TIME_CONSTANTS,
  isVersionCompatible,
  calculateClockDrift,
} from '@/lib/door-access-types'
import { randomUUID } from 'crypto'

// ─────── RS-485 通信層 ───────

export class RS485Adapter {
  private config: RS485Config
  private portName: string
  private isOpen: boolean = false

  constructor(config: RS485Config) {
    this.config = config
    this.portName = config.portName
  }

  /**
   * 打開串列埠
   */
  async open(): Promise<void> {
    try {
      // TODO: 實現實際的串列埠打開邏輯
      // import { SerialPort } from 'serialport'
      // this.port = new SerialPort({
      //   path: this.portName,
      //   baudRate: this.config.baudRate,
      //   dataBits: this.config.dataBits,
      //   stopBits: this.config.stopBits,
      //   parity: this.config.parity,
      // })

      console.log(`[RS-485] 串列埠已打開: ${this.portName}`)
      this.isOpen = true
    } catch (error) {
      console.error('[RS-485] 打開串列埠失敗:', error)
      throw error
    }
  }

  /**
   * 關閉串列埠
   */
  async close(): Promise<void> {
    if (this.isOpen) {
      // TODO: 關閉實際串列埠
      console.log(`[RS-485] 串列埠已關閉: ${this.portName}`)
      this.isOpen = false
    }
  }

  /**
   * 發送命令到控制器（RS-485）
   */
  async sendCommand(
    payload: Buffer,
    timeout: number = this.config.timeout
  ): Promise<Buffer> {
    if (!this.isOpen) {
      throw new Error('串列埠未打開')
    }

    // TODO: 實現實際的 RS-485 傳輸
    // 包括：
    // 1. CRC/Checksum 校驗
    // 2. 寫入序列埠
    // 3. 等待回應（帶超時）
    // 4. 驗證回應的 checksum

    console.log('[RS-485] 命令已發送:', {
      stationId: this.config.stationId,
      payloadLength: payload.length,
    })

    // 模擬延遲
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 500)
    )

    // 模擬回應
    const response = Buffer.from([
      this.config.stationId,
      0x03, // 功能碼
      0x00, // 狀態 OK
    ])

    return response
  }

  /**
   * 驗證回應的校驗和
   */
  verifyChecksum(data: Buffer): boolean {
    if (data.length < 2) return false

    // TODO: 根據 config.checksumType 驗證 CRC 或 checksum
    // 通常最後 2-4 字節為校驗值
    return true
  }
}

// ─────── Raspberry Pi 命令處理 ───────

export class RaspberryPiAdapter {
  private rs485: RS485Adapter
  private commandQueue: Map<string, any> = new Map()
  private executedCommands: Set<string> = new Set()

  constructor(rs485Config: RS485Config) {
    this.rs485 = new RS485Adapter(rs485Config)
  }

  /**
   * 初始化適配器
   */
  async initialize(): Promise<void> {
    await this.rs485.open()
    console.log('[Pi] Raspberry Pi 適配器已初始化')
  }

  /**
   * 驗證命令的有效性與相容性
   */
  async validateCommandBeforeExecution(command: any): Promise<{
    valid: boolean
    reason?: string
  }> {
    // 1. 檢查重複命令
    if (this.executedCommands.has(command.commandId)) {
      return { valid: false, reason: '命令已執行過' }
    }

    // 2. 檢查命令過期
    if (new Date() > new Date(command.expiresAt)) {
      return { valid: false, reason: '命令已過期' }
    }

    // 3. 檢查預約版本
    const accessSession = await db.accessSession.findUnique({
      where: { id: command.accessSessionId },
      include: { reservation: { include: { booking: true } } },
    })

    if (!accessSession) {
      return { valid: false, reason: '門禁會話不存在' }
    }

    // 4. 版本檢查（命令版本 >= 當前版本）
    if (!isVersionCompatible(command.bookingVersion, accessSession.bookingVersion)) {
      return { valid: false, reason: '版本過舊，不再執行' }
    }

    // 5. 預約狀態檢查
    if (accessSession.status === 'REVOKED') {
      return { valid: false, reason: '預約已被撤銷' }
    }

    // 6. 序號檢查（若有前一次執行）
    // TODO: 實現序號單調遞增檢查
    // const lastSequence = await getLastCommandSequence(command.accessSessionId)
    // if (command.commandSequence <= lastSequence) {
    //   return { valid: false, reason: '序號不遞增' }
    // }

    return { valid: true }
  }

  /**
   * 配置憑證 (RS-485)
   */
  async configureCredentialViaRS485(
    command: any,
    controllerConfig: any
  ): Promise<ControllerResponse> {
    try {
      // 步驟 1: 驗證命令
      const validation = await this.validateCommandBeforeExecution(command)
      if (!validation.valid) {
        return {
          success: false,
          resultCode: 'VALIDATION_FAILED',
          resultMessage: validation.reason,
        }
      }

      // 步驟 2: 構建 RS-485 命令幀
      const userSlotNumber = await this.allocateUserSlot(
        command.accessSession.controllerMacId
      )

      if (!userSlotNumber) {
        return {
          success: false,
          resultCode: 'NO_AVAILABLE_SLOT',
          resultMessage: '控制器使用者位置已滿',
        }
      }

      // 步驟 3: 構建設定命令
      // 格式因控制器而異，此為示例
      const commandFrame = this.buildCredentialFrame(
        userSlotNumber,
        command,
        controllerConfig
      )

      // 步驟 4: 發送命令
      const response = await this.rs485.sendCommand(
        commandFrame,
        TIME_CONSTANTS.RS485_COMMAND_TIMEOUT_SECONDS * 1000
      )

      // 步驟 5: 解析回應
      const result = this.parseControllerResponse(response, userSlotNumber)

      // 步驟 6: 記錄執行歷史
      if (result.success) {
        this.executedCommands.add(command.commandId)
      }

      return result
    } catch (error) {
      console.error('[Pi] 配置憑證失敗:', error)
      return {
        success: false,
        resultCode: 'EXECUTION_ERROR',
        resultMessage: (error as Error).message,
      }
    }
  }

  /**
   * 分配使用者位置編號
   */
  private async allocateUserSlot(controllerMacId: string): Promise<number | null> {
    // TODO: 查詢控制器實際狀態，找到可用位置
    // 此為模擬實現
    const slot = Math.floor(Math.random() * 50) + 1
    return slot <= 45 ? slot : null // 模擬 50% 容量
  }

  /**
   * 構建 RS-485 命令幀
   * 格式因控制器而異
   */
  private buildCredentialFrame(
    userSlotNumber: number,
    command: any,
    controllerConfig: any
  ): Buffer {
    // 示例格式（SOYAL AR-721）:
    // [站號] [功能碼] [用戶位置] [PIN長度] [PIN值...] [有效期...] [CRC...]

    // TODO: 根據實際控制器協定構建

    const frame = Buffer.alloc(32)
    frame[0] = controllerConfig.rs485Config.stationId
    frame[1] = 0x10 // 寫入功能碼
    frame[2] = userSlotNumber

    // 簽名 (此處應有實際的幀構建邏輯)
    return frame
  }

  /**
   * 解析控制器回應
   */
  private parseControllerResponse(
    response: Buffer,
    userSlotNumber: number
  ): ControllerResponse {
    // TODO: 根據回應格式解析結果
    // 檢查：
    // 1. 校驗和正確性
    // 2. 功能碼回應
    // 3. 狀態代碼

    const statusCode = response[2] || 0x00

    if (statusCode === 0x00) {
      return {
        success: true,
        userSlotNumber,
        resultCode: '00',
        resultMessage: '成功',
        timestamp: new Date(),
      }
    } else if (statusCode === 0x01) {
      return {
        success: false,
        resultCode: '01',
        resultMessage: '使用者位置已佔用',
      }
    } else if (statusCode === 0x02) {
      return {
        success: false,
        resultCode: '02',
        resultMessage: 'PIN 長度不符',
      }
    } else {
      return {
        success: false,
        resultCode: String(statusCode),
        resultMessage: '未知錯誤',
      }
    }
  }

  /**
   * 回報命令結果到雲端
   */
  async reportCommandResult(
    command: any,
    result: ControllerResponse
  ): Promise<void> {
    await db.doorAccessCommand.update({
      where: { id: command.id },
      data: {
        ackedAt: new Date(),
        deviceStatus: result.success ? 'ACCEPTED' : 'REJECTED',
        deviceResponse: result,
        status: result.success ? 'ACKED' : 'FAILED',
        error: result.success ? null : result.resultMessage,
      },
    })

    if (result.success && result.userSlotNumber) {
      // 更新會話的位置編號
      await db.accessSession.update({
        where: { id: command.accessSessionId },
        data: {
          userSlotNumber: result.userSlotNumber,
          credentialState: 'APPLIED',
          lastAppliedAt: new Date(),
        },
      })
    }

    console.log('[Pi] 命令結果已回報:', {
      commandId: command.commandId,
      success: result.success,
    })
  }

  /**
   * 查詢控制器狀態
   */
  async queryControllerStatus(macId: string): Promise<ControllerStatus> {
    try {
      // TODO: 透過 RS-485 查詢控制器：
      // 1. 已佔用的使用者位置數
      // 2. 可用位置數
      // 3. 電源與電池狀態
      // 4. 控制器時間
      // 5. 最近一次訪問時間

      // 此為模擬實現
      return {
        online: true,
        usedSlots: 25,
        availableSlots: 25,
        controllerTime: new Date(),
        powerStatus: 'AC',
        batteryPercent: 95,
        lastHeartbeat: new Date(),
        accessLogCount: 150,
        lastAccessTime: new Date(Date.now() - 5 * 60000), // 5 分鐘前
      }
    } catch (error) {
      console.error('[Pi] 查詢控制器狀態失敗:', error)
      return {
        online: false,
        usedSlots: 0,
        availableSlots: 0,
        controllerTime: new Date(),
        powerStatus: 'UNKNOWN',
        lastHeartbeat: new Date(Date.now() - 60000), // 1 分鐘前
        accessLogCount: 0,
      }
    }
  }

  /**
   * 校時同步
   */
  async syncControllerClock(macId: string, ntpTime: Date): Promise<boolean> {
    try {
      // 查詢控制器當前時間
      const status = await this.queryControllerStatus(macId)

      // 計算時鐘漂移
      const drift = calculateClockDrift(ntpTime, status.controllerTime)

      if (drift > TIME_CONSTANTS.CLOCK_DRIFT_THRESHOLD_SECONDS) {
        console.log('[Pi] 檢測到時鐘漂移:', drift, '秒，準備校時')

        // TODO: 構建校時命令幀，發送給控制器
        // await this.rs485.sendCommand(syncFrame)

        // 記錄校時事件
        await db.controlEvent.create({
          data: {
            eventId: randomUUID(),
            venueId: '', // TODO: 取得 venueId
            eventType: 'COMMAND_SENT',
            severity: 'INFO',
            title: '控制器校時',
            description: `時鐘漂移: ${drift}秒，已發送校時命令`,
          },
        })

        return true
      } else {
        console.log('[Pi] 控制器時鐘正常，漂移:', drift, '秒')
        return false
      }
    } catch (error) {
      console.error('[Pi] 校時失敗:', error)
      return false
    }
  }

  /**
   * 讀取門禁交易紀錄
   */
  async readAccessLog(
    macId: string,
    limit: number = 100
  ): Promise<Array<{
    attemptAt: Date
    userSlotNumber: number
    method: string
    result: string
    doorState: string
  }>> {
    try {
      // TODO: 透過 RS-485 讀取控制器的交易記錄
      // SOYAL 控制器通常支援讀取已存的訪問日誌

      // 此為模擬實現
      const logs = []
      for (let i = 0; i < Math.min(limit, 20); i++) {
        logs.push({
          attemptAt: new Date(Date.now() - i * 60000),
          userSlotNumber: Math.floor(Math.random() * 50) + 1,
          method: 'PIN_ENTRY',
          result: 'GRANTED',
          doorState: 'OPENED',
        })
      }

      return logs
    } catch (error) {
      console.error('[Pi] 讀取交易紀錄失敗:', error)
      return []
    }
  }

  /**
   * 撤銷憑證
   */
  async revokeCredential(
    command: any,
    controllerConfig: any
  ): Promise<ControllerResponse> {
    try {
      if (!command.accessSession.userSlotNumber) {
        return {
          success: false,
          resultCode: 'NO_SLOT_NUMBER',
          resultMessage: '無法確定要撤銷的位置',
        }
      }

      // 構建撤銷命令幀
      const revokeFrame = this.buildRevokeFrame(
        command.accessSession.userSlotNumber,
        controllerConfig
      )

      // 發送撤銷命令
      const response = await this.rs485.sendCommand(
        revokeFrame,
        TIME_CONSTANTS.RS485_COMMAND_TIMEOUT_SECONDS * 1000
      )

      // 解析回應
      const result = this.parseControllerResponse(response, command.accessSession.userSlotNumber)

      if (result.success) {
        // 更新會話狀態
        await db.accessSession.update({
          where: { id: command.accessSessionId },
          data: {
            credentialState: 'REVOKED',
            lastRevokedAt: new Date(),
          },
        })

        this.executedCommands.add(command.commandId)
      }

      return result
    } catch (error) {
      console.error('[Pi] 撤銷憑證失敗:', error)
      return {
        success: false,
        resultCode: 'REVOKE_ERROR',
        resultMessage: (error as Error).message,
      }
    }
  }

  /**
   * 構建撤銷命令幀
   */
  private buildRevokeFrame(
    userSlotNumber: number,
    controllerConfig: any
  ): Buffer {
    const frame = Buffer.alloc(16)
    frame[0] = controllerConfig.rs485Config.stationId
    frame[1] = 0x20 // 刪除功能碼
    frame[2] = userSlotNumber

    return frame
  }

  /**
   * 處理 MQTT 命令（入口點）
   */
  async processCommand(command: any): Promise<void> {
    console.log('[Pi] 處理命令:', command.commandId)

    try {
      // 驗證
      const validation = await this.validateCommandBeforeExecution(command)
      if (!validation.valid) {
        console.warn('[Pi] 命令驗證失敗:', validation.reason)
        await db.doorAccessCommand.update({
          where: { id: command.id },
          data: {
            status: 'FAILED',
            error: validation.reason,
          },
        })
        return
      }

      // 獲取控制器配置
      const adapter = await db.deviceAdapter.findFirst({
        where: { macId: command.accessSession.controllerMacId },
      })

      if (!adapter) {
        throw new Error('找不到設備適配器')
      }

      // 根據命令類型處理
      let result: ControllerResponse

      if (command.commandType === 'PROVISION_CREDENTIAL') {
        result = await this.configureCredentialViaRS485(command, adapter)
      } else if (command.commandType === 'REVOKE_CREDENTIAL') {
        result = await this.revokeCredential(command, adapter)
      } else {
        throw new Error(`未知命令類型: ${command.commandType}`)
      }

      // 回報結果
      await this.reportCommandResult(command, result)
    } catch (error) {
      console.error('[Pi] 命令處理失敗:', error)
      await db.doorAccessCommand.update({
        where: { id: command.id },
        data: {
          status: 'FAILED',
          error: (error as Error).message,
        },
      })
    }
  }

  /**
   * 關閉適配器
   */
  async shutdown(): Promise<void> {
    await this.rs485.close()
    console.log('[Pi] Raspberry Pi 適配器已關閉')
  }
}

// ─────── 匯出 ───────

export const RaspberryPiAdapterModule = {
  RS485Adapter,
  RaspberryPiAdapter,
}
