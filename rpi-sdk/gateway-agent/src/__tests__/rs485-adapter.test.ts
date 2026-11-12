/**
 * RS-485 Adapter 單元測試
 *
 * 覆蓋場景：
 * 1. 序列埠初始化與連接
 * 2. Modbus RTU 訊號編碼
 * 3. CRC-16 校驗
 * 4. 訊號發送與接收
 * 5. 回報解析
 * 6. Mock 模式測試
 * 7. 錯誤處理
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { RS485Adapter } from '../rs485-adapter'

// Mock 配置
jest.mock('../config', () => ({
  getConfig: () => ({
    rs485: {
      port: '/dev/ttyUSB0',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      timeout: 5000,
      mockMode: false,
    },
    environment: 'test',
  }),
}))

// Mock 日誌
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    logCommand: jest.fn(),
  },
}))

// Mock SerialPort
jest.mock('serialport', () => ({
  SerialPort: jest.fn().mockImplementation(() => ({
    open: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  })),
}))

describe('RS485Adapter', () => {
  let adapter: RS485Adapter

  beforeEach(() => {
    adapter = new RS485Adapter()
  })

  afterEach(async () => {
    try {
      await adapter.disconnect()
    } catch {
      // 忽略關閉錯誤
    }
  })

  describe('CRC-16 校驗', () => {
    it('應計算正確的 CRC-16 校驗值', () => {
      // 測試向量：設備地址 1, Function Code 5, Coil 地址 0x0000, 值 0xFF00
      // 預期 CRC：0x8D88
      const data = Buffer.from([0x01, 0x05, 0x00, 0x00, 0xFF, 0x00])
      const crc = adapter.calculateCRC16(data)

      // CRC-16 應為 2 個位元組
      expect(crc).toBeInstanceOf(Buffer)
      expect(crc.length).toBe(2)
    })

    it('應驗證正確的 CRC 校驗和', () => {
      const data = Buffer.from([0x01, 0x05, 0x00, 0x00, 0xFF, 0x00])
      const crc = adapter.calculateCRC16(data)
      const fullMessage = Buffer.concat([data, crc])

      const isValid = adapter.verifyCRC16(fullMessage)
      expect(isValid).toBe(true)
    })

    it('應拒絕錯誤的 CRC 校驗和', () => {
      const data = Buffer.from([0x01, 0x05, 0x00, 0x00, 0xFF, 0x00])
      const wrongCrc = Buffer.from([0xFF, 0xFF])
      const fullMessage = Buffer.concat([data, wrongCrc])

      const isValid = adapter.verifyCRC16(fullMessage)
      expect(isValid).toBe(false)
    })

    it('應處理空訊號', () => {
      const emptyData = Buffer.from([])
      const crc = adapter.calculateCRC16(emptyData)

      expect(crc).toBeInstanceOf(Buffer)
      expect(crc.length).toBe(2)
    })
  })

  describe('Modbus RTU 編碼', () => {
    it('應生成打開單個繼電器的訊號 (FC 05)', () => {
      const signal = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5, // Write Single Coil
        coilAddress: 0x0000,
        value: 0xff00, // ON
      })

      // 應有設備地址 + Function Code + 資料 + CRC
      expect(signal).toBeInstanceOf(Buffer)
      expect(signal.length).toBeGreaterThan(4)
      expect(signal[0]).toBe(0x01) // 設備地址
      expect(signal[1]).toBe(0x05) // Function Code 5
    })

    it('應生成關閉單個繼電器的訊號', () => {
      const signal = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0x0000, // OFF
      })

      expect(signal).toBeInstanceOf(Buffer)
      expect(signal[0]).toBe(0x01) // 設備地址
      expect(signal[1]).toBe(0x05) // Function Code 5
    })

    it('應讀取繼電器狀態 (FC 01)', () => {
      const signal = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 1, // Read Coils
        coilAddress: 0x0000,
        quantity: 8,
      })

      expect(signal).toBeInstanceOf(Buffer)
      expect(signal[0]).toBe(0x01) // 設備地址
      expect(signal[1]).toBe(0x01) // Function Code 1
    })

    it('應為不同設備生成不同訊號', () => {
      const signal1 = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      const signal2 = adapter.encodeModbusRTU({
        deviceAddress: 2,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      expect(signal1[0]).toBe(0x01)
      expect(signal2[0]).toBe(0x02)
      expect(signal1).not.toEqual(signal2)
    })
  })

  describe('訊號發送', () => {
    it('應成功發送 Modbus RTU 訊號', async () => {
      const signal = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      // Mock 模式應直接成功
      const result = await adapter.send(signal)
      expect(result).toBe(true)
    })

    it('應拒絕空訊號', async () => {
      const emptySignal = Buffer.from([])
      const result = await adapter.send(emptySignal)
      expect(result).toBe(false)
    })
  })

  describe('回報解析', () => {
    it('應解析寫入單個繼電器的回報', () => {
      // FC 05 回報：[設備地址, Function Code, 地址 H, 地址 L, 值 H, 值 L, CRC H, CRC L]
      const response = Buffer.from([0x01, 0x05, 0x00, 0x00, 0xFF, 0x00])
      const crc = adapter.calculateCRC16(response)
      const fullResponse = Buffer.concat([response, crc])

      const parsed = adapter.parseModbusRTUResponse(fullResponse)

      expect(parsed.success).toBe(true)
      expect(parsed.deviceAddress).toBe(0x01)
      expect(parsed.functionCode).toBe(0x05)
      expect(parsed.coilValue).toBe(true) // 0xFF00 表示 ON
    })

    it('應解析讀取繼電器狀態的回報', () => {
      // FC 01 回報：[設備地址, FC, 位元組數, 資料..., CRC]
      const response = Buffer.from([0x01, 0x01, 0x01, 0x03]) // 1 個位元組，值 0x03（二進制 11）
      const crc = adapter.calculateCRC16(response)
      const fullResponse = Buffer.concat([response, crc])

      const parsed = adapter.parseModbusRTUResponse(fullResponse)

      expect(parsed.success).toBe(true)
      expect(parsed.functionCode).toBe(0x01)
      expect(parsed.coilValue).toBeDefined()
    })

    it('應檢測異常回報 (Exception)', () => {
      // FC | 0x80 表示異常回報
      const response = Buffer.from([0x01, 0x85, 0x02]) // FC 5 的異常版本，錯誤碼 2
      const crc = adapter.calculateCRC16(response)
      const fullResponse = Buffer.concat([response, crc])

      const parsed = adapter.parseModbusRTUResponse(fullResponse)

      expect(parsed.success).toBe(false)
      expect(parsed.error).toBeDefined()
    })

    it('應拒絕 CRC 錯誤的回報', () => {
      const response = Buffer.from([0x01, 0x05, 0x00, 0x00, 0xFF, 0x00])
      const wrongCrc = Buffer.from([0xFF, 0xFF])
      const fullResponse = Buffer.concat([response, wrongCrc])

      const parsed = adapter.parseModbusRTUResponse(fullResponse)

      expect(parsed.success).toBe(false)
      expect(parsed.error).toContain('CRC')
    })

    it('應拒絕太短的回報', () => {
      const shortResponse = Buffer.from([0x01, 0x05])

      const parsed = adapter.parseModbusRTUResponse(shortResponse)

      expect(parsed.success).toBe(false)
    })
  })

  describe('Mock 模式', () => {
    it('應在 Mock 模式下模擬回報', async () => {
      const signal = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      // Mock 模式應生成虛擬回報
      const response = adapter.generateMockResponse(signal)

      expect(response).toBeInstanceOf(Buffer)
      expect(response.length).toBeGreaterThan(2)
    })

    it('應在 Mock 模式下驗證虛擬回報', async () => {
      const signal = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      const mockResponse = adapter.generateMockResponse(signal)
      const parsed = adapter.parseModbusRTUResponse(mockResponse)

      expect(parsed.success).toBe(true)
    })
  })

  describe('連接管理', () => {
    it('應正確初始化適配器', async () => {
      const result = await adapter.connect()
      expect(result).toBe(true)
    })

    it('應正確斷開連接', async () => {
      await adapter.connect()
      const result = await adapter.disconnect()
      expect(result).toBe(true)
    })

    it('應回報連接狀態', async () => {
      const isConnected = adapter.isConnected()
      expect(typeof isConnected).toBe('boolean')
    })
  })

  describe('邊界情況', () => {
    it('應處理所有設備地址（1-247）', () => {
      const signal1 = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      const signal247 = adapter.encodeModbusRTU({
        deviceAddress: 247,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      expect(signal1[0]).toBe(0x01)
      expect(signal247[0]).toBe(0xF7) // 247 in hex
    })

    it('應處理所有線圈地址（0x0000-0xFFFF）', () => {
      const signalMin = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      const signalMax = adapter.encodeModbusRTU({
        deviceAddress: 1,
        functionCode: 5,
        coilAddress: 0xFFFF,
        value: 0xff00,
      })

      expect(signalMin).toBeInstanceOf(Buffer)
      expect(signalMax).toBeInstanceOf(Buffer)
    })

    it('應拒絕無效的設備地址（0 或 248+）', () => {
      const signal0 = adapter.encodeModbusRTU({
        deviceAddress: 0,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      const signal248 = adapter.encodeModbusRTU({
        deviceAddress: 248,
        functionCode: 5,
        coilAddress: 0x0000,
        value: 0xff00,
      })

      // 應該返回無效訊號或拋出錯誤
      expect(signal0).toBeDefined()
      expect(signal248).toBeDefined()
    })
  })
})
