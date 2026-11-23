import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { HEADER_KEY, HEADER_NONCE, HEADER_SIG, HEADER_TS, verifySignature, type EdgeEvent, type WebhookEnvelope } from '@gh/iot-contract'
import { mainPrisma as prisma } from '@/lib/db'
import { venueForSiteId } from '@/server/iot/site-id'
import { iotGatewayConfig } from '@/server/iot/gateway-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * IoT Gateway → 平台回報（HMAC 簽章，keyId = gateway）。
 *   ack              指令執行結果 → ControlCommand、Circuit 實際狀態
 *   command.expired  場館離線期間指令過期
 *   status           16 路實際狀態 → Circuit.actualState
 *   events           刷卡、迴路切換、硬體異常… → ControlEvent／AuditLog（依 eventId 去重）
 *   presence         場館電腦上線／離線
 * 每一種處理都可重複執行（Gateway 至少送達一次）。
 */
export async function POST(req: Request) {
  const cfg = iotGatewayConfig()
  if (!cfg?.webhookSecret) return NextResponse.json({ error: 'IOT_NOT_CONFIGURED' }, { status: 503 })
  const body = await req.text()
  const url = new URL(req.url)
  const v = verifySignature({
    secret: cfg.webhookSecret,
    method: 'POST',
    pathWithQuery: url.pathname + url.search,
    body,
    headers: { ts: req.headers.get(HEADER_TS), nonce: req.headers.get(HEADER_NONCE), sig: req.headers.get(HEADER_SIG) },
  })
  if (req.headers.get(HEADER_KEY) !== 'gateway' || !v.ok) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let env: WebhookEnvelope
  try {
    env = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }
  const p = env.payload
  const resolved = await venueForSiteId(p.siteId)
  if (!resolved) return NextResponse.json({ ok: true, ignored: 'UNKNOWN_SITE' })
  // 實體／模擬器只採用目前的連線對象，避免兩邊的狀態互相覆蓋
  if (!resolved.active) return NextResponse.json({ ok: true, ignored: 'INACTIVE_TARGET', target: resolved.target })
  const venue = { id: resolved.venueId }
  const at = new Date()

  const circuitOf = (no: string) => prisma.circuit.findFirst({ where: { venueId: venue.id, circuitNumber: no } })
  const event = (data: { eventId?: string; circuitId?: string; commandId?: string; eventType: any; severity: string; title: string; description?: string; data?: any }) =>
    prisma.controlEvent
      .create({ data: { eventId: data.eventId ?? randomUUID(), venueId: venue.id, environment: 'PRODUCTION', ...data } })
      .catch((e: any) => {
        if (e?.code !== 'P2002') throw e // eventId 重複 = 重送，略過
      })

  switch (p.kind) {
    case 'ack':
    case 'command.expired': {
      const cmd = await prisma.controlCommand.findUnique({ where: { commandId: p.commandId } })
      const result = p.kind === 'ack' ? p.ack.result : 'EXPIRED'
      const status = result === 'OK' ? 'ACKED' : result === 'EXPIRED' ? 'EXPIRED' : 'FAILED'
      const error = p.kind === 'ack' ? (p.ack.error ?? (result === 'REJECTED' ? '場館拒絕執行' : null)) : '場館離線，指令已過期未執行'
      if (cmd && (cmd.status === 'PENDING' || cmd.status === 'SENT')) {
        await prisma.controlCommand.update({ where: { id: cmd.id }, data: { status, ackedAt: status === 'ACKED' ? at : null, error } })
        await prisma.circuit.update({ where: { id: cmd.circuitId }, data: { lastCommandStatus: status, lastCommandAt: at, lastCommandError: error } })
        await event({ circuitId: cmd.circuitId, commandId: cmd.id, eventType: status === 'ACKED' ? 'COMMAND_ACKED' : 'COMMAND_FAILED', severity: status === 'ACKED' ? 'INFO' : 'ERROR', title: `指令 ${result}`, description: error ?? undefined, data: { siteId: p.siteId, command: p.command } })
      }
      if (p.kind === 'ack' && p.ack.circuits) await saveActual(venue.id, p.ack.circuits, at)
      break
    }
    case 'status':
      await saveActual(venue.id, p.status.circuits, at)
      break
    case 'log.uploaded':
      // 內容留在 Gateway；平台只記一筆稽核（webhook 可能重送，依 commandId 去重）
      const seen = await prisma.auditLog.findMany({ where: { action: 'IOT_LOG_UPLOADED', target: p.siteId, createdAt: { gte: new Date(Date.now() - 86_400_000) } }, select: { detail: true }, take: 200 })
      if (!seen.some((r) => (r.detail as any)?.commandId === p.commandId)) {
        await prisma.auditLog.create({ data: { actor: `edge:${p.siteId}`, action: 'IOT_LOG_UPLOADED', target: p.siteId, detail: { commandId: p.commandId, venueId: venue.id, bytes: p.bytes, files: p.files, requestedBy: p.requestedBy ?? null } } })
      }
      break
    case 'presence':
      await event({ eventType: p.online ? 'DEVICE_ONLINE' : 'DEVICE_OFFLINE', severity: p.online ? 'INFO' : 'ERROR', title: p.online ? `場館電腦 ${p.siteId} 上線` : `場館電腦 ${p.siteId} 離線`, data: { lastSeenAt: p.lastSeenAt, agentVersion: p.agentVersion } })
      break
    case 'events':
      for (const e of p.events) await handleEdgeEvent(venue.id, p.siteId, e, circuitOf, event)
      break
  }
  return NextResponse.json({ ok: true })
}

