/**
 * 命令處理器 — 驗證、去重、分發
 *
 * 責務：
 * 1. 驗證命令格式與簽名
 * 2. 檢查命令過期時間
 * 3. 去重（防止重複執行）
 * 4. 映射迴路號 → Relay 設備
 * 5. 轉換為 RS-485 協議
 * 6. 分發給 RS-485 Adapter
 */

import { logger } from './logger.js'
import { getConfig } from './config.js'

export interface ControlCommandPayload {
  commandId: string
  siteId: string
  circuitId: string
  targetState: 'ON' | 'OFF'
  source: 'SCHEDULE' | 'MANUAL_OVERRIDE' | 'EMERGENCY'
  scheduleVersion: number
  issuedAt: string // ISO 8601
  expiresAt: string
  signature?: string
}

export interface ExecutionResult {
  commandId: string
  success: boolean
  circuitId: string
  executedAt: Date
  executionTimeMs: number
  rs485Signal?: Buffer
  error?: string
}

export interface ValidationError {
  field: string
  reason: string
}

export class CommandProcessor {
  private executedCommands: Map<string, Date> = new Map() // 已執行命令（去重用）
  private commandHistory: ControlCommandPayload[] = [] // 命令歷史
  private maxHistorySize: number = 10000

  /**
   * 驗證命令格式、簽名、過期時間
   */
  validateCommand(payload: ControlCommandPayload): {
    valid: boolean
    errors: ValidationError[]
  } {
    const errors: ValidationError[] = []

    // 1. 必填欄位檢查
    if (!payload.commandId) {
      errors.push({ field: 'commandId', reason: '缺失必填欄位' })
    }
    if (!payload.siteId) {
      errors.push({ field: 'siteId', reason: '缺失必填欄位' })
    }
    if (!payload.circuitId) {
      errors.push({ field: 'circuitId', reason: '缺失必填欄位' })
    }
    if (!payload.targetState || !['ON', 'OFF'].includes(payload.targetState)) {
      errors.push({ field: 'targetState', reason: '無效值（必須為 ON 或 OFF）' })
    }
    if (!payload.expiresAt) {
      errors.push({ field: 'expiresAt', reason: '缺失過期時間' })
    }

    // 2. 場館 ID 檢查
    const config = getConfig()
    if (payload.siteId !== config.siteId) {
      errors.push({
        field: 'siteId',
        reason: `場館 ID 不匹配（期望 ${config.siteId}，收到 ${payload.siteId}）`,
      })
    }

    // 3. 迴路編號檢查（01-18）
    if (!/^(0[1-9]|1[0-8])$/.test(payload.circuitId)) {
      errors.push({ field: 'circuitId', reason: '迴路編號無效（應為 01-18）' })
    }

    // 4. 過期時間檢查
    try {
      const expiresAt = new Date(payload.expiresAt)
      const now = new Date()

      if (now > expiresAt) {
        errors.push({
          field: 'expiresAt',
          reason: `命令已過期（過期於 ${payload.expiresAt}）`,
        })
      }
    } catch {
      errors.push({ field: 'expiresAt', reason: '過期時間格式無效' })
    }

    // 5. 簽名驗證（可選，未來加密用）
    if (payload.signature) {
      // TODO: 驗證 HMAC-SHA256 簽名
      // const expectedSignature = this.generateSignature(payload)
      // if (payload.signature !== expectedSignature) {
      //   errors.push({ field: 'signature', reason: '簽名驗證失敗' })
      // }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * 檢查是否為重複命令
   * 防止短時間內相同命令多次執行
   */
  isDuplicateCommand(commandId: string): boolean {
    if (!this.executedCommands.has(commandId)) {
      return false
    }

    const lastExecution = this.executedCommands.get(commandId)!
    const timeSinceLastExecution = Date.now() - lastExecution.getTime()

    // 同一 commandId 在 60 秒內重複視為重複命令
    if (timeSinceLastExecution < 60000) {
      logger.warn('檢測到重複命令', {
        module: 'CommandProcessor',
        commandId,
        timeSinceLastExecutionMs: timeSinceLastExecution,
      })
      return true
    }

    return false
  }

  /**
   * 映射迴路編號到 Relay 設備與通道
   */
  mapCircuitToDevice(
    circuitId: string
  ): {
    deviceId: string
    channel: number
    device: any
  } | null {
    const config = getConfig()

    for (const [deviceId, device] of Object.entries(config.devices || {})) {
      const deviceConfig = device as any
      if (!deviceConfig.channels) continue

      for (const [channelNum, channelConfig] of Object.entries(
        deviceConfig.channels
      )) {
        const ch = channelConfig as any
        if (ch.circuitId === circuitId) {
          return {
            deviceId,
            channel: parseInt(channelNum),
            device: deviceConfig,
          }
        }
      }
    }

    logger.error('迴路未映射', {
      module: 'CommandProcessor',
      circuitId,
    })
    return null
  }

  /**
   * 轉換為 RS-485 協議格式
   * 根據設備協議類型生成對應的位元組序列
   */
  convertToRS485(
    deviceId: string,
    channel: number,
    targetState: 'ON' | 'OFF',
    device: any
  ): Buffer {
    const protocol = device.protocol || 'MODBUS_RTU'

    if (protocol === 'MODBUS_RTU') {
      return this.encodeModbusRTU(
        device.baseAddress,
        channel,
        targetState === 'ON' ? 1 : 0
      )
    } else if (protocol === 'CUSTOM_JSON') {
      // 自訂協議由 RS-485 Adapter 處理
      return Buffer.from(
        JSON.stringify({
          deviceId,
          channel,
          state: targetState,
        })
      )
    }

    throw new Error(`不支持的協議: ${protocol}`)
  }

  /**
   * Modbus RTU 編碼
   * 格式：[Slave ID] [Function Code] [Coil Address H] [Coil Address L] [Value H] [Value L] [CRC L] [CRC H]
   */
  private encodeModbusRTU(slaveId: number, coilAddress: number, value: number): Buffer {
    const buffer = Buffer.alloc(8)

    // Modbus 位置計算：線圈地址 = (通道 - 1) * 16
    const actualAddress = (coilAddress - 1) * 16

    buffer[0] = slaveId & 0xff
    buffer[1] = 0x05 // Function Code 5 (Write Single Coil)
    buffer[2] = (actualAddress >> 8) & 0xff // Address H
    buffer[3] = actualAddress & 0xff // Address L
    buffer[4] = value > 0 ? 0xff : 0x00 // Value H
    buffer[5] = value > 0 ? 0xff : 0x00 // Value L

    // 計算 CRC-16（Modbus RTU）
    const crc = this.calculateCRC16(buffer.subarray(0, 6))
    buffer[6] = crc & 0xff // CRC L
    buffer[7] = (crc >> 8) & 0xff // CRC H

    return buffer
  }

  /**
   * CRC-16 校驗（Modbus）
   */
  private calculateCRC16(data: Buffer): number {
    let crc = 0xffff

    for (let i = 0; i < data.length; i++) {
      crc ^= data[i]

      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >> 1) ^ 0xa001
        } else {
          crc = crc >> 1
        }
      }
    }

