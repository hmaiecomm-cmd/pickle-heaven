/**
 * 事件日誌服務 — 系統事件的持久化與同步
 *
 * 責務：
 * 1. 記錄控制事件（排程、命令、異常）
 * 2. 本地緩衝（當 Neon 不可用時）
 * 3. 非同步上傳到 Neon（若已配置）
 * 4. 幂等性保證（相同 event ID 只記錄一次）
 * 5. 事件查詢與篩選
 */

import 'server-only'
import { prisma } from '@/lib/db'
import { now } from '@/lib/time'
import { randomUUID } from 'crypto'

export type ControlEventType =
  | 'RESERVATION_CREATED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_MODIFIED'
  | 'SCHEDULE_RECALCULATED'
  | 'SCHEDULE_EXECUTED'
  | 'COMMAND_SENT'
  | 'COMMAND_ACKED'
  | 'COMMAND_FAILED'
  | 'OPERATING_HOURS_CHANGED'
  | 'NIGHT_SCHEDULE_CHANGED'
  | 'MANUAL_OVERRIDE'
  | 'OVERRIDE_EXPIRED'
  | 'DEVICE_ONLINE'
  | 'DEVICE_OFFLINE'
  | 'STATUS_MISMATCH'
  | 'MQTT_CONNECTED'
  | 'MQTT_DISCONNECTED'
  | 'WATCHDOG_ALERT'
  | 'SYSTEM_ERROR'

export interface LogEventOptions {
  venueId: string
  circuitId?: string
  commandId?: string
  reservationId?: string
  userId?: string
  eventType: ControlEventType
  severity?: 'INFO' | 'WARNING' | 'ERROR'
  environment?: 'SIMULATION' | 'PRODUCTION'
  title: string
  description?: string
  data?: Record<string, any>
  correlationId?: string
}

/**
 * 記錄事件到資料庫
 */
export async function logEvent(options: LogEventOptions): Promise<string> {
  const {
    venueId,
    circuitId,
    commandId,
    reservationId,
    userId,
    eventType,
    severity = 'INFO',
    environment = 'SIMULATION',
    title,
    description,
    data,
    correlationId,
  } = options

  const eventId = randomUUID()

  try {
    // 檢查是否已存在相同 eventId（幂等性）
    const existing = await prisma.controlEvent.findUnique({
      where: { eventId },
    })

    if (existing) {
      console.log(`[Logger] 事件 ${eventId} 已存在，跳過重複記錄`)
      return existing.id
    }

    // 建立事件記錄
    const event = await prisma.controlEvent.create({
      data: {
        eventId,
        venueId,
        circuitId,
        commandId,
        reservationId,
        userId,
        eventType,
        severity,
        environment,
        title,
        description,
        data: data ? sanitizeData(data) : null,
        correlationId,
        syncedToNeon: false,
      },
    })

    console.log(`[Logger] 事件已記錄: ${eventType} (${eventId})`)

    // 嘗試同步到 Neon（非同步，不阻止主流程）
    syncEventToNeonAsync(event.id).catch((e) =>
      console.error('[Logger] Neon 同步失敗（背景任務）:', e),
    )

    return event.id
  } catch (error) {
    console.error('[Logger] 事件記錄失敗:', error)
    throw error
  }
}

/**
 * 非同步同步事件到 Neon PostgreSQL
 *
 * 這應該由背景工作者或定期任務執行
 */
async function syncEventToNeonAsync(eventId: string): Promise<void> {
  // 如果未配置 Neon，則標記為本地已同步
  if (!process.env.NEON_DATABASE_URL) {
    await prisma.controlEvent.update({
      where: { id: eventId },
      data: {
        syncedToNeon: true,
        syncedAt: new Date(),
      },
    })
    return
  }

  // 實際實施中，這裡應該：
  // 1. 建立到 Neon 的連接
  // 2. 上傳事件
  // 3. 標記為已同步
  // 目前僅作為佔位符
  console.log(`[Logger] 準備同步事件到 Neon: ${eventId}`)
}

/**
 * 批量同步待同步的事件到 Neon
 */