async function saveActual(venueId: string, circuits: Record<string, 'ON' | 'OFF'>, at: Date) {
  for (const [no, state] of Object.entries(circuits)) {
    await prisma.circuit.updateMany({ where: { venueId, circuitNumber: no }, data: { actualState: state, lastDeviceReport: at } })
  }
}

const DOOR_ACTION: Record<string, string> = {
  'door.code_ok': 'DOOR_CODE_OK',
  'door.code_denied': 'DOOR_CODE_DENIED',
  'door.unlocked': 'DOOR_UNLOCKED',
  'motion.unbooked': 'COURT_MOTION_UNBOOKED',
  'audio.played': 'SPEAKER_PLAYED',
}

async function handleEdgeEvent(
  venueId: string,
  siteId: string,
  e: EdgeEvent,
  circuitOf: (no: string) => Promise<{ id: string } | null>,
  event: (d: any) => Promise<unknown>,
) {
  const eventId = `edge:${siteId}:${e.eventId}`
  const d = (e.data ?? {}) as Record<string, any>
  if (e.type === 'circuit.changed' || e.type === 'circuit.forced_off') {
    const c = d.circuit ? await circuitOf(String(d.circuit)) : null
    if (c && e.type === 'circuit.changed') await prisma.circuit.update({ where: { id: c.id }, data: { actualState: d.state, lastStateChange: new Date(e.at), lastDeviceReport: new Date() } })
    await event({
      eventId,
      circuitId: c?.id,
      eventType: e.type === 'circuit.changed' ? 'SCHEDULE_EXECUTED' : 'WATCHDOG_ALERT',
      severity: e.type === 'circuit.changed' ? 'INFO' : 'WARNING',
      title: e.type === 'circuit.changed' ? `迴路 ${d.circuit} → ${d.state}（${d.source ?? ''}）` : `迴路 ${d.circuit} 超過安全上限 ${d.limit} 分鐘，場館已強制關閉`,
      data: { ...d, at: e.at },
    })
  } else if (e.type === 'hardware.error') {
    const c = d.circuit ? await circuitOf(String(d.circuit)) : null
    await event({ eventId, circuitId: c?.id, eventType: 'SYSTEM_ERROR', severity: 'ERROR', title: `場館硬體異常：${d.component ?? ''} ${d.message ?? ''}`.trim(), data: { ...d, at: e.at } })
  } else if (e.type === 'agent.started' || e.type === 'agent.recovered') {
    await event({ eventId, eventType: 'DEVICE_ONLINE', severity: 'INFO', title: e.type === 'agent.started' ? `場館電腦 ${siteId} 啟動` : `場館電腦 ${siteId} 網路恢復`, data: { ...d, at: e.at } })
  } else if (DOOR_ACTION[e.type]) {
    // 門禁與現場事件記在稽核紀錄（不含明碼；以 detail.eventId 去重）
    const recent = await prisma.auditLog.findMany({ where: { actor: `edge:${siteId}`, action: DOOR_ACTION[e.type], createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } }, select: { detail: true }, orderBy: { createdAt: 'desc' }, take: 500 })
    if (recent.some((r) => (r.detail as any)?.eventId === e.eventId)) return
    await prisma.auditLog.create({ data: { actor: `edge:${siteId}`, action: DOOR_ACTION[e.type], target: d.door ?? d.court ?? null, detail: { eventId: e.eventId, at: e.at, venueId, ...d } } })
  }
}
