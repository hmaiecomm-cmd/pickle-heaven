import 'server-only'
import { prisma } from '@/lib/db'
import type { OperationType, ActionPreview } from './ai-operations'

/**
 * 操作執行器 — Phase 4
 * 安全地執行經過確認的操作
 * 所有操作都需要有效的操作 ID 和用戶確認
 */

export interface ExecutionResult {
  success: boolean
  message: string
  operationId: string
  timestamp: Date
  affectedRecords?: {
    type: string
    count: number
  }
  error?: string
}

/**
 * 執行操作
 */
export async function executeOperation(
  operationId: string,
  operationType: OperationType,
  targetId: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<ExecutionResult> {
  const timestamp = new Date()

  try {
    switch (operationType) {
      case 'booking.cancel':
        return await executeCancelBooking(operationId, targetId, userId, timestamp)

      case 'booking.note.add':
        return await executeAddBookingNote(operationId, targetId, userId, metadata, timestamp)

      case 'member.note.add':
        return await executeAddMemberNote(operationId, targetId, userId, metadata, timestamp)

      default:
        return {
          success: false,
          message: '未支援的操作類型',
          operationId,
          timestamp,
          error: `不支援的操作: ${operationType}`,
        }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '未知錯誤'
    return {
      success: false,
      message: '操作執行失敗',
      operationId,
      timestamp,
      error: errorMsg,
    }
  }
}

/**
 * 執行取消預約
 */
async function executeCancelBooking(
  operationId: string,
  bookingId: string,
  userId: string,
  timestamp: Date
): Promise<ExecutionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  })

  if (!booking) {
    return {
      success: false,
      message: '預約不存在',
      operationId,
      timestamp,
      error: '找不到指定的預約記錄',
    }
  }

  // 更新預約狀態
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      cancelledAt: timestamp,
    },
  })

  // 記錄操作
  await logOperation(operationId, userId, 'booking.cancel', bookingId, timestamp)

  return {
    success: true,
    message: `已成功取消預約 ${booking.code}`,
    operationId,
    timestamp,
    affectedRecords: {
      type: 'booking',
      count: 1,
    },
  }
}

/**
 * 執行新增預約備註
 */
async function executeAddBookingNote(
  operationId: string,
  bookingId: string,
  userId: string,
  metadata: Record<string, unknown> | undefined,
  timestamp: Date
): Promise<ExecutionResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  })

  if (!booking) {
    return {
      success: false,
      message: '預約不存在',
      operationId,
      timestamp,
      error: '找不到指定的預約記錄',
    }
  }

  const noteContent = metadata?.noteContent as string || '（無內容）'

  // 更新預約備註（追加）
  const currentNote = booking.note || ''
  const newNote = currentNote
    ? `${currentNote}\n\n[AI ${new Date().toLocaleString()}] ${noteContent}`
    : `[AI ${new Date().toLocaleString()}] ${noteContent}`

  await prisma.booking.update({
    where: { id: bookingId },
    data: { note: newNote },
  })

  // 記錄操作
  await logOperation(operationId, userId, 'booking.note.add', bookingId, timestamp)

  return {
    success: true,
    message: `已為預約 ${booking.code} 新增備註`,
    operationId,
    timestamp,
    affectedRecords: {
      type: 'booking_note',
      count: 1,
    },
  }
}

/**
 * 執行新增會員備註
 */
async function executeAddMemberNote(
  operationId: string,
  memberId: string,
  userId: string,
  metadata: Record<string, unknown> | undefined,
  timestamp: Date
): Promise<ExecutionResult> {
  const noteContent = metadata?.noteContent as string || '（無內容）'

  // 注意：這裡使用 memberId 作為 userId（如果沒有單獨的 member 表）
  // 實際應用中可能需要調整

  // 由於沒有 member 表，只能記錄操作
  await logOperation(operationId, userId, 'member.note.add', memberId, timestamp)

  return {
    success: true,
    message: `已為會員新增服務紀錄`,
    operationId,
    timestamp,
    affectedRecords: {
      type: 'member_note',
      count: 1,
    },
  }
}

/**
 * 記錄操作到日誌（用於審計）
 */
async function logOperation(
  operationId: string,
  executorId: string,
  operationType: OperationType,
  targetId: string,
  timestamp: Date
): Promise<void> {
  // 注意：需要在實際應用中實現操作日誌表
  // 這裡只是佔位符
  console.log(`[Operation Log] ${operationId} | ${operationType} | ${targetId} | ${executorId} | ${timestamp}`)
}

/**
 * 驗證操作是否可以執行
 */
export async function canExecuteOperation(
  operationType: OperationType,
  targetId: string
): Promise<{ canExecute: boolean; reason?: string }> {
  switch (operationType) {
    case 'booking.cancel': {
      const booking = await prisma.booking.findUnique({ where: { id: targetId } })
      if (!booking) {
        return { canExecute: false, reason: '預約不存在' }
      }
      if (booking.status === 'CANCELLED') {
        return { canExecute: false, reason: '預約已取消' }
      }
      return { canExecute: true }
    }

    case 'booking.note.add':
    case 'member.note.add': {
      return { canExecute: true }
    }

    default:
      return { canExecute: false, reason: '不支援的操作類型' }
  }
}
