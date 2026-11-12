/**
 * MQTT 客戶端 — 連接、訂閱、發佈
 */

import mqtt, { MqttClient as IMqttClient } from 'mqtt'
import { logger } from './logger.js'
import { getConfig } from './config.js'

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'

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

type MessageHandler = (topic: string, payload: Buffer) => void

export class MqttClient {
  private client: IMqttClient | null = null
  private status: ConnectionStatus = 'DISCONNECTED'
  private messageHandlers: Map<string, MessageHandler[]> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private lastHeartbeat: Date = new Date()

  /**
   * 連接到 MQTT Broker
   */
  async connect(): Promise<void> {
    const config = getConfig()

    try {
      const brokerUrl = `${config.mqtt.useTls ? 'mqtts' : 'mqtt'}://${config.mqtt.brokerUrl}:${
        config.mqtt.port
      }`

      logger.info('正在連接 MQTT Broker...', { brokerUrl })

      this.status = 'CONNECTING'

      const clientOptions = {
        username: config.mqtt.username,
        password: config.mqtt.password,
        reconnectPeriod: config.mqtt.reconnectPeriod || 5000,
        clientId: `pickle-heaven-${config.siteId}-${Date.now()}`,
        clean: true,
        will: {
          topic: `${config.siteId}/gateway/status`,
          payload: JSON.stringify({
            status: 'OFFLINE',
            timestamp: new Date().toISOString(),
          }),
          qos: 1,
          retain: true,
        },
      }

      this.client = mqtt.connect(brokerUrl, clientOptions)

      // 事件處理
      this.client.on('connect', () => this.onConnect())
      this.client.on('disconnect', () => this.onDisconnect())
      this.client.on('message', (topic, payload) => this.onMessage(topic, payload))
      this.client.on('error', (error) => this.onError(error))

      // 等待連接完成
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MQTT 連接超時')), 10000)
        const checkConnection = () => {
          if (this.status === 'CONNECTED') {
            clearTimeout(timeout)
            resolve(true)
          } else {
            setTimeout(checkConnection, 100)
          }
        }
        checkConnection()
      })

      logger.info('MQTT Broker 已連接')
    } catch (error) {
      logger.error('MQTT 連接失敗', error as Error)
      this.status = 'ERROR'
      throw error
    }
  }

  /**
   * 訂閱控制命令主題
   */
  async subscribeToControlTopic(siteId: string): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT 客戶端未初始化')
    }

    const topic = `${siteId}/control/+/ctl`
    logger.info(`訂閱主題：${topic}`)

    this.client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        logger.error(`訂閱失敗：${topic}`, error)
      } else {
        logger.info(`已訂閱：${topic}`)
      }
    })
  }

  /**
   * 發佈設備狀態
   */
  async publishStatus(
    circuitId: string,
    state: 'ON' | 'OFF',
    commandId?: string,
    details?: any
  ): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT 客戶端未初始化')
    }

    const config = getConfig()
    const topic = `${config.siteId}/control/${circuitId}/data`
    const payload = {
      circuitId,
      actualState: state,
      commandId,
      timestamp: new Date().toISOString(),
      status: 'ACKED',
      ...details,
    }

    this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        logger.error(`發佈狀態失敗：${topic}`, error)
      } else {
        logger.debug(`發佈狀態：${topic}`, { state, commandId })
      }
    })
  }

  /**
   * 發佈心跳信號
   */
  async publishHeartbeat(): Promise<void> {
    if (!this.client) return

    const config = getConfig()
    const topic = `${config.siteId}/gateway/heartbeat`
    const payload = {
      timestamp: new Date().toISOString(),
      status: 'ONLINE',
      version: '1.0.0',
    }

    this.client.publish(topic, JSON.stringify(payload), { qos: 0 })
    this.lastHeartbeat = new Date()
  }

  /**
   * 啟動心跳（定期發佈存活信號）
   */
  startHeartbeat(intervalSeconds: number = 30): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(() => {
      this.publishHeartbeat().catch((error) => {
        logger.error('心跳發佈失敗', error as Error)
      })
    }, intervalSeconds * 1000)

    logger.info(`心跳已啟動（間隔 ${intervalSeconds}s）`)
  }

  /**
   * 停止心跳
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      logger.info('心跳已停止')
    }
  }

  /**
   * 監聽特定消息
   */
  on(topic: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(topic)) {
      this.messageHandlers.set(topic, [])
    }
    this.messageHandlers.get(topic)!.push(handler)
  }

  /**
   * 斷開連接
   */
  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      this.stopHeartbeat()

      if (this.client) {
        this.client.end(true, () => {
          logger.info('MQTT 客戶端已斷開')
          this.client = null
          this.status = 'DISCONNECTED'
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * 取得連接狀態
   */
  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * 取得最後一次心跳時間
   */
  getLastHeartbeat(): Date {
    return this.lastHeartbeat
  }

  // ─────────────────────────────────────────
  // 私有事件處理
  // ─────────────────────────────────────────

  private onConnect(): void {
    this.status = 'CONNECTED'
    logger.info('MQTT 客戶端已連接')

    // 訂閱控制主題
    const config = getConfig()
    this.subscribeToControlTopic(config.siteId).catch((error) => {
      logger.error('訂閱失敗', error as Error)
    })

    // 啟動心跳
    this.startHeartbeat(config.watchdog.heartbeatIntervalSeconds)

    // 發佈上線狀態
    this.publishOnlineStatus()
  }

  private onDisconnect(): void {
    this.status = 'DISCONNECTED'
    logger.warn('MQTT 客戶端已斷開（將自動重連）')
  }

  private onMessage(topic: string, payload: Buffer): void {
    logger.debug(`收到消息：${topic}`, { payloadSize: payload.length })

    // 觸發所有匹配的處理器（包括通配符）
    for (const [pattern, handlers] of this.messageHandlers.entries()) {
      if (this.topicMatches(topic, pattern)) {
        handlers.forEach((handler) => {
          try {
            handler(topic, payload)
          } catch (error) {
            logger.error(`消息處理器錯誤：${pattern}`, error as Error)
          }
        })
      }
    }
  }

  private onError(error: Error): void {
    this.status = 'ERROR'
    logger.error('MQTT 客戶端錯誤', error)
  }

  private publishOnlineStatus(): void {
    const config = getConfig()
    const topic = `${config.siteId}/gateway/status`
    const payload = {
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }

    this.client?.publish(topic, JSON.stringify(payload), { qos: 1, retain: true })
  }

  /**
   * MQTT 主題萬用字元匹配（簡化版）
   * 支持 `+` 單層、`#` 多層
   */
  private topicMatches(topic: string, pattern: string): boolean {
    const topicParts = topic.split('/')
    const patternParts = pattern.split('/')

    for (let i = 0; i < patternParts.length; i++) {
      const part = patternParts[i]

      if (part === '#') {
        return true // 多層萬用字元匹配所有剩餘部分
      }

      if (part === '+') {
        if (i >= topicParts.length) return false
        continue // 單層萬用字元跳過
      }

      if (part !== topicParts[i]) {
        return false // 精確匹配失敗
      }
    }

    return topicParts.length === patternParts.length
  }
}

export const mqttClient = new MqttClient()
