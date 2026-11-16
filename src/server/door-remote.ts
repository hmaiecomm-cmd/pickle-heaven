import 'server-only'
import { prisma } from '@/lib/db'
import { addSeconds, now } from '@/lib/time'
import { DOOR_ACK_TIMEOUT_SECONDS, DOOR_COOLDOWN_SECONDS, MAIN_DOOR } from '@/lib/door-devices'

/**
 * 一鍵開啟大門：送出一次瞬間開門脈衝，不建立、不修改任何門禁授權。
 * 只有門禁控制器回報執行成功才算開門成功；Demo 模式只產生模擬結果，不會呼叫任何設備。
 */

export class DoorRemoteError extends Error {}

export type SimOutcome = 'SUCCESS' | 'OFFLINE' | 'TIMEOUT' | 'FAILED'
export const SIM_OUTCOMES: SimOutcome[] = ['SUCCESS', 'OFFLINE', 'TIMEOUT', 'FAILED']

type PulseResult = { ok: true } | { ok: false; status: 'OFFLINE' | 'TIMEOUT' | 'FAILED'; message: string }

/**
 * 真實門禁控制器介面（預留）。串接時實作並由 realController() 回傳。
 * pulseOpen 必須等到控制器回報執行結果才回傳，且只能觸發一次脈衝、不得永久解鎖；
 * 消防、緊急逃生與安全聯鎖由控制器本身處理，系統不得繞過。
 */
export interface DoorController {
  status(doorId: string): Promise<'ONLINE' | 'OFFLINE' | 'ERROR'>
  pulseOpen(doorId: string, seconds: number, commandId: string, timeoutMs: number): Promise<PulseResult>
}

/** 尚未串接真實門禁控制器 */
function realController(): DoorController | null {
  return null
}

export type DoorConnection = 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR'

export const DOOR_RESULT_TEXT: Record<string, string> = {
  SENT: '已送出，等待設備確認',
  SUCCEEDED: '大門已成功開啟',
  OFFLINE: '設備離線，無法開門',
  TIMEOUT: '設備未在時限內回報，無法確認是否已開門',
  FAILED: '門禁控制器回報開門失敗',
}

export async function getDoorRemoteState() {
  const controller = realController()
  let connection: DoorConnection = 'NOT_CONNECTED'
  if (controller) {
    const s = await controller.status(MAIN_DOOR.id).catch(() => 'ERROR' as const)
    connection = s === 'ONLINE' ? 'CONNECTED' : s === 'OFFLINE' ? 'NOT_CONNECTED' : 'ERROR'
  }
  const last = await prisma.doorRemoteCommand.findFirst({ where: { doorId: MAIN_DOOR.id }, orderBy: { createdAt: 'desc' } })
  return {
    door: { name: MAIN_DOOR.name, location: MAIN_DOOR.location, pulseSeconds: MAIN_DOOR.pulseSeconds },
    demo: controller === null,
    connection,
    last: last ? { at: last.createdAt.toISOString(), status: last.status, simulated: last.simulated, requestedBy: last.requestedBy } : null,
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function remoteOpenDoor(params: { idempotencyKey: string; actor: string; simulate?: string }) {
  const key = params.idempotencyKey.trim().slice(0, 80)
  if (!key) throw new DoorRemoteError('缺少指令編號')
  const existing = await prisma.doorRemoteCommand.findUnique({ where: { idempotencyKey: key } })
  if (existing) return existing

  const controller = realController()
  const demo = controller === null
  const outcome = (params.simulate ?? 'SUCCESS') as SimOutcome
  if (demo && !SIM_OUTCOMES.includes(outcome)) throw new DoorRemoteError('模擬結果不正確')
  if (controller) {
    const s = await controller.status(MAIN_DOOR.id).catch(() => 'ERROR' as const)
    if (s !== 'ONLINE') throw new DoorRemoteError(s === 'OFFLINE' ? '設備離線，禁止遠端開門' : '設備狀態異常，禁止遠端開門')
  }

  const t = now()
  const cmd = await prisma.$transaction(async (tx) => {
    const busy = await tx.doorRemoteCommand.findFirst({
      where: { doorId: MAIN_DOOR.id, OR: [{ status: 'SENT' }, { status: 'SUCCEEDED', createdAt: { gt: addSeconds(t, -DOOR_COOLDOWN_SECONDS) } }] },
    })
    if (busy) throw new DoorRemoteError(busy.status === 'SENT' ? '上一個開門指令仍在等待設備確認，請稍候' : `${DOOR_COOLDOWN_SECONDS} 秒內已開過門，請稍後再試`)
    return tx.doorRemoteCommand.create({
      data: { doorId: MAIN_DOOR.id, idempotencyKey: key, status: 'SENT', simulated: demo, pulseSeconds: MAIN_DOOR.pulseSeconds, requestedBy: params.actor, sentAt: t },
    })
  })

  let status: string
  let error: string | null = null
  if (demo) {
    await sleep(outcome === 'TIMEOUT' ? 2500 : 1200)
    status = outcome === 'SUCCESS' ? 'SUCCEEDED' : outcome
    if (status !== 'SUCCEEDED') error = `模擬：${DOOR_RESULT_TEXT[status]}`
  } else {
    const r = await controller!.pulseOpen(MAIN_DOOR.id, MAIN_DOOR.pulseSeconds, cmd.id, DOOR_ACK_TIMEOUT_SECONDS * 1000).catch(
      (e): PulseResult => ({ ok: false, status: 'FAILED', message: e instanceof Error ? e.message : String(e) }),
    )
    status = r.ok ? 'SUCCEEDED' : r.status
    if (!r.ok) error = r.message
  }

  const done = await prisma.doorRemoteCommand.update({ where: { id: cmd.id }, data: { status, error, ackAt: status === 'SUCCEEDED' ? now() : null } })
  await prisma.auditLog.create({
    data: {
      actor: params.actor,
      action: 'DOOR_REMOTE_OPEN',
      target: MAIN_DOOR.name,
      detail: { reason: `${demo ? '模擬・' : ''}${DOOR_RESULT_TEXT[status]}`, status, simulated: demo, commandId: cmd.id, pulseSeconds: MAIN_DOOR.pulseSeconds },
    },
  })
  return done
}
