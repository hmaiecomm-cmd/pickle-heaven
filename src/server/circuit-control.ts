import 'server-only'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { addMinutes, now } from '@/lib/time'
import { circuitCommandBlocker } from '@/lib/circuit-guard'
import { CIRCUIT_DEFINITIONS, type CircuitNumber } from '@/lib/control-types'
import { CATEGORY_INFO, circuitLocation } from '@/lib/venue-layout'
import { deviceIntegration } from './monitor-service'
import { calculateCircuitStates } from './scheduling-service'
import { after } from 'next/server'
import type { Circuit } from '@prisma/client'
import { gateway } from './iot/gateway-client'
import { pushSitePlanSafe } from './iot/sync'

export class CircuitCommandError extends Error {}

type Target = 'ON' | 'OFF'

/** 手動操作維持方式：到下一個排程切換點（預設）、指定分鐘數、一直維持到恢復排程 */
export type HoldMode = 'NEXT_CHANGE' | 'MINUTES' | 'INDEFINITE'
export const HOLD_MINUTES = [15, 30, 60, 120, 240, 480]

function parseHold(hold: { mode?: string; minutes?: number } | undefined): { mode: HoldMode; minutes: number | null } {
  const mode = hold?.mode ?? 'NEXT_CHANGE'
  if (mode === 'NEXT_CHANGE' || mode === 'INDEFINITE') return { mode, minutes: null }
  if (mode === 'MINUTES' && Number.isInteger(hold?.minutes) && HOLD_MINUTES.includes(hold!.minutes!)) return { mode, minutes: hold!.minutes! }
  throw new CircuitCommandError('維持方式不正確')
}

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
  if (integ.mode === 'NOT_CONNECTED') blockers.push(integ.reason)

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
export async function sendManualCircuitCommand(params: { circuitNumber: string; targetState: string; reason: string; idempotencyKey: string; actor: string; hold?: { mode?: string; minutes?: number } }) {
  const key = params.idempotencyKey.slice(0, 80)
  const existing = await prisma.controlCommand.findUnique({ where: { commandId: key } })
  if (existing) return existing
  const reason = params.reason.trim().slice(0, 200)
  if (!reason) throw new CircuitCommandError('請填寫操作原因')
  const hold = parseHold(params.hold)

  const preview = await previewCircuitCommand(params.circuitNumber, params.targetState)
  if (preview.blockers.length > 0) throw new CircuitCommandError(preview.blockers.join('；'))
  const circuit = (await prisma.circuit.findUnique({ where: { circuitNumber: preview.circuit.number } }))!
  const t = now()
  const baseline = hold.mode === 'NEXT_CHANGE' ? (await calculateCircuitStates(circuit.venueId, t))[preview.circuit.number] : null
  const override = {
    overrideMode: hold.mode,
    overrideState: preview.targetState,
    overrideBaseline: baseline,
    overrideUntil: hold.minutes ? addMinutes(t, hold.minutes) : null,
    overrideBy: params.actor,
  }

  if (!preview.simulated) return sendViaGateway({ key, reason, hold, preview, circuit, override, actor: params.actor, t })

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
      data: { expectedState: preview.targetState, actualState: preview.targetState, lastStateChange: t, lastCommandStatus: 'ACKED', lastCommandAt: t, lastCommandError: null, ...override },
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
        data: { circuitNumber: preview.circuit.number, targetState: preview.targetState, reason, simulated: true, hold },
      },
    })
    await tx.auditLog.create({
      data: { actor: params.actor, action: 'CIRCUIT_COMMAND', target: `迴路 ${preview.circuit.number} ${preview.circuit.name}`, detail: { targetState: preview.targetState, reason, commandId: c.id, simulated: true, hold } },
    })
    return c
  })
  return cmd
}

/** 結束手動維持，交回排程（下一次每分鐘排程依排程狀態更新） */
export async function resumeCircuitSchedule(circuitNumber: string, actor: string) {
  const circuit = await prisma.circuit.findUnique({ where: { circuitNumber } })
  if (!circuit) throw new CircuitCommandError('找不到迴路')
  if (!circuit.overrideMode) throw new CircuitCommandError('這一路目前沒有手動維持')
  if ((await deviceIntegration()).mode === 'GATEWAY') {
    const siteCode = await siteCodeOf(circuit.venueId)
    await gateway.enqueue(siteCode, `release-${randomUUID()}`, { type: 'circuit.release', circuit: circuitNumber }, actor, 120).catch((err) => {
      throw new CircuitCommandError(`無法通知場館恢復排程：${err instanceof Error ? err.message : err}`)
    })
    afterResponse(() => pushSitePlanSafe(circuit.venueId))
  }
  await prisma.$transaction(async (tx) => {
    await tx.circuit.update({ where: { id: circuit.id }, data: { overrideMode: null, overrideState: null, overrideBaseline: null, overrideUntil: null, overrideBy: null } })
    await tx.controlEvent.create({
      data: {
        eventId: randomUUID(),
        venueId: circuit.venueId,
        circuitId: circuit.id,
        userId: actor,
        eventType: 'OVERRIDE_EXPIRED',
        severity: 'INFO',
        environment: 'SIMULATION',
        title: `迴路 ${circuitNumber} 恢復排程`,
        description: `操作者: ${actor}`,
        data: { mode: circuit.overrideMode, resumedBy: actor },
      },
    })
    await tx.auditLog.create({ data: { actor, action: 'CIRCUIT_RESUME', target: `迴路 ${circuitNumber} ${circuit.name}`, detail: { mode: circuit.overrideMode } } })
  })
}

