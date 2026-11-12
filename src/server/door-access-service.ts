/**
 * 門禁控制系統核心服務
 *
 * 實現 12 步交易流程：
 * 1. 預約確認
 * 2. 資格驗證
 * 3. 會話建立
 * 4. 配額檢查
 * 5. Outbox 記錄
 * 6. MQTT 發送
 * 7. Pi 驗證
 * 8. RS-485 配置
 * 9. 控制器回應
 * 10. 使用者通知
 * 11. 後續追蹤
 * 12. 事件時間軸
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  AccessSessionStep,
  CredentialConfig,
  ProvisionCredentialPayload,
  RevokeCredentialPayload,
  TIME_CONSTANTS,
  calculateCommandExpiry,
  isVersionCompatible,
  validatePinPattern,
} from '@/lib/door-access-types'

const db = new PrismaClient()

// ─────── 步驟 1: 預約確認 ───────

export async function createAccessSessionFromBooking(
  reservationId: string,
  bookingVersion: number = 1
) {
  const reservation = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { booking: true, court: { include: { venue: true } } },
  })

  if (!reservation || !reservation.booking) {
    throw new Error(`預約不存在: ${reservationId}`)
  }

  const { venue } = reservation.court

  // 驗證步驟 1: 預約狀態
  if (reservation.booking.status !== 'PAID') {
    throw new Error('訂單未付款')
  }

  // 步驟 2: 資格驗證
  const eligibility = await validateAccessEligibility(reservation, venue)
  if (!eligibility.valid) {
    throw new Error(eligibility.reason || '無通行資格')
  }

  // 步驟 3: 建立會話
  const accessSession = await db.accessSession.create({
    data: {
      venueId: venue.id,
      reservationId,
      bookingVersion,
      controllerMacId: '00:0E:4C:12:34:56', // TODO: 從設備配置取得
      credentialHash: '',
      validFromUtc: reservation.startsAt,
      validUntilUtc: reservation.endsAt,
      status: 'ACTIVE',
    },
  })

  // 記錄步驟 3 事件
  await logAccessEvent(
    venue.id,
    AccessSessionStep.STEP_3_SESSION_CREATED,
    `門禁會話已建立: ${accessSession.id}`,
    { accessSessionId: accessSession.id }
  )

  return accessSession
}

// ─────── 步驟 2: 資格驗證 ───────

async function validateAccessEligibility(
  reservation: any,
  venue: any
): Promise<{ valid: boolean; reason?: string }> {
  // 檢查會員黑名單
  if (reservation.booking.user) {
    const restriction = await db.memberRestriction.findFirst({
      where: {
        userId: reservation.booking.userId,
        type: 'BLACKLIST',
        revokedAt: null,
      },
    })

    if (restriction) {
      return { valid: false, reason: '會員已被列入黑名單' }
    }
  }

  // 檢查場館狀態
  if (!venue.active) {
    return { valid: false, reason: '場館已停用' }
  }

  // 檢查門禁設備是否已配置
  const adapter = await db.deviceAdapter.findFirst({
    where: { venueId: venue.id, enabled: true },
  })

  if (!adapter) {
    return { valid: false, reason: '門禁設備未配置' }
  }

  return { valid: true }
}

// ─────── 步驟 4: 配額檢查 ───────

export async function checkCredentialQuota(
  venueId: string,
  date: string, // YYYY-MM-DD
  controllerMacId: string
): Promise<{
  availableSlots: number
  alreadyProvisioned: number
  canProvision: boolean
  reason?: string
}> {
  // TODO: 從設備配置取得容量
  const TOTAL_SLOTS = 50

  // 計算已佔用位置
  const activeCredentials = await db.accessSession.count({
    where: {
      controllerMacId,
      status: 'ACTIVE',
      validFromUtc: {
        lte: new Date(`${date}T23:59:59Z`),
      },
      validUntilUtc: {
        gte: new Date(`${date}T00:00:00Z`),
      },
    },
  })

  const available = TOTAL_SLOTS - activeCredentials
  return {
    availableSlots: available,
    alreadyProvisioned: activeCredentials,
    canProvision: available > 0,
    reason:
      available <= 0 ? '控制器使用者位置已滿' : undefined,
  }
}

// ─────── 步驟 5: Outbox 記錄 ───────

export async function createProvisionCommand(
  accessSession: any,
  credential: { value: string; hash: string }
) {
  const commandId = randomUUID()
  const bookingVersion = accessSession.bookingVersion

  // 檢查版本相容性
  if (!isVersionCompatible(bookingVersion, accessSession.bookingVersion)) {
    throw new Error('版本不相容')
  }

  // 驗證 PIN 模式
  if (!validatePinPattern(credential.value)) {
    throw new Error('PIN 不符合安全規則')
  }

  // 計算命令失效時間
  const issuedAt = new Date()
  const expiresAt = calculateCommandExpiry(issuedAt)

  // 建立命令（Transactional Outbox）
  const command = await db.doorAccessCommand.create({
    data: {
      commandId,
      accessSessionId: accessSession.id,
      bookingVersion,
      commandSequence: 1, // TODO: 從資料庫取得遞增序號
      commandType: 'PROVISION_CREDENTIAL',
      issuedAt,
      expiresAt,
      targetState: 'ON',
      status: 'PENDING',
      simulated: process.env.CONTROL_ENVIRONMENT === 'simulation',
    },
  })

  // 更新會話的憑證 hash
  await db.accessSession.update({
    where: { id: accessSession.id },
    data: { credentialHash: credential.hash },
  })

  // 記錄步驟 5 事件
  await logAccessEvent(
    accessSession.venueId,
    AccessSessionStep.STEP_5_OUTBOX_RECORDED,
    `命令已記錄至 Outbox: ${commandId}`,
    { commandId }
  )

  return command
}

// ─────── 步驟 6: MQTT 發送 ───────

export async function publishCredentialCommand(command: any) {
  const payload: ProvisionCredentialPayload = {
    commandId: command.commandId,
    bookingVersion: command.bookingVersion,
    credentialId: `cred_${command.accessSessionId}`,
    credentialType: 'PIN',
    credentialValue: command.credentialHash, // 僅發送 hash
    validFrom: command.accessSession.validFromUtc.toISOString(),
    validUntil: command.accessSession.validUntilUtc.toISOString(),
    issuedAt: command.issuedAt.toISOString(),
    expiresAt: command.expiresAt.toISOString(),
  }

  // 更新 MQTT 詳情
  await db.doorAccessCommand.update({
    where: { id: command.id },
    data: {
      mqttTopic: `Advantech/00-0E-4C-12-34-56/ctl/user`,
      mqttPayload: payload as unknown as Prisma.InputJsonValue,
      sentAt: new Date(),
      status: 'SENT',
    },
  })

  // TODO: 實際發送到 MQTT Broker
  // await mqttService.publishCommand(topic, payload)

  // 記錄步驟 6 事件
  await logAccessEvent(
    command.accessSession.venueId,
    AccessSessionStep.STEP_6_MQTT_SENT,
    `MQTT 命令已發送: ${command.commandId}`,
    { commandId: command.commandId }
  )
}

// ─────── 步驟 7-9: Raspberry Pi 與控制器 ───────
// （由 Raspberry Pi 適配器處理，此處為模擬）

export async function simulateCommandExecution(
  command: any,
  scenario: 'success' | 'failure' | 'timeout' = 'success'
) {
  const delay = Math.random() * 2000 // 0-2 秒延遲
  await new Promise((resolve) => setTimeout(resolve, delay))

  const userSlotNumber = Math.floor(Math.random() * 50) + 1

  if (scenario === 'success') {
    await db.doorAccessCommand.update({
      where: { id: command.id },
      data: {
        ackedAt: new Date(),
        deviceStatus: 'ACCEPTED',
        deviceResponse: {
          userSlotNumber,
          resultCode: '00',
          resultMessage: '成功',
        },
        status: 'ACKED',
      },
    })

    // 更新會話
    await db.accessSession.update({
      where: { id: command.accessSessionId },
      data: {
        userSlotNumber,
        credentialState: 'APPLIED',
        lastAppliedAt: new Date(),
      },
    })

    // 記錄步驟 9 事件
    await logAccessEvent(
      command.accessSession.venueId,
      AccessSessionStep.STEP_9_CONTROLLER_RESPONSE,
      `控制器已套用憑證，位置: ${userSlotNumber}`,
      { userSlotNumber }
    )
  } else if (scenario === 'failure') {
    await db.doorAccessCommand.update({
      where: { id: command.id },
      data: {
        ackedAt: new Date(),
        deviceStatus: 'REJECTED',
        error: '控制器位置滿額',
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
        description: '控制器拒絕新增憑證',
        status: 'OPEN',
      },
    })
  } else {
    await db.doorAccessCommand.update({
      where: { id: command.id },
      data: {
        status: 'TIMEOUT',
        error: '等待設備回應逾時',
      },
    })
  }
}

// ─────── 步驟 10: 使用者通知 ───────

export async function notifyUserCredentialReady(accessSession: any) {
  // TODO: 實現 LINE / Email 通知邏輯
  // if (user.notificationMethod === 'LINE') {
  //   await lineNotificationService.send(...)
  // }

  // 記錄步驟 10 事件
  await logAccessEvent(
    accessSession.venueId,
    AccessSessionStep.STEP_10_USER_NOTIFIED,
    '使用者已通知密碼已準備完成',
    { accessSessionId: accessSession.id }
  )
}

// ─────── 取消 / 改期流程 ───────

export async function handleCredentialRevocation(
  accessSession: any,
  reason: string
) {
  const revokeCommandId = randomUUID()

  // 建立撤銷命令（優先級高於未執行的命令）
  const revokeCommand = await db.doorAccessCommand.create({
    data: {
      commandId: revokeCommandId,
      accessSessionId: accessSession.id,
      bookingVersion: accessSession.bookingVersion + 1, // 新版本
      commandSequence: 2, // TODO: 取得遞增序號
      commandType: 'REVOKE_CREDENTIAL',
      issuedAt: new Date(),
      expiresAt: calculateCommandExpiry(new Date()),
      targetState: 'OFF',
      status: 'PENDING',
    },
  })

  // 更新會話狀態
  await db.accessSession.update({
    where: { id: accessSession.id },
    data: {
      status: 'REVOKED',
      credentialState: 'REVOKE_PENDING',
    },
  })

  // 發送撤銷命令給 MQTT
  // TODO: publishRevokeCommand(revokeCommand)

  // 記錄事件
  await logAccessEvent(
    accessSession.venueId,
    AccessSessionStep.STEP_5_OUTBOX_RECORDED,
    `撤銷命令已記錄: ${revokeCommandId}`,
    { reason }
  )
}

// ─────── 步驟 11: 後續追蹤 ───────

export async function trackCredentialUsage(
  accessSessionId: string
): Promise<void> {
  const accessSession = await db.accessSession.findUnique({
    where: { id: accessSessionId },
    include: { accessLogs: true },
  })

  if (!accessSession) return

  // 檢查是否有使用記錄
  const accessCount = accessSession.accessLogs.length

  // TODO: 可在此實現定期檢查、提醒等邏輯
  // 例如：預約開始前 30 分鐘提醒使用者
  // 例如：預約結束後驗證使用者是否已通行
}

// ─────── 步驟 12: 事件時間軸 ───────

async function logAccessEvent(
  venueId: string,
  step: AccessSessionStep,
  title: string,
  data?: Record<string, unknown>
) {
  await db.controlEvent.create({
    data: {
      eventId: randomUUID(),
      venueId,
      eventType: 'COMMAND_SENT', // TODO: 使用適當的事件類型
      severity: 'INFO',
      environment:
        process.env.CONTROL_ENVIRONMENT === 'simulation'
          ? 'SIMULATION'
          : 'PRODUCTION',
      title,
      data: (data || {}) as Prisma.InputJsonValue,
    },
  })
}

// ─────── 查詢與管理 ───────

export async function getAccessSessionStatus(
  accessSessionId: string
): Promise<{
  id: string
  status: string
  credentialState: string
  validFrom: Date
  validUntil: Date
  userSlotNumber?: number
  lastAppliedAt?: Date
  commands: any[]
  accessLogs: any[]
}> {
  const session = await db.accessSession.findUnique({
    where: { id: accessSessionId },
    include: {
      commands: true,
      accessLogs: true,
    },
  })

  if (!session) {
    throw new Error(`會話不存在: ${accessSessionId}`)
  }

  return {
    id: session.id,
    status: session.status,
    credentialState: session.credentialState,
    validFrom: session.validFromUtc,
    validUntil: session.validUntilUtc,
    userSlotNumber: session.userSlotNumber ?? undefined,
    lastAppliedAt: session.lastAppliedAt ?? undefined,
    commands: session.commands,
    accessLogs: session.accessLogs,
  }
}

export async function queryControllerStatus(macId: string) {
  // TODO: 透過 RS-485 查詢實際狀態
  // 此為模擬實現
  return {
    online: true,
    usedSlots: 25,
    availableSlots: 25,
    controllerTime: new Date(),
    powerStatus: 'AC' as const,
    lastHeartbeat: new Date(),
    accessLogCount: 150,
  }
}

export async function reconcileAccessState(
  venueId: string,
  controllerMacId: string
): Promise<void> {
  // 網路恢復後同步雲端與設備狀態
  const sessions = await db.accessSession.findMany({
    where: {
      venueId,
      controllerMacId,
      status: 'ACTIVE',
    },
  })

  for (const session of sessions) {
    // 查詢設備實際狀態
    const deviceStatus = await queryControllerStatus(controllerMacId)

    // 比對雲端欲達狀態
    if (session.credentialState === 'REVOKE_PENDING') {
      // TODO: 檢查設備是否已刪除
      // 若已刪除，更新為 REVOKED
      // 若未刪除，重新發送撤銷命令
    }
  }
}

// ─────── 匯出主要函數 ───────

export const DoorAccessService = {
  createAccessSessionFromBooking,
  validateAccessEligibility,
  checkCredentialQuota,
  createProvisionCommand,
  publishCredentialCommand,
  simulateCommandExecution,
  notifyUserCredentialReady,
  handleCredentialRevocation,
  trackCredentialUsage,
  getAccessSessionStatus,
  queryControllerStatus,
  reconcileAccessState,
}
