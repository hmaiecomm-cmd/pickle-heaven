import 'server-only'
import type { EdgeCommand, SiteSummary, TrafficEntry, CommandRecord } from '@gh/iot-contract'
import type { AdminContext } from '@/lib/admin-auth'
import { clientFor } from '@/lib/db'
import { now } from '@/lib/time'
import { GatewayError, gateway, iotGatewayConfig } from './gateway-client'
import { buildSitePlan } from './site-plan'
import { normalizeTarget, siteIdFor, type IotTarget } from './site-id'
import { pushSitePlan } from './sync'

/**
 * 工程測試頁（/admin/engineer_testmode）的後端：
 *   - 一鍵切換連線對象（實體場館電腦 ↔ 網頁模擬器）
 *   - 鏡像：目前連線對象回報的狀態
 *   - 下行參數：平台推給場館的計畫、送出的指令
 *   - 上行：Gateway 看到的請求流量、錯誤
 *   - 測試台用的指令通道（直接送 EdgeCommand；實體場館要多一道確認）
 */

/** 會改變現場的指令；連實體場館時必須帶 confirmLive */
const LIVE_GUARDED = new Set<EdgeCommand['type']>(['circuit.set', 'circuit.release', 'door.unlock', 'audio.play'])

export interface EngineerVenue {
  id: string
  name: string
  siteCode: string
  target: IotTarget
}

export async function engineerVenues(ctx: AdminContext): Promise<EngineerVenue[]> {
  const rows = await clientFor(ctx.tenant).venue.findMany({
    where: { siteCode: { not: null }, ...(ctx.venueId ? { id: ctx.venueId } : {}) },
    select: { id: true, name: true, siteCode: true, iotTarget: true },
    orderBy: { name: 'asc' },
  })
  return rows.map((v) => ({ id: v.id, name: v.name, siteCode: v.siteCode!, target: normalizeTarget(v.iotTarget) }))
}

export async function mustVenue(ctx: AdminContext, venueId: string | null): Promise<EngineerVenue> {
  const list = await engineerVenues(ctx)
  const v = venueId ? list.find((x) => x.id === venueId) : list[0]
  if (!v) throw new GatewayError(404, 'NOT_FOUND', '找不到已設定場館代碼的場館（Venue.siteCode）')
  return v
}

const activeId = (v: EngineerVenue) => siteIdFor(v.siteCode, v.target)
const safe = <T>(p: Promise<T>) => p.catch((e) => (e instanceof GatewayError && e.status === 404 ? null : Promise.reject(e)))

export async function overview(v: EngineerVenue) {
  if (!iotGatewayConfig()) return { venue: v, configured: false as const }
  const [live, sim] = await Promise.all([safe(gateway.site(siteIdFor(v.siteCode, 'LIVE'))), safe(gateway.site(siteIdFor(v.siteCode, 'SIMULATOR')))])
  const plan = await buildSitePlan(v.id, now())
  const active = (v.target === 'LIVE' ? live : sim) as SiteSummary | null
  return {
    venue: v,
    configured: true as const,
    activeSiteId: activeId(v),
    sites: { LIVE: live, SIMULATOR: sim },
    active,
    plan: plan
      ? {
          siteId: plan.siteId,
          generatedAt: plan.generatedAt,
          window: plan.window,
          circuits: plan.circuits,
          timeline: plan.timeline,
          overrides: plan.overrides,
          doorCodes: plan.doorCodes.map((c) => ({ ...c, code: `****${c.code.slice(-2)}` })),
          business: plan.business,
          cameras: plan.cameras ?? [],
        }
      : null,
  }
}

export async function setTarget(ctx: AdminContext, v: EngineerVenue, target: IotTarget) {
  const db = clientFor(ctx.tenant)
  await db.venue.update({ where: { id: v.id }, data: { iotTarget: target } })
  await db.auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'IOT_TARGET_SWITCH', target: v.siteCode, detail: { from: v.target, to: target, venueId: v.id } } })
  // 立刻把計畫推給新的連線對象
  const pushed = await pushSitePlan(v.id).catch((e) => ({ error: (e as Error).message }))
  return { target, pushed }
}

export async function sendCommand(ctx: AdminContext, v: EngineerVenue, body: { id?: string; command: EdgeCommand; ttlSec?: number; confirmLive?: boolean }) {
  if (!body?.command?.type) throw new GatewayError(400, 'VALIDATION', '缺少 command')
  if (body.command.type === 'sim.inject' && v.target !== 'SIMULATOR') throw new GatewayError(409, 'NOT_SIMULATOR', 'sim.inject 只能送給網頁模擬器，請先切換到模擬器')
  if (v.target === 'LIVE' && LIVE_GUARDED.has(body.command.type) && !body.confirmLive) throw new GatewayError(409, 'CONFIRM_LIVE', '目前連的是實體場館電腦，這個指令會動到現場設備，請確認後再送')
  const id = body.id && /^[\w-]{8,80}$/.test(body.id) ? body.id : `eng-${crypto.randomUUID()}`
  const record = await gateway.enqueue(activeId(v), id, body.command, `engineer:${ctx.username}`, body.ttlSec)
  if (body.command.type !== 'sim.inject') {
    await clientFor(ctx.tenant).auditLog.create({ data: { actor: `admin:${ctx.username}`, action: 'IOT_ENGINEER_COMMAND', target: activeId(v), detail: { commandId: id, command: body.command as any, target: v.target } } })
  }
  return record
}

export async function commandsView(v: EngineerVenue, limit = 80) {
  return gateway.commands(activeId(v), limit)
}

/** 連線：場館從哪個（浮動）IP 連進來、IP 變更歷史、最近心跳 */
export async function connectionView(v: EngineerVenue) {
  return gateway.connection(activeId(v))
}

export async function trafficView(v: EngineerVenue, limit = 200) {
  return gateway.traffic(activeId(v), limit)
}

/** 錯誤總覽：Gateway 拒絕的請求、失敗／過期的指令、平台收到的錯誤事件 */
export async function errorsView(ctx: AdminContext, v: EngineerVenue) {
  const [traffic, commands, events] = await Promise.all([
    gateway.traffic(activeId(v), 500).then((r) => r.traffic.filter((t: TrafficEntry) => t.status >= 400)),
    gateway.commands(activeId(v), 200).then((r) => r.commands.filter((c: CommandRecord) => ['FAILED', 'REJECTED', 'EXPIRED'].includes(c.status))),
    clientFor(ctx.tenant).controlEvent.findMany({
      where: { venueId: v.id, severity: { in: ['ERROR', 'WARNING'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, createdAt: true, eventType: true, severity: true, title: true, description: true },
    }),
  ])
  return { traffic: traffic.slice(0, 100), commands: commands.slice(0, 100), events }
}

export async function mediaView(v: EngineerVenue) {
  return gateway.media(activeId(v))
}

export async function nvrIndexView(v: EngineerVenue, id: string) {
  return gateway.nvrIndex(activeId(v), id)
}

export { activeId as engineerSiteId }