export async function recentCircuitCommands(limit = 20) {
  return prisma.controlCommand.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { circuit: { select: { circuitNumber: true, name: true } } } })
}

// ───────────── IoT Gateway（真實場館電腦） ─────────────

/** 在回應送出後執行；不在請求情境（腳本）時直接執行 */
function afterResponse(fn: () => Promise<unknown>) {
  try {
    after(fn)
  } catch {
    void fn()
  }
}

async function siteCodeOf(venueId: string): Promise<string> {
  const v = await prisma.venue.findUnique({ where: { id: venueId }, select: { siteCode: true } })
  if (!v?.siteCode) throw new CircuitCommandError('場館尚未設定 IoT 場館代碼（Venue.siteCode），無法下指令')
  return v.siteCode
}

/**
 * 經 IoT Gateway 下指令：先記錄為「已送出」（SENT），收到場館回報（/api/iot/webhook）才改為已確認或失敗。
 * 指令 30 秒內沒被場館取走就過期，不會在場館恢復連線後補執行。
 */
async function sendViaGateway(p: {
  key: string
  reason: string
  hold: { mode: HoldMode; minutes: number | null }
  preview: Awaited<ReturnType<typeof previewCircuitCommand>>
  circuit: Circuit
  override: { overrideMode: string; overrideState: string; overrideBaseline: string | null; overrideUntil: Date | null; overrideBy: string }
  actor: string
  t: Date
}) {
  const siteCode = await siteCodeOf(p.circuit.venueId)
  const n = p.preview.circuit.number
  const cmd = await prisma.$transaction(async (tx) => {
    const c = await tx.controlCommand.create({
      data: { commandId: p.key, circuitId: p.circuit.id, source: 'MANUAL_OVERRIDE', targetState: p.preview.targetState, status: 'SENT', requestedBy: p.actor, sentAt: p.t, expiresAt: addMinutes(p.t, 0.5), simulated: false },
    })
    await tx.circuit.update({ where: { id: p.circuit.id }, data: { expectedState: p.preview.targetState, lastCommandStatus: 'SENT', lastCommandAt: p.t, lastCommandError: null, ...p.override } })
    await tx.controlEvent.create({
      data: {
        eventId: randomUUID(),
        venueId: p.circuit.venueId,
        circuitId: p.circuit.id,
        commandId: c.id,
        userId: p.actor,
        eventType: 'MANUAL_OVERRIDE',
        severity: 'WARNING',
        environment: 'PRODUCTION',
        title: `迴路 ${n} 手動${p.preview.actionLabel}（已送往場館）`,
        description: `操作者: ${p.actor}, 原因: ${p.reason}`,
        data: { circuitNumber: n, targetState: p.preview.targetState, reason: p.reason, hold: p.hold, siteCode },
      },
    })
    await tx.auditLog.create({ data: { actor: p.actor, action: 'CIRCUIT_COMMAND', target: `迴路 ${n} ${p.preview.circuit.name}`, detail: { targetState: p.preview.targetState, reason: p.reason, commandId: c.id, simulated: false, hold: p.hold, siteCode } } })
    return c
  })
  try {
    await gateway.enqueue(
      siteCode,
      p.key,
      {
        type: 'circuit.set',
        circuit: n,
        state: p.preview.targetState,
        hold: { mode: p.hold.mode, ...(p.override.overrideUntil ? { until: p.override.overrideUntil.toISOString() } : {}) },
        reason: p.reason,
      },
      p.actor,
      30,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await prisma.controlCommand.update({ where: { id: cmd.id }, data: { status: 'FAILED', error: msg } })
    await prisma.circuit.update({ where: { id: p.circuit.id }, data: { lastCommandStatus: 'FAILED', lastCommandError: msg } })
    throw new CircuitCommandError(`指令無法送到 IoT Gateway：${msg}`)
  }
  // 手動操作也寫進場館計畫，場館重開機後能還原
  afterResponse(() => pushSitePlanSafe(p.circuit.venueId))
  return cmd
}
