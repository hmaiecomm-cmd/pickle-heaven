import 'server-only'

/**
 * AI 操作預覽與確認 — Phase 4
 * 定義 AI 可以執行的操作，以及預覽和確認流程
 */

export type OperationType =
  | 'booking.cancel'      // 取消預約
  | 'booking.reschedule'  // 改期預約
  | 'booking.note.add'    // 新增預約備註
  | 'member.note.add'     // 新增會員備註
  | 'refund.process'      // 處理退款

export interface ActionPreview {
  operationId: string
  type: OperationType
  title: string
  description: string
  targetId: string        // 受影響記錄的 ID（booking/member/refund id）
  targetName: string      // 受影響對象的名稱
  impact: string          // 操作影響說明
  requiredPermission: string
  riskLevel: 'low' | 'medium' | 'high'
}

export interface OperationRequest {
  operationId: string
  confirmed: boolean
  notes?: string
}

/**
 * 生成取消預約操作的預覽
 */
export function previewCancelBooking(
  bookingId: string,
  bookingCode: string,
  customerName: string,
  reason?: string
): ActionPreview {
  return {
    operationId: `cancel_${bookingId}_${Date.now()}`,
    type: 'booking.cancel',
    title: '取消預約',
    description: `將取消預約 ${bookingCode}（客人：${customerName}）`,
    targetId: bookingId,
    targetName: bookingCode,
    impact: `
⚠️ 此操作將：
1. 標記預約為已取消
2. 釋放被佔用的場地/時段
3. 觸發客人通知（如已設置）
4. 預約數據保留用於紀錄目的

${reason ? `\n取消原因：${reason}` : ''}
    `,
    requiredPermission: 'bookings.manage',
    riskLevel: 'medium',
  }
}

/**
 * 生成改期預約操作的預覽
 */
export function previewRescheduleBooking(
  bookingId: string,
  bookingCode: string,
  customerName: string,
  fromDate: string,
  toDate: string
): ActionPreview {
  return {
    operationId: `reschedule_${bookingId}_${Date.now()}`,
    type: 'booking.reschedule',
    title: '改期預約',
    description: `將預約 ${bookingCode}（客人：${customerName}）改期`,
    targetId: bookingId,
    targetName: bookingCode,
    impact: `
⚠️ 此操作將：
1. 將預約日期從 ${fromDate} 改為 ${toDate}
2. 釋放原時段，佔用新時段
3. 發送改期通知給客人
4. 更新所有相關的場地預約

⚠️ 注意：新時段必須有空位才能改期
    `,
    requiredPermission: 'bookings.manage',
    riskLevel: 'medium',
  }
}

/**
 * 生成新增預約備註操作的預覽
 */
export function previewAddBookingNote(
  bookingId: string,
  bookingCode: string,
  noteContent: string
): ActionPreview {
  return {
    operationId: `note_${bookingId}_${Date.now()}`,
    type: 'booking.note.add',
    title: '新增預約備註',
    description: `為預約 ${bookingCode} 新增內部備註`,
    targetId: bookingId,
    targetName: bookingCode,
    impact: `
✅ 此操作將：
1. 在預約記錄中新增備註
2. 備註僅限內部團隊查看，客人看不到
3. 備註類型自動標記為「AI 助理」

備註內容：
"${noteContent}"
    `,
    requiredPermission: 'bookings.manage',
    riskLevel: 'low',
  }
}

/**
 * 生成新增會員備註操作的預覽
 */
export function previewAddMemberNote(
  memberId: string,
  memberName: string,
  noteContent: string
): ActionPreview {
  return {
    operationId: `member_note_${memberId}_${Date.now()}`,
    type: 'member.note.add',
    title: '新增會員備註',
    description: `為會員 ${memberName} 新增服務紀錄`,
    targetId: memberId,
    targetName: memberName,
    impact: `
✅ 此操作將：
1. 在會員資料中新增服務紀錄
2. 記錄包含操作時間和執行者
3. 所有團隊成員都能查看此紀錄

記錄內容：
"${noteContent}"
    `,
    requiredPermission: 'members.note',
    riskLevel: 'low',
  }
}

/**
 * 驗證操作預覽的合法性
 */
export function validateOperationPreview(preview: ActionPreview): {
  valid: boolean
  error?: string
} {
  // 檢查必要欄位
  if (!preview.operationId || !preview.type || !preview.targetId) {
    return { valid: false, error: '操作預覽資訊不完整' }
  }

  // 檢查 operationId 格式（防止偽造）
  if (!/^[a-z_]+_[a-z0-9_]+_\d+$/.test(preview.operationId)) {
    return { valid: false, error: '操作 ID 格式無效' }
  }

  // 檢查高風險操作
  if (preview.riskLevel === 'high' && !preview.impact.includes('⚠️')) {
    return { valid: false, error: '高風險操作必須包含警告信息' }
  }

  return { valid: true }
}

/**
 * 格式化操作預覽以呈現給用戶
 */
export function formatOperationPreview(preview: ActionPreview): string {
  const riskEmoji = {
    low: '✅',
    medium: '⚠️',
    high: '🚨',
  }

  return `
${riskEmoji[preview.riskLevel]} ${preview.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${preview.description}

${preview.impact}

📋 操作 ID: ${preview.operationId}
🔐 所需權限: ${preview.requiredPermission}

請確認是否要執行此操作。回覆「確認」或「取消」。
  `
}
