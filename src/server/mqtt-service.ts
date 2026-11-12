/**
 * MQTT 服務 — 與 Broker 的連接與通訊
 *
 * 責務：
 * 1. 連接到 MQTT Broker（真實或模擬）
 * 2. 發佈控制命令（預留 retained = false）
 * 3. 訂閱設備狀態回報
 * 4. 心跳與重連邏輯
 * 5. 模擬環境下使用內存 mock broker
 */

import 'server-only'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

export type MqttConnectionStatus = 'ONLINE' | 'OFFLINE' | 'CONNECTING' | 'ERROR'

interface MqttMessage {
  topic: string
  payload: Buffer | string
  retained?: boolean
  qos?: 0 | 1 | 2
}

/**
 * 在模擬環境下，使用內存 mock broker
 */
class MockMqttBroker {
  private subscriptions: Map<string, Set<(msg: MqttMessage) => void>> = new Map()
  private publishedMessages: MqttMessage[] = []
  private connectionStatus: MqttConnectionStatus = 'ONLINE'
  private lastMessageTime: Date = new Date()

  connect(): boolean {
    this.connectionStatus = 'ONLINE'
    console.log('[MQTT Mock] 已連接')
    return true
  }

  disconnect(): void {
    this.connectionStatus = 'OFFLINE'
    console.log('[MQTT Mock] 已斷開連接')
  }

  subscribe(topic: string, callback: (msg: MqttMessage) => void): void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set())
    }
    this.subscriptions.get(topic)!.add(callback)
    console.log(`[MQTT Mock] 已訂閱: ${topic}`)
  }

  publish(topic: string, payload: any, options?: { retained?: boolean; qos?: 0 | 1 | 2 }): void {
    const message: MqttMessage = {
      topic,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      retained: options?.retained ?? false,
      qos: options?.qos ?? 1,
    }

    this.publishedMessages.push(message)
    this.lastMessageTime = new Date()

    console.log(`[MQTT Mock] 已發佈: ${topic}`, payload)

    // 模擬設備回報
    this.simulateDeviceResponse(topic, payload)
  }

  private simulateDeviceResponse(topic: string, payload: any): void {
    // 如果是控制命令，模擬設備在 100ms 後回報狀態
    if (topic.includes('/ctl/')) {
      setTimeout(() => {
        const statusTopic = topic.replace('/ctl/', '/data')
        const statusPayload = {
          v: payload.v,
          timestamp: new Date().toISOString(),
        }

        // 通知所有訂閱者
        const callbacks = this.subscriptions.get(statusTopic)
        if (callbacks) {
          const msg: MqttMessage = {
            topic: statusTopic,
            payload: JSON.stringify(statusPayload),
          }
          callbacks.forEach((cb) => cb(msg))
        }
      }, 100)
    }
  }

  getStatus(): MqttConnectionStatus {
    return this.connectionStatus
  }

  getPublishedMessages(): MqttMessage[] {
    return this.publishedMessages
  }

  clearMessages(): void {
    this.publishedMessages = []
  }
}

// 全局 mock broker 實例
let mockBroker: MockMqttBroker | null = null

/**
 * 初始化 MQTT 服務
 *
 * 根據環境變量決定使用真實 Broker 或 Mock Broker
 */
export async function initializeMqtt(): Promise<boolean> {
  const brokerUrl = process.env.MQTT_BROKER_URL
  const environment = process.env.CONTROL_ENVIRONMENT || 'simulation'

  if (environment === 'simulation' || !brokerUrl) {
    // 使用 Mock Broker
    mockBroker = new MockMqttBroker()
    return mockBroker.connect()
  }

  // 真實環境：此處應使用真實 MQTT 庫（例如 mqtt.js）
  // 目前留作佔位符，待真實設備參數提供後實施
  console.warn('[MQTT] 真實 Broker 連接尚未實現，請檢查 MQTT_BROKER_URL')
  return false
}

/**
 * 發佈控制命令到 MQTT
 *
 * @param commandId 命令唯一識別
 * @param deviceMacId 設備 MAC ID
 * @param channel 輸出通道
 * @param value 輸出值 (0/1 或 OFF/ON)
 */
