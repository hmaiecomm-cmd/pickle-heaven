import 'server-only'
import { prisma as prismaBase } from '@/lib/db'
import { now } from '@/lib/time'
import { MAIN_DOOR } from '@/lib/door-devices'

const prisma = prismaBase as any

/**
 * 排程設備執行器：管理排程狀態轉換時的門禁控制
 *
 * 職責：
 * 1. SCHEDULED → ACTIVE：發送開門命令（常開狀態）
 * 2. ACTIVE → COMPLETED：發送關門命令
 * 3. 記錄執行結果到 executionLog
 * 4. 處理設備控制失敗的重試邏輯
 */

export class ScheduleExecutorError extends Error {}

export interface ScheduleExecution {
  scheduleId: string
  action: 'OPEN' | 'CLOSE'
  timestamp: Date
  success: boolean
  result?: string
  error?: string
}

/**
 * 門禁設備控制介面（預留 - 與 door-remote.ts 中的 DoorController 類似）
 */
export interface ScheduleDoorController {
  setDoorState(doorId: string, state: 'OPEN' | 'CLOSED', commandId: string): Promise<{ ok: true } | { ok: false; error: string }>
  getDoorState(doorId: string): Promise<'OPEN' | 'CLOSED' | 'UNKNOWN'>
}

/** 當前未實裝真實設備控制，Demo 模式使用模擬結果 */
function getScheduleController(): ScheduleDoorController | null {
  return null
}

/**
 * 當排程進入 ACTIVE 狀態時，開啟門禁
 */
export async function executeScheduleActivation(schedule: any): Promise<ScheduleExecution> {
  const controller = getScheduleController()
  const execution: ScheduleExecution = {
    scheduleId: schedule.id,
    action: 'OPEN',
    timestamp: now(),
    success: false,
  }

  try {
    if (controller) {
      // 真實設備控制
      const result = await controller.setDoorState(schedule.doorId, 'OPEN', `schedule-activate-${schedule.id}`)
      execution.success = result.ok
      if (result.ok) {
        execution.result = 'Door opened successfully'
      } else {
        execution.error = result.error
        execution.result = result.error
      }
    } else {
      // Demo 模式：模擬成功
      execution.success = true
      execution.result = '[DEMO] Door simulated to open'
    }

    // 更新排程的執行日誌
    const log = {
      event: execution.success ? 'activation_success' : 'activation_failed',
      action: 'OPEN',
      timestamp: execution.timestamp.toISOString(),
      result: execution.result,
      error: execution.error,
    }

    await prisma.doorAccessSchedule.update({
      where: { id: schedule.id },
      data: {
        executionLog: JSON.stringify(log),
        lastStatusUpdate: execution.timestamp,
      },
    })

    if (!execution.success) {
      console.warn(`[Door Schedule] 排程 ${schedule.scheduleName} 開啟失敗:`, execution.error)
    } else {
      console.log(`[Door Schedule] 排程 ${schedule.scheduleName} 已開啟`)
    }

    return execution
  } catch (error) {
    execution.success = false
    execution.error = error instanceof Error ? error.message : String(error)
    console.error(`[Door Schedule] 排程 ${schedule.id} 激活執行異常:`, error)
    return execution
  }
}

/**
 * 當排程退出 ACTIVE 狀態時（完成或取消），關閉門禁
 */
export async function executeScheduleDeactivation(schedule: any, reason: 'COMPLETED' | 'CANCELLED'): Promise<ScheduleExecution> {
  const controller = getScheduleController()
  const execution: ScheduleExecution = {
    scheduleId: schedule.id,
    action: 'CLOSE',
    timestamp: now(),
    success: false,
  }

  try {
    if (controller) {
      // 真實設備控制
      const result = await controller.setDoorState(schedule.doorId, 'CLOSED', `schedule-deactivate-${schedule.id}`)
      execution.success = result.ok
      if (result.ok) {
        execution.result = 'Door closed successfully'
      } else {
        execution.error = result.error
        execution.result = result.error
      }
    } else {
      // Demo 模式：模擬成功
      execution.success = true
      execution.result = '[DEMO] Door simulated to close'
    }

    // 更新排程的執行日誌
    const log = {
      event: execution.success ? 'deactivation_success' : 'deactivation_failed',
      action: 'CLOSE',
      reason: reason,
      timestamp: execution.timestamp.toISOString(),
      result: execution.result,
      error: execution.error,
    }

    await prisma.doorAccessSchedule.update({
      where: { id: schedule.id },
      data: {
        executionLog: JSON.stringify(log),
        lastStatusUpdate: execution.timestamp,
      },
    })

    if (!execution.success) {
      console.warn(`[Door Schedule] 排程 ${schedule.scheduleName} 關閉失敗:`, execution.error)
    } else {
      console.log(`[Door Schedule] 排程 ${schedule.scheduleName} 已關閉 (${reason})`)
    }

    return execution
  } catch (error) {
    execution.success = false
    execution.error = error instanceof Error ? error.message : String(error)
    console.error(`[Door Schedule] 排程 ${schedule.id} 停用執行異常:`, error)
    return execution
  }
}

/**
 * 檢查是否存在衝突的 ACTIVE 排程（多個排程同時開啟同一門禁）
 */
export async function checkScheduleConflicts(doorId: string, excludeScheduleId?: string): Promise<any[]> {
  const currentTime = now()
  const conflicts = await prisma.doorAccessSchedule.findMany({
    where: {
      doorId,
      status: 'ACTIVE',
      enabled: true,
      startAt: { lte: currentTime },
      endAt: { gte: currentTime },
      ...(excludeScheduleId && { NOT: { id: excludeScheduleId } }),
    },
    orderBy: { startAt: 'asc' },
  })
  return conflicts
}

/**
 * 獲取指定門禁當前的活躍排程
 */
export async function getActiveScheduleForDoor(doorId: string): Promise<any | null> {
  const currentTime = now()
  return prisma.doorAccessSchedule.findFirst({
    where: {
      doorId,
      status: 'ACTIVE',
      enabled: true,
      startAt: { lte: currentTime },
      endAt: { gte: currentTime },
    },
    orderBy: { startAt: 'desc' },
  })
}