    return crc
  }

  /**
   * 主處理流程：驗證 → 去重 → 映射 → 轉換 → 分發
   */
  async processCommand(
    payload: ControlCommandPayload
  ): Promise<{
    success: boolean
    result?: ExecutionResult
    error?: string
  }> {
    const startTime = Date.now()

    try {
      // 1. 驗證命令
      const validation = this.validateCommand(payload)
      if (!validation.valid) {
        const errorMsg = validation.errors.map((e) => `${e.field}: ${e.reason}`).join('; ')
        logger.warn('命令驗證失敗', {
          module: 'CommandProcessor',
          commandId: payload.commandId,
          errors: errorMsg,
        })
        return { success: false, error: errorMsg }
      }

      // 2. 檢查重複
      if (this.isDuplicateCommand(payload.commandId)) {
        logger.debug('跳過重複命令', {
          module: 'CommandProcessor',
          commandId: payload.commandId,
        })
        return {
          success: true,
          result: {
            commandId: payload.commandId,
            success: true,
            circuitId: payload.circuitId,
            executedAt: new Date(),
            executionTimeMs: Date.now() - startTime,
            error: '(重複命令，跳過)',
          },
        }
      }

      // 3. 映射迴路
      const mapping = this.mapCircuitToDevice(payload.circuitId)
      if (!mapping) {
        return {
          success: false,
          error: `迴路 ${payload.circuitId} 未映射任何 Relay 設備`,
        }
      }

      // 4. 轉換為 RS-485
      const rs485Signal = this.convertToRS485(
        mapping.deviceId,
        mapping.channel,
        payload.targetState,
        mapping.device
      )

      // 5. 記錄執行
      this.executedCommands.set(payload.commandId, new Date())
      this.recordCommandHistory(payload)

      const executionTime = Date.now() - startTime

      logger.logCommand(payload.commandId, payload.circuitId, 'RS-485 信號已生成', {
        deviceId: mapping.deviceId,
        channel: mapping.channel,
        rs485Signal: rs485Signal.toString('hex'),
        executionTimeMs: executionTime,
      })

      return {
        success: true,
        result: {
          commandId: payload.commandId,
          success: true,
          circuitId: payload.circuitId,
          executedAt: new Date(),
          executionTimeMs: executionTime,
          rs485Signal,
        },
      }
    } catch (error) {
      const executionTime = Date.now() - startTime
      logger.error('命令處理異常', error as Error, {
        module: 'CommandProcessor',
        commandId: payload.commandId,
        executionTimeMs: executionTime,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
      }
    }
  }

  /**
   * 記錄命令到歷史（用於稽核與回溯）
   */
  private recordCommandHistory(payload: ControlCommandPayload): void {
    this.commandHistory.push(payload)

    // 限制歷史大小，防止記憶體溢出
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory = this.commandHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * 取得命令歷史
   */
  getCommandHistory(limit: number = 100): ControlCommandPayload[] {
    return this.commandHistory.slice(-limit)
  }

  /**
   * 清除執行紀錄（用於測試或重置）
   */
  clearExecutionRecords(): void {
    this.executedCommands.clear()
    logger.info('執行紀錄已清除', { module: 'CommandProcessor' })
  }
}

export const commandProcessor = new CommandProcessor()
