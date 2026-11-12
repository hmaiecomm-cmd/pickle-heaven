/**
 * 配置管理 — 環境變數與設定檔
 */

import fs from 'fs'
import path from 'path'
import { logger } from './logger.js'

export interface MqttConfig {
  brokerUrl: string
  port: number
  useTls: boolean
  username?: string
  password?: string
  tlsCertPath?: string
  tlsKeyPath?: string
  tlsCaPath?: string
  reconnectPeriod: number
}

export interface RS485Config {
  port: string // /dev/ttyUSB0 或 COM3
  baudRate: number
  dataBits: 8 | 7 | 6 | 5
  stopBits: 1 | 2
  parity: 'none' | 'even' | 'odd'
  timeout: number // 毫秒
}

export interface SimulationConfig {
  enabled: boolean
  mockRS485: boolean
  mockMqttBroker: boolean
  delayMs: number
}

export interface GatewayAgentConfig {
  siteId: string
  timezone: string
  environment: 'production' | 'simulation'
  mqtt: MqttConfig
  rs485: RS485Config
  devices: Record<string, any> // 設備映射
  simulation: SimulationConfig
  persistence: {
    dbPath: string
    maxQueueSize: number
  }
  watchdog: {
    enabled: boolean
    heartbeatIntervalSeconds: number
    healthCheckIntervalSeconds: number
  }
}

class ConfigManager {
  private config: GatewayAgentConfig | null = null
  private configPath: string

  constructor() {
    this.configPath = process.env.CONFIG_PATH || './config/device-mapping.json'
  }

  /**
   * 載入配置檔案
   */
  load(): GatewayAgentConfig {
    if (this.config) {
      return this.config
    }

    try {
      // 1. 嘗試從檔案讀取
      const content = fs.readFileSync(this.configPath, 'utf-8')
      const rawConfig = JSON.parse(content)

      // 2. 與環境變數合併
      this.config = this.mergeWithEnv(rawConfig)

      logger.info('配置已載入', {
        siteId: this.config.siteId,
        environment: this.config.environment,
      })

      return this.config
    } catch (error) {
      logger.error('載入配置檔案失敗', { error, configPath: this.configPath })
      throw new Error(`無法載入配置檔案: ${this.configPath}`)
    }
  }

  /**
   * 與環境變數合併（環境變數優先）
   */
  private mergeWithEnv(fileConfig: any): GatewayAgentConfig {
    return {
      siteId: process.env.SITE_ID || fileConfig.siteId,
      timezone: process.env.TIMEZONE || fileConfig.timezone || 'Asia/Taipei',
      environment: (process.env.NODE_ENV as any) || 'production',

      mqtt: {
        brokerUrl: process.env.MQTT_BROKER_URL || fileConfig.mqtt?.brokerUrl || 'localhost',
        port: parseInt(process.env.MQTT_PORT || fileConfig.mqtt?.port || '1883'),
        useTls: process.env.MQTT_TLS === 'true' || fileConfig.mqtt?.useTls || false,
        username: process.env.MQTT_USERNAME || fileConfig.mqtt?.username,
        password: process.env.MQTT_PASSWORD || fileConfig.mqtt?.password,
        tlsCertPath: process.env.MQTT_TLS_CERT || fileConfig.mqtt?.tlsCertPath,
        tlsKeyPath: process.env.MQTT_TLS_KEY || fileConfig.mqtt?.tlsKeyPath,
        tlsCaPath: process.env.MQTT_TLS_CA || fileConfig.mqtt?.tlsCaPath,
        reconnectPeriod: 5000,
      },

      rs485: {
        port: process.env.RS485_PORT || fileConfig.rs485?.port || '/dev/ttyUSB0',
        baudRate: parseInt(process.env.RS485_BAUD || fileConfig.rs485?.baudRate || '9600'),
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        timeout: 2000,
      },

      devices: fileConfig.devices || {},

      simulation: {
        enabled: process.env.SIMULATION_MODE === 'true' || fileConfig.simulation?.enabled || false,
        mockRS485: process.env.MOCK_RS485 === 'true' || fileConfig.simulation?.mockRS485 || false,
        mockMqttBroker: process.env.MOCK_MQTT === 'true' || fileConfig.simulation?.mockMqttBroker || false,
        delayMs: parseInt(process.env.SIMULATION_DELAY || fileConfig.simulation?.delayMs || '100'),
      },

      persistence: {
        dbPath: process.env.DB_PATH || './data/gateway.db',
        maxQueueSize: 10000,
      },

      watchdog: {
        enabled: process.env.WATCHDOG_ENABLED !== 'false',
        heartbeatIntervalSeconds: parseInt(process.env.HEARTBEAT_INTERVAL || '30'),
        healthCheckIntervalSeconds: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60'),
      },
    }
  }

  /**
   * 驗證配置的完整性
   */
  validate(config: GatewayAgentConfig): boolean {
    const required = ['siteId', 'mqtt', 'rs485']

    for (const field of required) {
      if (!config[field as keyof GatewayAgentConfig]) {
        throw new Error(`缺失必需配置: ${field}`)
      }
    }

    return true
  }

  /**
   * 取得當前配置
   */
  getConfig(): GatewayAgentConfig {
    if (!this.config) {
      this.load()
    }
    return this.config!
  }
}

export const configManager = new ConfigManager()

/**
 * 便利函數：快速取得配置
 */
export function getConfig(): GatewayAgentConfig {
  return configManager.getConfig()
}
