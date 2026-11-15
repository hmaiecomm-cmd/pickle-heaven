import 'server-only'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { addMinutes, now } from '@/lib/time'
import { circuitCommandBlocker } from '@/lib/circuit-guard'
import { CIRCUIT_DEFINITIONS, type CircuitNumber } from '@/lib/control-types'
import { CATEGORY_INFO, circuitLocation } from '@/lib/venue-layout'
import { deviceIntegration } from './monitor-service'

export class CircuitCommandError extends Error {}

type Target = 'ON' | 'OFF'

/** 預覽：列出操作對象與安全檢查結果（不送出） */
export async function previewCircuitCommand(circuitNumber: string, targetState: string) {
  if (targetState !== 'ON' && targetState !== 'OFF') throw new CircuitCommandError('無效的目標狀態')
  const n = circuitNumber as CircuitNumber
  const def = CIRCUIT_DEFINITIONS[n]
  if (!def) throw new CircuitCommandError('找不到迴路')

  const [integ, circuit] = await Promise.all([deviceIntegration(), prisma.circuit.findUnique({ where: { circuitNumber: n } })])
  const blockers: string[] = []
  const warnings: string[] = []
  if (!circuit) blockers.push('迴路資料尚未建立')
  else {
    const b = circuitCommandBlocker(circuit, 'MANUAL_OVERRIDE')
    if (b) blockers.push(b)
  }
  if (integ.mode !== 'SIMULATED') blockers.push(integ.reason)

  if (targetState === 'OFF' && !blockers.length) {
    warnings.push('關閉前請確認現場沒有人員使用；此操作不影響逃生照明與 24 小時供電迴路')
    if (def.category === 'RESERVATION_DYNAMIC') {
      const t = now()
      const busy = await prisma.reservation.count({ where: { status: { in: ['BOOKED', 'EVENT'] }, startsAt: { lt: addMinutes(t, 15) }, endsAt: { gt: t } } })
      if (busy > 0) warnings.push('目前或 15 分鐘內有預約／活動使用場地')
    }
  }

  return {
    circuit: { number: n, name: def.name, category: CATEGORY_INFO[def.category].label, location: circuitLocation(n) },
    targetState: targetState as Target,
    actionLabel: targetState === 'ON' ? '開啟' : '關閉',
    simulated: integ.mode === 'SIMULATED',
    warnings,
    blockers,
  }
}

/**
 * 人工送出迴路指令。同一個 idempotencyKey 只會建立一筆。
 * 未串接真實設備時只有展示環境可送出，且結果為模擬（立即記為設備已確認，並標示模擬）。
 */
export async function sendManualCircuitCommand(params: { circuitNumber: string; targetState: string; reason: string; idempotencyKey: string; actor: string }) {
  const key = params.idempotencyKey.slice(0, 80)
  const existing = await prisma.controlCommand.findUnique({ where: { commandId: key } })
  if (existing) return existing
  const reason = params.reason.trim().slice(0, 200)
  if (!reason) throw new CircuitCommandError('請填寫操作原因')

  const preview = await previewCircuitCommand(params.circuitNumber, params.targetState)
  if (preview.blockers.length > 0) throw new CircuitCommandError(preview.blockers.join('；'))
  const circuit = (await prisma.circuit.findUnique({ where: { circuitNumber: preview.circuit.number } }))!
  const t = now()

  const cmd = await prisma.$transaction(async (tx) => {
    const c = await tx.controlCommand.create({
      data: {
        commandId: key,
        circuitId: circuit.id,
        source: 'MANUAL_OVERRIDE',
        targetState: preview.targetState,
        status: 'ACKED',
        requestedBy: params.actor,
        sentAt: t,
        ackedAt: t,
        expiresAt: addMinutes(t, 5),
        simulated: true,
      },
    })
    await tx.circuit.update({
      where: { id: circuit.id },
      data: { expectedState: preview.targetState, actualState: preview.targetState, lastStateChange: t, lastCommandStatus: 'ACKED', lastCommandAt: t, lastCommandError: null },
    })
    await tx.controlEvent.create({
      data: {
        eventId: randomUUID(),
        venueId: circuit.venueId,
        circuitId: circuit.id,
        commandId: c.id,
        userId: params.actor,
        eventType: 'MANUAL_OVERRIDE',
        severity: 'WARNING',
        environment: 'SIMULATION',
        title: `迴路 ${preview.circuit.number} 被手動${preview.actionLabel}`,
        description: `操作者: ${params.actor}, 原因: ${reason}`,
        data: { circuitNumber: preview.circuit.number, targetState: preview.targetState, reason, simulated: true },
      },
    })
    await tx.auditLog.create({
      data: { actor: params.actor, action: 'CIRCUIT_COMMAND', target: `迴路 ${preview.circuit.number} ${preview.circuit.name}`, detail: { targetState: preview.targetState, reason, commandId: c.id, simulated: true } },
    })
    return c
  })
  return cmd
}

export async function recentCircuitCommands(limit = 20) {
  return prisma.controlCommand.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { circuit: { select: { circuitNumber: true, name: true } } } })
}
