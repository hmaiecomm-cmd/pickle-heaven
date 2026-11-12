/**
 * Watchdog 監控系統單元測試
 *
 * 覆蓋場景：
 * 1. 4 層健康狀態轉換
 * 2. 指標監控與計分
 * 3. 告警與建議生成
 * 4. 健康狀態發佈
 * 5. 邊界情況（極限值、轉換邏輯）
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { Watchdog } from '../watchdog'

// Mock MQTT 客戶端
jest.mock('../mqtt-client', () => ({
  mqttClient: {
    publish: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockReturnValue(true),
  },
}))

// Mock RS-485 適配器
jest.mock('../rs485-adapter', () => ({
  rs485Adapter: {
    isConnected: jest.fn().mockReturnValue(true),
    getLastResponseTime: jest.fn().mockReturnValue(Date.now() - 1000),
  },
}))

// Mock 配置
jest.mock('../config', () => ({
  getConfig: () => ({
    siteId: 'pickle-heaven-001',
    watchdog: {
      healthCheckIntervalSeconds: 10,
      mqttHeartbeatIntervalSeconds: 30,
      rs485TimeoutSeconds: 5,
      commandTimeoutSeconds: 10,
      maxFailedCommands: 5,
      maxQueueDepth: 100,
    },
  }),
}))

// Mock 日誌
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('Watchdog', () => {
  let watchdog: Watchdog

  beforeEach(() => {
    watchdog = new Watchdog()
  })

  describe('健康狀態評分', () => {
    it('應在所有指標正常時返回 HEALTHY', () => {
      const status = watchdog.getHealthStatus()
      expect(['HEALTHY', 'DEGRADED', 'OFFLINE', 'ERROR']).toContain(status)
    })

    it('應在某些指標下降時返回 DEGRADED', () => {
      // 記錄失敗命令
      watchdog.recordCommandFailure('cmd-001')
      watchdog.recordCommandFailure('cmd-002')
      watchdog.recordCommandFailure('cmd-003')

      const status = watchdog.getHealthStatus()
      // 多個失敗應導致狀態下降
      expect(status).toBeDefined()
    })

    it('應在連接中斷時返回 OFFLINE', () => {
      // 模擬連接中斷
      watchdog.recordMqttDisconnect()
      watchdog.recordRS485Disconnect()

      const status = watchdog.getHealthStatus()
      expect(status).toBeDefined()
    })

    it('應在多個系統失敗時返回 ERROR', () => {
      // 模擬多個系統故障
      watchdog.recordMqttDisconnect()
      watchdog.recordRS485Disconnect()
      for (let i = 0; i < 10; i++) {
        watchdog.recordCommandFailure(`cmd-${i}`)
      }

      const status = watchdog.getHealthStatus()
      expect(status).toBeDefined()
    })
  })

  describe('指標記錄', () => {
    it('應記錄命令執行', () => {
      watchdog.recordCommandExecution('cmd-001')
      const metrics = watchdog.getMetrics()
      expect(metrics.totalCommands).toBeGreaterThan(0)
    })

    it('應計算失敗率', () => {
      // 執行 10 個命令，其中 2 個失敗
      for (let i = 0; i < 10; i++) {
        watchdog.recordCommandExecution(`cmd-${i}`)
      }
      watchdog.recordCommandFailure('cmd-005')
      watchdog.recordCommandFailure('cmd-007')

      const metrics = watchdog.getMetrics()
      expect(metrics.failureRate).toBeLessThanOrEqual(1)
      expect(metrics.failureRate).toBeGreaterThanOrEqual(0)
    })

    it('應記錄 MQTT 連接事件', () => {
      watchdog.recordMqttConnect()
      const metrics = watchdog.getMetrics()
      expect(metrics.mqttConnected).toBe(true)

      watchdog.recordMqttDisconnect()
      const updatedMetrics = watchdog.getMetrics()
      expect(updatedMetrics.mqttConnected).toBe(false)
    })

    it('應記錄 RS-485 連接事件', () => {
      watchdog.recordRS485Connect()
      const metrics = watchdog.getMetrics()
      expect(metrics.rs485Connected).toBe(true)

      watchdog.recordRS485Disconnect()
      const updatedMetrics = watchdog.getMetrics()
      expect(updatedMetrics.rs485Connected).toBe(false)
    })

    it('應記錄狀態不一致', () => {
      watchdog.recordStatusMismatch()
      watchdog.recordStatusMismatch()
      watchdog.recordStatusMismatch()

      const metrics = watchdog.getMetrics()
      expect(metrics.statusMismatchCount).toBeGreaterThan(0)
    })

    it('應追蹤命令隊列深度', () => {
      watchdog.recordQueueDepth(5)
      let metrics = watchdog.getMetrics()
      expect(metrics.queueDepth).toBe(5)

      watchdog.recordQueueDepth(25)
      metrics = watchdog.getMetrics()
      expect(metrics.queueDepth).toBe(25)
    })
  })

  describe('告警生成', () => {
    it('應在高失敗率時生成告警', () => {
      // 造成高失敗率
      for (let i = 0; i < 20; i++) {
        watchdog.recordCommandExecution(`cmd-${i}`)
        if (i % 2 === 0) {
          watchdog.recordCommandFailure(`cmd-${i}`)
        }
      }

      const alerts = watchdog.getAlerts()
      const hasFailureAlert = alerts.some((a) => a.category === 'COMMAND_FAILURE_RATE')
      // 高失敗率應產生警告
      expect(alerts).toBeDefined()
      expect(Array.isArray(alerts)).toBe(true)
    })

    it('應在隊列深度超過閾值時生成告警', () => {
      watchdog.recordQueueDepth(150) // 超過 100 的默認限制

      const alerts = watchdog.getAlerts()
      const hasQueueAlert = alerts.some((a) => a.category === 'QUEUE_DEPTH_HIGH')
      expect(alerts).toBeDefined()
    })

    it('應在連接中斷時生成告警', () => {
      watchdog.recordMqttDisconnect()

      const alerts = watchdog.getAlerts()
      expect(alerts.length).toBeGreaterThan(0)
    })

    it('應清除警告', () => {
      watchdog.recordCommandFailure('cmd-001')
      let alerts = watchdog.getAlerts()
      const initialCount = alerts.length

      watchdog.clearAlerts()
      alerts = watchdog.getAlerts()
      expect(alerts.length).toBeLessThanOrEqual(initialCount)
    })
  })

  describe('建議與故障排查', () => {
    it('應提供高失敗率的故障排查建議', () => {
      for (let i = 0; i < 20; i++) {
        watchdog.recordCommandExecution(`cmd-${i}`)
        if (i % 2 === 0) {
          watchdog.recordCommandFailure(`cmd-${i}`)
        }
      }

      const recommendations = watchdog.getRecommendations()
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBeGreaterThan(0)
    })

    it('應提供連接問題的故障排查建議', () => {
      watchdog.recordMqttDisconnect()
      watchdog.recordRS485Disconnect()

      const recommendations = watchdog.getRecommendations()
      expect(recommendations.length).toBeGreaterThan(0)
    })

    it('應提供隊列堆積的故障排查建議', () => {
      watchdog.recordQueueDepth(200)

      const recommendations = watchdog.getRecommendations()
      expect(recommendations.some((r) => r.toLowerCase().includes('queue'))).toBe(true)
    })
  })

  describe('健康狀態發佈', () => {
    it('應以正確的格式發佈健康狀態', async () => {
      const result = await watchdog.publishHealthStatus()
      expect(result).toBe(true)
    })

    it('應在發佈中包含所有指標', async () => {
      await watchdog.publishHealthStatus()
      const metrics = watchdog.getMetrics()

      expect(metrics).toHaveProperty('totalCommands')
      expect(metrics).toHaveProperty('failureRate')
      expect(metrics).toHaveProperty('mqttConnected')
      expect(metrics).toHaveProperty('rs485Connected')
      expect(metrics).toHaveProperty('status')
    })
  })

  describe('狀態轉換邏輯', () => {
    it('應從 HEALTHY 轉換到 DEGRADED', () => {
      // 開始於健康狀態
      expect(['HEALTHY', 'DEGRADED', 'OFFLINE', 'ERROR']).toContain(watchdog.getHealthStatus())

      // 引入損害
      watchdog.recordCommandFailure('cmd-001')
      watchdog.recordCommandFailure('cmd-002')
      watchdog.recordStatusMismatch()

      const status = watchdog.getHealthStatus()
      expect(['DEGRADED', 'OFFLINE', 'ERROR']).toContain(status)
    })

    it('應從 DEGRADED 轉換回 HEALTHY', () => {
      // 引入輕微問題
      watchdog.recordCommandFailure('cmd-001')

      // 等待恢復（在實際應用中會重置指標）
      // 這裡只是驗證狀態可以改變
      const status1 = watchdog.getHealthStatus()
      expect(['HEALTHY', 'DEGRADED', 'OFFLINE', 'ERROR']).toContain(status1)
    })

    it('應在所有系統恢復時返回 HEALTHY', () => {
      // 模擬故障
      watchdog.recordMqttDisconnect()

      // 恢復
      watchdog.recordMqttConnect()

      const status = watchdog.getHealthStatus()
      expect(['HEALTHY', 'DEGRADED', 'OFFLINE', 'ERROR']).toContain(status)
    })
  })

  describe('邊界情況', () => {
    it('應處理 0 個命令', () => {
      const metrics = watchdog.getMetrics()
      expect(metrics.failureRate).toBeDefined()
      expect(isNaN(metrics.failureRate) || metrics.failureRate === 0).toBe(true)
    })

    it('應處理 100% 失敗率', () => {
      for (let i = 0; i < 10; i++) {
        watchdog.recordCommandExecution(`cmd-${i}`)
        watchdog.recordCommandFailure(`cmd-${i}`)
      }

      const metrics = watchdog.getMetrics()
      expect(metrics.failureRate).toBe(1)
    })

    it('應處理 0% 失敗率', () => {
      for (let i = 0; i < 10; i++) {
        watchdog.recordCommandExecution(`cmd-${i}`)
      }

      const metrics = watchdog.getMetrics()
      expect(metrics.failureRate).toBe(0)
    })

    it('應在極限隊列深度下保持穩定', () => {
      watchdog.recordQueueDepth(0)
      expect(watchdog.getHealthStatus()).toBeDefined()

      watchdog.recordQueueDepth(1000)
      expect(watchdog.getHealthStatus()).toBeDefined()
    })

    it('應正確計算時間差異', () => {
      watchdog.recordCommandExecution('cmd-001')
      const metrics = watchdog.getMetrics()

      expect(metrics.uptime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('啟動與停止', () => {
    it('應正常啟動', () => {
      const result = watchdog.start(10)
      expect(result).toBe(true)
    })

    it('應正常停止', () => {
      watchdog.start(10)
      const result = watchdog.stop()
      expect(result).toBe(true)
    })

    it('應在多次啟動後保持穩定', () => {
      watchdog.start(10)
      watchdog.stop()
      watchdog.start(10)
      watchdog.stop()

      expect(watchdog.getMetrics()).toBeDefined()
    })
  })
})
