/**
 * RS-485 Adapter — 序列埠通訊層
 *
 * 責務：
 * 1. 初始化序列埠連接
 * 2. 發送 RS-485 訊號
 * 3. 接收與解析設備回報
 * 4. CRC 校驗
 * 5. 超時與重試機制
 * 6. Mock 模式支持
 */

import { SerialPort } from 'serialport'
import { logger } from './logger.js'
import { getConfig } from './config.js'

export interface RS485Response {
  success: boolean
  slaveId?: number
  functionCode?: number
  coilValue?: number
  error?: string
  rawBuffer?: Buffer
}

export class RS485Adapter {
  private port: SerialPort | null = null
  private isConnected: boolean = false
  private mockMode: boolean = false
  private receiveBuffer: Buffer = Buffer.alloc(0)
  private lastHeartbeat: Date = new Date()

  /**
   * 初始化序列埠連接
   */
  async connect(): Promise<void> {
    const config = getConfig()

    // 檢查是否為模擬模式
    if (config.simulation.mockRS485) {
      logger.info('RS-485 模擬模式已啟用', { module: 'RS485Adapter' })
      this.mockMode = true
      this.isConnected = true
      return
    }

    try {
      logger.info('正在連接 RS-485 序列埠...', {
        module: 'RS485Adapter',
        port: config.rs485.port,
        baudRate: config.rs485.baudRate,
      })

      this.port = new SerialPort({
        path: config.rs485.port,
        baudRate: config.rs485.baudRate,
        dataBits: config.rs485.dataBits,
        stopBits: config.rs485.stopBits,
        parity: config.rs485.parity,
        autoOpen: false,
      })

      // 事件處理
      this.port.on('open', () => this.onPortOpen())
      this.port.on('close', () => this.onPortClose())
      this.port.on('error', (error) => this.onPortError(error))
      this.port.on('data', (data) => this.onData(data))

      // 開啟序列埠
      await this.port.open()

      // 等待連接確認
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('序列埠連接超時'))
        }, 5000)

        const checkConnection = () => {
          if (this.isConnected) {
            clearTimeout(timeout)
            resolve(true)
          } else {
            setTimeout(checkConnection, 100)
          }
        }

        checkConnection()
      })

      logger.info('RS-485 序列埠已連接', { module: 'RS485Adapter' })
    } catch (error) {
      logger.error('RS-485 連接失敗', error as Error, { module: 'RS485Adapter' })
      throw error
    }
  }

  /**
   * 發送 RS-485 訊號
   */
  async send(buffer: Buffer): Promise<void> {
    // 模擬模式：不實際發送
    if (this.mockMode) {
      logger.debug('【模擬】RS-485 發送', {
        module: 'RS485Adapter',
        buffer: buffer.toString('hex'),
        length: buffer.length,
      })
      return
    }

    if (!this.port || !this.isConnected) {
      throw new Error('RS-485 序列埠未連接')
    }

    return new Promise((resolve, reject) => {
      this.port!.write(buffer, (error) => {
        if (error) {
          logger.error('RS-485 寫入失敗', error, {
            module: 'RS485Adapter',
            buffer: buffer.toString('hex'),
          })
          reject(error)
        } else {
          logger.debug('RS-485 訊號已發送', {
            module: 'RS485Adapter',
            buffer: buffer.toString('hex'),
            length: buffer.length,
          })
          resolve()
        }
      })
    })
  }

  /**
   * 接收設備回報（使用超時機制）
   */
  async receive(timeoutMs: number = 2000): Promise<Buffer> {
    // 模擬模式：返回模擬回報
    if (this.mockMode) {
      return this.generateMockResponse()
    }

    if (!this.port || !this.isConnected) {
      throw new Error('RS-485 序列埠未連接')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`RS-485 接收超時（${timeoutMs}ms）`))
      }, timeoutMs)

      // 檢查接收緩衝區
      const checkBuffer = () => {
        if (this.receiveBuffer.length >= 8) {
          // Modbus RTU 最小回報長度為 8 字節
          clearTimeout(timeout)
          const data = this.receiveBuffer.subarray(0, 8)
          this.receiveBuffer = this.receiveBuffer.subarray(8)
          resolve(Buffer.from(data))
        } else {
          setTimeout(checkBuffer, 10)
        }
      }

      checkBuffer()
    })
  }

  /**
   * 驗證 CRC-16（Modbus RTU）
   */
  verifyCRC16(data: Buffer, expectedCrc: number): boolean {
    const calculatedCrc = this.calculateCRC16(data)
    return calculatedCrc === expectedCrc
  }

  /**
   * 計算 CRC-16（Modbus RTU）
   * 使用多項式 0xA001（反向）
   */
  calculateCRC16(data: Buffer): number {
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
   * 解析 Modbus RTU 回報
   * 格式：[Slave ID] [Function Code] [Byte Count] [Coil Values...] [CRC L] [CRC H]
   */
  parseModbusRTUResponse(buffer: Buffer): RS485Response {
    if (buffer.length < 5) {
      return {
        success: false,
        error: '回報訊息過短',
        rawBuffer: buffer,
      }
    }

    try {
      const slaveId = buffer[0]
      const functionCode = buffer[1]
      const byteCount = buffer[2]

      // 驗證 CRC
      const crcL = buffer[buffer.length - 2]
      const crcH = buffer[buffer.length - 1]
      const receivedCrc = (crcH << 8) | crcL
      const dataPart = buffer.subarray(0, buffer.length - 2)
      const calculatedCrc = this.calculateCRC16(dataPart)

      if (receivedCrc !== calculatedCrc) {
        logger.warn('CRC 校驗失敗', {
          module: 'RS485Adapter',
          received: receivedCrc.toString(16),
          calculated: calculatedCrc.toString(16),
        })
        return {
          success: false,
          error: 'CRC 校驗失敗',
          rawBuffer: buffer,
        }
      }

      // Function Code 3 (Read Holding Registers) 或 5 (Write Single Coil)
      if (functionCode === 0x03 || functionCode === 0x05) {
        const coilValue = buffer[3]
        return {
          success: true,
          slaveId,
          functionCode,
          coilValue,
          rawBuffer: buffer,
        }
      }

      return {
        success: true,
        slaveId,
        functionCode,
        rawBuffer: buffer,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '解析失敗',
        rawBuffer: buffer,
      }
    }
  }

  /**
   * 設置模擬模式（測試用）
   */
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled
    if (enabled) {
      this.isConnected = true
      logger.info('RS-485 模擬模式已啟用', { module: 'RS485Adapter' })
    }
  }

  /**
   * 取得連接狀態
   */
  isReady(): boolean {
    return this.isConnected
  }

  /**
   * 取得最後心跳時間
   */
  getLastHeartbeat(): Date {
    return this.lastHeartbeat
  }

  /**
   * 斷開連接
   */
  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.mockMode || !this.port) {
        this.isConnected = false
        resolve()
        return
      }

      this.port.close((error) => {
        if (error) {
          logger.error('RS-485 斷開連接時出錯', error, { module: 'RS485Adapter' })
        }
        this.isConnected = false
        resolve()
      })
    })
  }

  // ─────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────

  private onPortOpen(): void {
    this.isConnected = true
    this.lastHeartbeat = new Date()
    logger.info('RS-485 序列埠已開啟', { module: 'RS485Adapter' })
  }

  private onPortClose(): void {
    this.isConnected = false
    logger.warn('RS-485 序列埠已關閉', { module: 'RS485Adapter' })
  }

  private onPortError(error: Error): void {
    this.isConnected = false
    logger.error('RS-485 序列埠錯誤', error, { module: 'RS485Adapter' })
  }

  private onData(data: Buffer): void {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data])
    this.lastHeartbeat = new Date()

    logger.debug('RS-485 收到數據', {
      module: 'RS485Adapter',
      length: data.length,
      hex: data.toString('hex'),
    })
  }

  /**
   * 生成模擬設備回報（測試用）
   * 返回一個虛擬的 Modbus RTU 確認訊號
   */
  private generateMockResponse(): Buffer {
    const buffer = Buffer.alloc(8)

    // 模擬設備回報：Slave ID 1, Function Code 5 (Write Single Coil)
    buffer[0] = 0x01 // Slave ID
    buffer[1] = 0x05 // Function Code
    buffer[2] = 0x00 // Address H
    buffer[3] = 0x00 // Address L
    buffer[4] = 0xff // Value (ON)
    buffer[5] = 0x00 // Value L

    // 計算並附加 CRC
    const crc = this.calculateCRC16(buffer.subarray(0, 6))
    buffer[6] = crc & 0xff
    buffer[7] = (crc >> 8) & 0xff

    logger.debug('【模擬】設備回報已生成', {
      module: 'RS485Adapter',
      buffer: buffer.toString('hex'),
    })

    return buffer
  }
}

export const rs485Adapter = new RS485Adapter()
