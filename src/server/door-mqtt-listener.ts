/**
 * 門禁 MQTT 命令監聽器
 *
 * 職責：
 * 1. 訂閱門禁相關的 MQTT topic
 * 2. 接收 Raspberry Pi 的命令確認與狀態回報
 * 3. 更新數據庫中的命令狀態
 * 4. 觸發後續業務邏輯
 */

import mqtt from 'mqtt'
import { db } from '@/lib/db'
import { RaspberryPiAdapter } from './raspberry-pi-adapter'

let mqttClient: mqtt.MqttClient | null = null
let piAdapter: RaspberryPiAdapter | null = null

// ─────── MQTT 連接 ───────

export async function initializeDoorMqttListener(): Promise<void> {
  try {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883'

    // 建立 MQTT 連接
    mqttClient = mqtt.connect(brokerUrl, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: `pickle-heaven-door-${Date.now()}`,
      clean: true,
      reconnectPeriod: 1000,
    })

    // 連接成功
    mqttClient.on('connect', () => {
      console.log('[Door MQTT] 已連接到 Broker')

      // 訂閱門禁相關的 topic
      subscribeToTopics()
    })

    // 斷開連接
    mqttClient.on('disconnect', () => {
      console.log('[Door MQTT] 與 Broker 斷開連接')
    })

    // 接收消息
    mqttClient.on('message', async (topic: string, payload: Buffer) => {
      await handleIncomingMessage(topic, payload)
    })

    // 錯誤處理
    mqttClient.on('error', (error: Error) => {
      console.error('[Door MQTT] 連接錯誤:', error)
    })

    // 初始化 Raspberry Pi 適配器
    // TODO: 從配置取得 RS-485 設置
    const rs485Config = {
      portName: '/dev/ttyUSB0',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none' as const,
      stationId: 1,
      protocolVersion: 'SOYAL_V1',
      timeout: 5000,
      retries: 3,
      checksumType: 'CRC' as const,
      polarityCheck: true,
      terminationResistor: 120,
    }

    piAdapter = new RaspberryPiAdapter(rs485Config)
    await piAdapter.initialize()

    console.log('[Door MQTT] 門禁系統已初始化')
  } catch (error) {
    console.error('[Door MQTT] 初始化失敗:', error)
    throw error
  }
}

// ─────── 主題訂閱 ───────

function subscribeToTopics(): void {
  if (!mqttClient) return

  const topics = [
    // Raspberry Pi 命令確認
    'Advantech/+/ack/user',
    'Advantech/+/ack/user/revoke',

    // Raspberry Pi 狀態回報
    'Advantech/+/status/user',
    'Advantech/+/status/system',

    // 控制器日誌
    'Advantech/+/log/access',
  ]

  topics.forEach((topic) => {
    mqttClient?.subscribe(topic, (error) => {
      if (error) {
        console.error(`[Door MQTT] 訂閱失敗: ${topic}`, error)
      } else {
        console.log(`[Door MQTT] 已訂閱: ${topic}`)
      }
    })
  })
}

// ─────── 消息處理 ───────

async function handleIncomingMessage(
  topic: string,
  payload: Buffer
): Promise<void> {
  try {
    const message = JSON.parse(payload.toString())

    console.log(`[Door MQTT] 收到消息 [${topic}]:`, message)

    // 路由到對應的處理器
    if (topic.includes('/ack/user')) {
      if (topic.includes('/revoke')) {
        await handleRevokeAck(message)
      } else {
        await handleProvisionAck(message)
      }
    } else if (topic.includes('/status/')) {
      await handleStatusReport(message)
    } else if (topic.includes('/log/access')) {
      await handleAccessLog(message)
    }
  } catch (error) {
    console.error('[Door MQTT] 解析消息失敗:', error)
  }
}

// ─────── 憑證設定確認 ───────

async function handleProvisionAck(message: {
  commandId: string
  success: boolean
  userSlotNumber?: number
  resultCode?: string
  resultMessage?: string
}): Promise<void> {
  try {
    // 查找命令
    const command = await db.doorAccessCommand.findUnique({
      where: { commandId: message.commandId },
      include: { accessSession: true },
    })

    if (!command) {
      console.warn('[Door] 找不到命令:', message.commandId)
      return
    }

    if (message.success) {
      // 更新命令為已確認
      await db.doorAccessCommand.update({
        where: { id: command.id },
        data: {
          ackedAt: new Date(),
          deviceStatus: 'ACCEPTED',
          deviceResponse: {
            userSlotNumber: message.userSlotNumber,
            resultCode: message.resultCode,
            resultMessage: message.resultMessage,
          },
          status: 'ACKED',
        },
      })

      // 更新會話
      if (message.userSlotNumber) {
        await db.accessSession.update({
          where: { id: command.accessSessionId },
          data: {
            userSlotNumber: message.userSlotNumber,
            credentialState: 'APPLIED',
            lastAppliedAt: new Date(),
          },
        })
      }

      console.log(`[Door] 憑證已套用: ${command.commandId}`)

      // 發送使用者通知
      // TODO: 呼叫通知服務
      // await notifyUserCredentialReady(command.accessSession)
    } else {
      // 命令失敗
      await db.doorAccessCommand.update({
        where: { id: command.id },
        data: {
          ackedAt: new Date(),
          deviceStatus: 'REJECTED',
          error: message.resultMessage || '控制器拒絕',
          status: 'FAILED',
        },
      })

      // 建立告警
      await db.credentialAlert.create({
        data: {
          venueId: command.accessSession.venueId,
          accessSessionId: command.accessSessionId,
          alertType: 'CONTROLLER_APPLY_FAILED',
          severity: 'ERROR',
          title: '控制器設定失敗',
          description: message.resultMessage || '未知原因',
          status: 'OPEN',
        },
      })

      console.error(`[Door] 憑證設定失敗: ${message.resultMessage}`)
    }
  } catch (error) {
    console.error('[Door] 處理確認消息失敗:', error)
  }
}

