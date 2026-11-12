/**
 * Pickle Heaven Gateway Agent — 主入口
 *
 * 初始化順序：
 * 1. 載入配置
 * 2. 初始化日誌系統
 * 3. 連接 MQTT Broker
 * 4. 初始化 RS-485 適配器
 * 5. 啟動 Watchdog 監控
 * 6. 訂閱控制命令
 * 7. 進入事件循環
 */

import 'dotenv/config'
import { logger } from './logger.js'
import { configManager, getConfig } from './config.js'
import { mqttClient } from './mqtt-client.js'
import { rs485Adapter } from './rs485-adapter.js'
import { commandProcessor } from './command-processor.js'
import { watchdog } from './watchdog.js'

const VERSION = '1.0.0'

/**
 * 主程式入口
 */
async function main(): Promise<void> {
  try {
    logger.info('╔═══════════════════════════════════════════════════════════╗')
    logger.info('║  Pickle Heaven Gateway Agent                               ║')
    logger.info(`║  版本: ${VERSION}                                                 ║`)
    logger.info('╚═══════════════════════════════════════════════════════════╝')

    // ─────────────────────────────────────────
    // 1️⃣ 載入配置
    // ─────────────────────────────────────────

    logger.info('載入配置...')
    const config = getConfig()
    configManager.validate(config)

    logger.info('✓ 配置已驗證', {
      siteId: config.siteId,
      environment: config.environment,
      rs485Port: config.rs485.port,
      mqttBroker: `${config.mqtt.brokerUrl}:${config.mqtt.port}`,
    })

    // ─────────────────────────────────────────
    // 2️⃣ 連接 MQTT Broker
    // ─────────────────────────────────────────

    logger.info('連接 MQTT Broker...')
    await mqttClient.connect()

    // ─────────────────────────────────────────
    // 3️⃣ 初始化 RS-485 適配器
    // ─────────────────────────────────────────

    logger.info('初始化 RS-485 適配器...')
    await rs485Adapter.connect()

    // ─────────────────────────────────────────
    // 4️⃣ 啟動 Watchdog 監控
    // ─────────────────────────────────────────

    logger.info('啟動 Watchdog 監控...')
    watchdog.start(config.watchdog.healthCheckIntervalSeconds)

    // ─────────────────────────────────────────
    // 5️⃣ 訂閱控制命令
    // ─────────────────────────────────────────

    logger.info('訂閱控制命令...')
    await mqttClient.subscribeToControlTopic(config.siteId)

    // 設置控制命令消息處理器
    mqttClient.on(`${config.siteId}/control/+/ctl`, (topic: string, payload: Buffer) => {
      handleControlCommand(topic, payload)
    })

    // ─────────────────────────────────────────
    // 6️⃣ 定期發佈健康狀態
    // ─────────────────────────────────────────

    setInterval(async () => {
      try {
        await watchdog.publishHealthStatus()
      } catch (error) {
        logger.error('發佈健康狀態失敗', error as Error)
      }
    }, 60000) // 每分鐘發佈一次

    logger.info('╔═══════════════════════════════════════════════════════════╗')
    logger.info('║  ✓ Gateway Agent 已啟動                                     ║')
    logger.info('║  等待控制命令...                                             ║')
    logger.info('╚═══════════════════════════════════════════════════════════╝')

    // 保持進程運行
    await new Promise(() => {}) // 永不 resolve
  } catch (error) {
    logger.error('致命錯誤', error as Error)
    process.exit(1)
  }
}

/**
 * 處理控制命令
 */
async function handleControlCommand(topic: string, payload: Buffer): Promise<void> {
  const config = getConfig()

  try {
    // 解析命令
    const commandPayload = JSON.parse(payload.toString())

    logger.info('收到控制命令', {
      module: 'main',
      commandId: commandPayload.commandId,
      circuitId: commandPayload.circuitId,
      targetState: commandPayload.targetState,
    })

    // 記錄命令執行
    watchdog.recordCommandExecution(commandPayload.commandId)

    // 處理命令
    const result = await commandProcessor.processCommand(commandPayload)

    if (!result.success) {
      logger.error('命令處理失敗', {
        module: 'main',
        commandId: commandPayload.commandId,
        error: result.error,
      })
      watchdog.recordCommandFailure(commandPayload.commandId)
      return
    }

    // 發送 RS-485 訊號
    if (result.result?.rs485Signal) {
      try {
        await rs485Adapter.send(result.result.rs485Signal)

        // 接收設備回報
        const response = await rs485Adapter.receive(config.rs485.timeout)

        // 解析回報
        const parsedResponse = rs485Adapter.parseModbusRTUResponse(response)

        if (!parsedResponse.success) {
          logger.error('設備回報解析失敗', {
            module: 'main',
            commandId: commandPayload.commandId,
            error: parsedResponse.error,
          })
          watchdog.recordStatusMismatch()
          return
        }

        // 發佈狀態到 MQTT
        await mqttClient.publishStatus(
          commandPayload.circuitId,
          commandPayload.targetState,
          commandPayload.commandId,
          {
            executionTimeMs: result.result.executionTimeMs,
            deviceResponse: parsedResponse,
          }
        )

        logger.logCommand(
          commandPayload.commandId,
          commandPayload.circuitId,
          '命令已成功執行',
          {
            deviceStatus: parsedResponse.coilValue,
            executionTimeMs: result.result.executionTimeMs,
          }
        )
      } catch (error) {
        logger.error('RS-485 通訊失敗', error as Error, {
          module: 'main',
          commandId: commandPayload.commandId,
        })
        watchdog.recordCommandFailure(commandPayload.commandId)
      }
    }
  } catch (error) {
    logger.error('命令處理異常', error as Error, {
      module: 'main',
      topic,
      payloadSize: payload.length,
    })
  }
}

/**
 * 優雅關閉
 */
async function gracefulShutdown(): Promise<void> {
  logger.info('正在進行優雅關閉...')

  watchdog.stop()
  await mqttClient.disconnect()
  await rs485Adapter.disconnect()

  logger.info('Gateway Agent 已停止')
  process.exit(0)
}

// 捕捉關閉信號
process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)

// 未捕捉的異常
process.on('uncaughtException', (error) => {
  logger.error('未捕捉的異常', error)
  gracefulShutdown()
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未處理的 Promise 拒絕', reason as Error)
  gracefulShutdown()
})

// 啟動
main()
