import 'server-only'
import { prisma as prismaBase } from '@/lib/db'
import { now } from '@/lib/time'
import { executeScheduleActivation, executeScheduleDeactivation } from './door-schedule-executor'

const prisma = prismaBase as any

export class DoorScheduleError extends Error {}

/**
 * 排程狀態：SCHEDULED（待開始）→ ACTIVE（啟用中）→ COMPLETED（已完成）
 * 或 SCHEDULED → CANCELLED（已取消）
 */
export type AccessScheduleStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface CreateScheduleInput {
  venueId: string
  doorId: string
  scheduleName: string
  startAt: Date
  endAt: Date
  reason: string
  notes?: string
  createdBy: string
}

export interface UpdateScheduleInput {
  scheduleName?: string
  reason?: string
  notes?: string
  enabled?: boolean
}

/**
 * 驗證排程時間範圍
 */
export function validateScheduleTimeRange(startAt: Date, endAt: Date): { valid: boolean; error?: string } {
  const now = new Date()

  if (startAt >= endAt) return { valid: false, error: '開始時間必須早於結束時間' }
  if (startAt <= now) return { valid: false, error: '開始時間不能早於現在' }

  // 檢查時間範圍是否過長（最多 30 天）
  const durationMs = endAt.getTime() - startAt.getTime()
  const maxMs = 30 * 24 * 60 * 60 * 1000
  if (durationMs > maxMs) return { valid: false, error: '排程時間範圍不能超過 30 天' }

  return { valid: true }
}

/**
 * 建立排程
 */
export async function createAccessSchedule(input: CreateScheduleInput): Promise<any> {
  // 驗證時間範圍
  const timeValidation = validateScheduleTimeRange(input.startAt, input.endAt)
  if (!timeValidation.valid) {
    throw new DoorScheduleError(timeValidation.error!)
  }

  // 檢查排程衝突
  const conflict = await prisma.doorAccessSchedule.findFirst({
    where: {
      doorId: input.doorId,
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      OR: [
        // 新排程的開始時間在既有排程期間內
        { startAt: { lte: input.startAt }, endAt: { gte: input.startAt } },
        // 新排程的結束時間在既有排程期間內
        { startAt: { lte: input.endAt }, endAt: { gte: input.endAt } },
        // 新排程完全包含既有排程
        { startAt: { gte: input.startAt }, endAt: { lte: input.endAt } },
      ],
    },
  })

  if (conflict) {
    throw new DoorScheduleError(`該設備在 ${conflict.startAt.toISOString()} 至 ${conflict.endAt.toISOString()} 期間已有排程`)
  }

  const schedule = await prisma.doorAccessSchedule.create({
    data: {
      venueId: input.venueId,
      doorId: input.doorId,
      scheduleName: input.scheduleName,
      startAt: input.startAt,
      endAt: input.endAt,
      reason: input.reason,
      notes: input.notes,
      status: 'SCHEDULED',
      enabled: true,
      createdBy: input.createdBy,
    },
  })

  // 記錄稽核日誌
  await prisma.auditLog.create({
    data: {
      actor: input.createdBy,
      action: 'access.schedule.create',
      target: `schedule:${schedule.id}`,
      detail: {
        scheduleName: schedule.scheduleName,
        doorId: schedule.doorId,
        startAt: schedule.startAt.toISOString(),
        endAt: schedule.endAt.toISOString(),
        reason: schedule.reason,
      },
    },
  })

  return schedule
}

/**
 * 查詢排程清單
 */
export async function listAccessSchedules(
  venueId: string,
  doorId: string,
  filters?: { status?: AccessScheduleStatus; enabled?: boolean }
): Promise<any[]> {
  const where: any = {
    venueId,
    doorId,
  }

  if (filters?.status) where.status = filters.status
  if (filters?.enabled !== undefined) where.enabled = filters.enabled

  return prisma.doorAccessSchedule.findMany({
    where,
    orderBy: { startAt: 'asc' },
    take: 100,
  })
}

/**
 * 查詢單筆排程
 */
export async function getAccessSchedule(scheduleId: string): Promise<any | null> {
  return prisma.doorAccessSchedule.findUnique({
    where: { id: scheduleId },
  })
}

/**
 * 更新排程
 */
export async function updateAccessSchedule(
  scheduleId: string,
  input: UpdateScheduleInput
): Promise<any> {
  const schedule = await getAccessSchedule(scheduleId)
  if (!schedule) {
    throw new DoorScheduleError('排程不存在')
  }

  if (schedule.status !== 'SCHEDULED') {
    throw new DoorScheduleError('只能編輯待開始的排程')
  }

  return prisma.doorAccessSchedule.update({
    where: { id: scheduleId },
    data: {
      scheduleName: input.scheduleName ?? schedule.scheduleName,
      reason: input.reason ?? schedule.reason,
      notes: input.notes ?? schedule.notes,
      enabled: input.enabled !== undefined ? input.enabled : schedule.enabled,
    },
  })
}