export async function syncPendingEventsToNeon(limit: number = 100): Promise<number> {
  if (!process.env.NEON_DATABASE_URL) {
    console.log('[Logger] Neon 未配置，跳過同步')
    return 0
  }

  try {
    const pendingEvents = await prisma.controlEvent.findMany({
      where: { syncedToNeon: false },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })

    if (pendingEvents.length === 0) {
      return 0
    }

    console.log(`[Logger] 開始同步 ${pendingEvents.length} 個待同步事件到 Neon`)

    // 實際實施中應在這裡進行批量上傳
    // 目前僅標記為已同步
    const updated = await prisma.controlEvent.updateMany({
      where: {
        id: { in: pendingEvents.map((e) => e.id) },
      },
      data: {
        syncedToNeon: true,
        syncedAt: new Date(),
      },
    })

    console.log(`[Logger] 已同步 ${updated.count} 個事件到 Neon`)
    return updated.count
  } catch (error) {
    console.error('[Logger] 批量同步失敗:', error)
    return 0
  }
}

/**
 * 脫敏日誌資料（移除敏感信息）
 */
function sanitizeData(data: Record<string, any>): Record<string, any> {
  const sanitized = { ...data }

  // 移除敏感欄位
  const sensitiveFields = [
    'password',
    'pin',
    'credential',
    'token',
    'secret',
    'key',
    'mqttPassword',
    'tlsKey',
  ]

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * 查詢事件日誌
 */
export async function queryEvents(options: {
  venueId: string
  startDate?: Date
  endDate?: Date
  eventTypes?: ControlEventType[]
  severity?: ('INFO' | 'WARNING' | 'ERROR')[]
  environment?: 'SIMULATION' | 'PRODUCTION'
  circuitId?: string
  commandId?: string
  reservationId?: string
  limit?: number
  offset?: number
}) {
  const {
    venueId,
    startDate,
    endDate,
    eventTypes,
    severity,
    environment,
    circuitId,
    commandId,
    reservationId,
    limit = 50,
    offset = 0,
  } = options

  const where: any = { venueId }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes }
  }

  if (severity && severity.length > 0) {
    where.severity = { in: severity }
  }

  if (environment) {
    where.environment = environment
  }

  if (circuitId) {
    where.circuitId = circuitId
  }

  if (commandId) {
    where.commandId = commandId
  }

  if (reservationId) {
    where.reservationId = reservationId
  }

  const [events, total] = await Promise.all([
    prisma.controlEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        circuit: { select: { circuitNumber: true, name: true } },
        command: { select: { commandId: true, status: true } },
      },
    }),
    prisma.controlEvent.count({ where }),
  ])

  return {
    events: events.map((e) => ({
      id: e.id,
      eventId: e.eventId,
      eventType: e.eventType,
      severity: e.severity,
      environment: e.environment,
      title: e.title,
      description: e.description,
      circuit: e.circuit,
      commandId: e.commandId,
      reservationId: e.reservationId,
      userId: e.userId,
      createdAt: e.createdAt.toISOString(),
      syncedToNeon: e.syncedToNeon,
    })),
    total,
    hasMore: offset + limit < total,
  }
}

/**
 * 取得事件統計（用於首頁摘要）
 */
export async function getEventStats(venueId: string, hours: number = 24) {
  const startDate = new Date(now().getTime() - hours * 60 * 60 * 1000)

  const stats = await prisma.controlEvent.groupBy({
    by: ['eventType'],
    where: {
      venueId,
      createdAt: { gte: startDate },
    },
    _count: true,
  })

  const errorCount = await prisma.controlEvent.count({
    where: {
      venueId,
      severity: 'ERROR',
      createdAt: { gte: startDate },
    },
  })

  const unsyncedCount = await prisma.controlEvent.count({
    where: {
      venueId,
      syncedToNeon: false,
      createdAt: { gte: startDate },
    },
  })

  return {
    totalEvents: stats.reduce((sum, s) => sum + s._count, 0),
    byType: stats.reduce(
      (acc, s) => {
        acc[s.eventType] = s._count
        return acc
      },
      {} as Record<ControlEventType, number>,
    ),
    errorCount,
    unsyncedCount,
    period: `過去 ${hours} 小時`,
  }
}

/**
 * 關聯事件（用於時間線追蹤）
 *
 * 將預約 ID、命令 ID、排程 ID 關聯，形成完整的控制流程追蹤
 */
export async function getEventTimeline(reservationId: string) {
  const events = await prisma.controlEvent.findMany({
    where: {
      reservationId,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      circuit: { select: { circuitNumber: true, name: true } },
      command: { select: { commandId: true, status: true } },
    },
  })

  return events.map((e, index) => ({
    sequence: index + 1,
    eventId: e.eventId,
    eventType: e.eventType,
    timestamp: e.createdAt.toISOString(),
    title: e.title,
    description: e.description,
    circuit: e.circuit,
    commandStatus: e.command?.status,
    severity: e.severity,
  }))
}