export async function publishCircuitCommand(
  commandId: string,
  deviceMacId: string,
  channel: number,
  value: number,
  topicTemplate: string = 'Advantech/{MAC_ID}/ctl/do{channel}',
): Promise<boolean> {
  if (!mockBroker) return false

  const topic = topicTemplate
    .replace('{MAC_ID}', deviceMacId)
    .replace('{channel}', String(channel))

  const payload = {
    command_id: commandId,
    v: value,
    timestamp: new Date().toISOString(),
  }

  try {
    mockBroker.publish(topic, payload, { retained: false })

    // 更新 ControlCommand 狀態
    await updateCommandStatus(commandId, 'SENT')
    return true
  } catch (error) {
    console.error(`[MQTT] 發佈失敗: ${commandId}`, error)
    await updateCommandStatus(commandId, 'FAILED', String(error))
    return false
  }
}

/**
 * 訂閱設備狀態回報
 */
export async function subscribeToDeviceStatus(
  deviceMacId: string,
  topicPrefix: string = 'Advantech/{MAC_ID}',
  onMessage?: (data: any) => Promise<void>,
): Promise<void> {
  if (!mockBroker) return

  const topic = topicPrefix.replace('{MAC_ID}', deviceMacId)

  mockBroker.subscribe(topic, (msg: MqttMessage) => {
    try {
      const data = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload
      console.log(`[MQTT] 收到設備回報: ${msg.topic}`, data)

      // 呼叫回調函數處理狀態變化
      if (onMessage) {
        onMessage(data).catch((e) => console.error('[MQTT] 處理回報失敗:', e))
      }

      // 更新 Circuit 的實際狀態
      updateCircuitStateFromDevice(data).catch((e) =>
        console.error('[MQTT] 更新迴路狀態失敗:', e),
      )
    } catch (error) {
      console.error('[MQTT] 解析回報失敗:', error)
    }
  })
}

/**
 * 更新命令狀態
 */
async function updateCommandStatus(
  commandId: string,
  status: 'PENDING' | 'SENT' | 'ACKED' | 'FAILED' | 'TIMEOUT' | 'EXPIRED',
  error?: string,
): Promise<void> {
  try {
    await prisma.controlCommand.update({
      where: { commandId },
      data: {
        status,
        error,
        sentAt: status === 'SENT' ? new Date() : undefined,
        ackedAt: status === 'ACKED' ? new Date() : undefined,
      },
    })
  } catch (e) {
    console.error(`[Database] 更新命令狀態失敗: ${commandId}`, e)
  }
}

/**
 * 更新迴路的實際設備狀態
 */
async function updateCircuitStateFromDevice(deviceData: any): Promise<void> {
  // 從設備回報資料提取狀態
  // 例如: { v: 1, timestamp: "2026-11-11T..." } 表示 ON
  // { v: 0 } 表示 OFF

  if (deviceData.v === undefined) return

  const actualState = deviceData.v === 1 ? 'ON' : 'OFF'

  // 根據 commandId 或其他標識符找到對應的 Circuit
  // 簡化版本：這裡應該有完整的映射邏輯
  console.log(`[MQTT] 設備狀態更新: ${actualState} (timestamp: ${deviceData.timestamp})`)
}

/**
 * 取得 MQTT 連接狀態
 */
export function getMqttStatus(): MqttConnectionStatus {
  if (!mockBroker) return 'OFFLINE'
  return mockBroker.getStatus()
}

/**
 * 取得模擬環境中已發佈的所有消息（僅用於測試）
 */
export function getPublishedMessages(): any[] {
  if (!mockBroker) return []
  return mockBroker.getPublishedMessages()
}

/**
 * 清空模擬環境中的消息日誌（僅用於測試）
 */
export function clearPublishedMessages(): void {
  if (mockBroker) {
    mockBroker.clearMessages()
  }
}

/**
 * Heartbeat 檢測
 *
 * 定期檢查 MQTT 連接狀態，並更新 Watchdog
 */
export async function checkMqttHeartbeat(): Promise<boolean> {
  const status = getMqttStatus()

  if (status === 'OFFLINE' || status === 'ERROR') {
    // 記錄告警
    const venue = await prisma.venue.findFirst({ where: { active: true } })
    if (venue) {
      await prisma.watchdogAlert.create({
        data: {
          venueId: venue.id,
          alertType: 'MQTT_DOWN',
          severity: 'ERROR',
          title: 'MQTT Broker 連接失敗',
          description: `MQTT 連接狀態: ${status}`,
          detectionSource: 'HEARTBEAT',
          status: 'OPEN',
        },
      })
    }
    return false
  }

  return true
}