/**
 * 取消排程
 */
export async function cancelAccessSchedule(
  scheduleId: string,
  cancelledBy: string,
  reason: string
): Promise<any> {
  const schedule = await getAccessSchedule(scheduleId)
  if (!schedule) {
    throw new DoorScheduleError('排程不存在')
  }

  if (schedule.status === 'COMPLETED' || schedule.status === 'CANCELLED') {
    throw new DoorScheduleError('已完成或已取消的排程無法再次取消')
  }

  // 如果排程正在 ACTIVE 狀態，先關閉門禁
  if (schedule.status === 'ACTIVE') {
    await executeScheduleDeactivation(schedule, 'CANCELLED')
  }

  const updated = await prisma.doorAccessSchedule.update({
    where: { id: scheduleId },
    data: {
      status: 'CANCELLED',
      cancelledBy,
      cancelledAt: now(),
      cancellationReason: reason,
    },
  })

  // 記錄稽核日誌
  await prisma.auditLog.create({
    data: {
      actor: cancelledBy,
      action: 'access.schedule.cancel',
      target: `schedule:${scheduleId}`,
      detail: {
        scheduleName: updated.scheduleName,
        reason: reason,
        previousStatus: schedule.status,
      },
    },
  })

  return updated
}

/**
 * 提前終止排程（停止常開）
 */
export async function terminateAccessSchedule(
  scheduleId: string,
  terminatedBy: string,
  reason: string
): Promise<any> {
  const schedule = await getAccessSchedule(scheduleId)
  if (!schedule) {
    throw new DoorScheduleError('排程不存在')
  }

  if (schedule.status !== 'ACTIVE') {
    throw new DoorScheduleError('只能終止啟用中的排程')
  }

  // 執行門禁關閉
  await executeScheduleDeactivation(schedule, 'COMPLETED')

  const updated = await prisma.doorAccessSchedule.update({
    where: { id: scheduleId },
    data: {
      status: 'COMPLETED',
      cancelledBy: terminatedBy,
      cancelledAt: now(),
      cancellationReason: `提前終止：${reason}`,
    },
  })

  // 記錄稽核日誌
  await prisma.auditLog.create({
    data: {
      actor: terminatedBy,
      action: 'access.schedule.terminate',
      target: `schedule:${scheduleId}`,
      detail: {
        scheduleName: updated.scheduleName,
        reason: reason,
        previousStatus: schedule.status,
      },
    },
  })

  return updated
}

/**
 * 定時更新排程狀態
 * 應由後端定時任務（Cron）調用，而不是前端或 HTTP 請求觸發
 */
export async function updateScheduleStatuses() {
  const currentTime = now()

  // 啟動待開始的排程
  const toActivate = await prisma.doorAccessSchedule.findMany({
    where: {
      status: 'SCHEDULED',
      enabled: true,
      startAt: { lte: currentTime },
    },
  })

  const activationResults = []
  for (const schedule of toActivate) {
    // 執行門禁開啟
    const execution = await executeScheduleActivation(schedule)
    activationResults.push(execution)

    // 更新排程狀態為 ACTIVE
    await prisma.doorAccessSchedule.update({
      where: { id: schedule.id },
      data: {
        status: 'ACTIVE',
        lastStatusUpdate: currentTime,
      },
    })
  }

  // 完成已結束的排程
  const toComplete = await prisma.doorAccessSchedule.findMany({
    where: {
      status: 'ACTIVE',
      endAt: { lte: currentTime },
    },
  })

  const completionResults = []
  for (const schedule of toComplete) {
    // 執行門禁關閉
    const execution = await executeScheduleDeactivation(schedule, 'COMPLETED')
    completionResults.push(execution)

    // 更新排程狀態為 COMPLETED
    await prisma.doorAccessSchedule.update({
      where: { id: schedule.id },
      data: {
        status: 'COMPLETED',
        lastStatusUpdate: currentTime,
      },
    })
  }

  return {
    activated: toActivate.length,
    completed: toComplete.length,
    activationResults,
    completionResults,
  }
}

/**
 * 取得當前常開狀態
 */
export async function getCurrentScheduleStatus(doorId: string): Promise<any | null> {
  const currentTime = now()

  return prisma.doorAccessSchedule.findFirst({
    where: {
      doorId,
      status: 'ACTIVE',
      startAt: { lte: currentTime },
      endAt: { gte: currentTime },
      enabled: true,
    },
    orderBy: { startAt: 'desc' },
  })
}