// ─────── 憑證撤銷確認 ───────

async function handleRevokeAck(message: {
  commandId: string
  success: boolean
  userSlotNumber?: number
  resultMessage?: string
}): Promise<void> {
  try {
    const command = await db.doorAccessCommand.findUnique({
      where: { commandId: message.commandId },
      include: { accessSession: true },
    })

    if (!command) return

    if (message.success) {
      // 撤銷成功
      await db.doorAccessCommand.update({
        where: { id: command.id },
        data: {
          ackedAt: new Date(),
          deviceStatus: 'ACCEPTED',
          status: 'ACKED',
        },
      })

      await db.accessSession.update({
        where: { id: command.accessSessionId },
        data: {
          credentialState: 'REVOKED',
          lastRevokedAt: new Date(),
        },
      })

      console.log(`[Door] 憑證已撤銷: ${command.commandId}`)
    } else {
      // 撤銷失敗
      await db.doorAccessCommand.update({
        where: { id: command.id },
        data: {
          ackedAt: new Date(),
          status: 'FAILED',
          error: message.resultMessage,
        },
      })

      // 建立告警
      await db.credentialAlert.create({
        data: {
          venueId: command.accessSession.venueId,
          accessSessionId: command.accessSessionId,
          alertType: 'CREDENTIAL_NOT_REVOKED',
          severity: 'ERROR',
          title: '憑證撤銷失敗',
          description: message.resultMessage || '控制器未能刪除憑證',
          status: 'OPEN',
        },
      })

      console.error(`[Door] 憑證撤銷失敗: ${message.resultMessage}`)
    }
  } catch (error) {
    console.error('[Door] 處理撤銷確認失敗:', error)
  }
}

// ─────── 系統狀態回報 ───────

async function handleStatusReport(message: {
  macId: string
  timestamp: string
  usedSlots: number
  availableSlots: number
  powerStatus: string
  batteryPercent?: number
  controllerTime: string
}): Promise<void> {
  try {
    // 更新設備適配器狀態
    await db.deviceAdapter.updateMany({
      where: { macId: message.macId },
      data: {
        connectionStatus: 'ONLINE',
        lastHeartbeat: new Date(),
      },
    })

    // 檢查時鐘漂移
    const serverTime = new Date()
    const controllerTime = new Date(message.controllerTime)
    const driftSeconds =
      Math.abs(serverTime.getTime() - controllerTime.getTime()) / 1000

    if (driftSeconds > 60) {
      console.warn(
        `[Door] 檢測到時鐘漂移: ${driftSeconds}秒，設備: ${message.macId}`
      )

      // TODO: 建立 Watchdog 告警
      // await db.credentialAlert.create({...})
    }

    // 檢查電源狀態
    if (message.powerStatus === 'BATTERY' || message.powerStatus === 'BATTERY_LOW') {
      console.warn(`[Door] 控制器使用電池電源: ${message.macId}`)
    }

    console.log(`[Door] 狀態已更新: ${message.macId}`)
  } catch (error) {
    console.error('[Door] 處理狀態回報失敗:', error)
  }
}

// ─────── 訪問日誌 ───────

async function handleAccessLog(message: {
  macId: string
  logs: Array<{
    timestamp: string
    userSlotNumber: number
    method: string
    result: string
    doorState: string
  }>
}): Promise<void> {
  try {
    for (const logEntry of message.logs) {
      // 查找對應的會話
      const accessSession = await db.accessSession.findFirst({
        where: {
          controllerMacId: message.macId,
          userSlotNumber: logEntry.userSlotNumber,
          validFromUtc: {
            lte: new Date(logEntry.timestamp),
          },
          validUntilUtc: {
            gte: new Date(logEntry.timestamp),
          },
        },
      })

      if (accessSession) {
        // 建立訪問日誌
        await db.accessLog.create({
          data: {
            accessSessionId: accessSession.id,
            venueId: accessSession.venueId,
            controllerMacId: message.macId,
            attemptAt: new Date(logEntry.timestamp),
            accessStatus: logEntry.result === 'GRANTED' ? 'GRANTED' : 'DENIED',
            accessMethod: logEntry.method,
            doorState: logEntry.doorState,
          },
        })
      }
    }

    console.log(
      `[Door] 已記錄 ${message.logs.length} 條訪問日誌，設備: ${message.macId}`
    )
  } catch (error) {
    console.error('[Door] 處理訪問日誌失敗:', error)
  }
}

// ─────── 發送命令 ───────

export async function publishDoorCommand(
  topic: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!mqttClient) {
    throw new Error('MQTT 客戶端未初始化')
  }

  return new Promise((resolve, reject) => {
    mqttClient!.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
      if (error) {
        console.error('[Door MQTT] 發送失敗:', error)
        reject(error)
      } else {
        console.log(`[Door MQTT] 已發送 [${topic}]`)
        resolve()
      }
    })
  })
}

// ─────── 關閉 ───────

export async function closeDoorMqttListener(): Promise<void> {
  return new Promise((resolve) => {
    if (mqttClient) {
      mqttClient.end(true, () => {
        console.log('[Door MQTT] 已斷開連接')
        resolve()
      })
    } else {
      resolve()
    }

    if (piAdapter) {
      piAdapter.shutdown()
    }
  })
}

// ─────── 匯出 ───────

export const DoorMqttListener = {
  initializeDoorMqttListener,
  publishDoorCommand,
  closeDoorMqttListener,
}
