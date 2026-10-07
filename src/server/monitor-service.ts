import 'server-only'
import { isDemoTenant, prisma } from '@/lib/db'
import { activityTimeLabel } from '@/lib/activity-shared'
import { formatDateTime, now, taipeiDateString, taipeiMinuteOfDay, taipeiToUtc, addDays } from '@/lib/time'
import { maskPhone } from './admin-orders'

/**
 * 場地監測與無人化管理。
 *
 * 誠實呈現資料來源：
 *  - 「依預約推估使用中」來自訂單／活動佔用，不是現場偵測。
 *  - 「感測器偵測」只有接上感測設備才有；沒有就顯示「尚未串接」。
 *  - 設備最後回報超過 5 分鐘視為「狀態未知」，不顯示正常。
 *  - 正式環境目前沒有任何設備閘道：資料庫裡的設備清單只是預先建立的紀錄，一律顯示「尚未串接」，不能下指令。
 *  - 展示環境使用隔離的模擬設備，畫面標示「模擬」。
 *  - 指令送出（SENT）不等於設備已動作；收到設備回報才是 ACKED。
 */

export const STALE_MS = 5 * 60_000
const ACK_AFTER_MS = 2_000
const TIMEOUT_MS = 30_000

export type DeviceMode = 'NOT_CONNECTED' | 'SIMULATED'

export async function deviceIntegration(): Promise<{ mode: DeviceMode; label: string; reason: string }> {
  if (await isDemoTenant()) return { mode: 'SIMULATED', label: '模擬設備（展示環境）', reason: '展示環境的設備狀態與指令結果皆為模擬' }
  if (process.env.DEVICE_GATEWAY_URL) {
    return { mode: 'NOT_CONNECTED', label: '已設定閘道網址，尚未實作串接', reason: '系統尚未實作設備閘道的通訊協定，無法讀取狀態或下指令' }
  }
  return { mode: 'NOT_CONNECTED', label: '尚未串接', reason: '尚未串接門禁、燈控等設備閘道；設備清單僅為預先建立的紀錄' }
}

export type DeviceState = 'NOT_CONNECTED' | 'ONLINE' | 'OFFLINE' | 'UNKNOWN'

export const DEVICE_TYPE_LABEL: Record<string, string> = { DOOR: '門禁', LIGHTS: '燈光', FANS: '風扇', CAMERA: '攝影機', SPEAKER: '廣播' }

/** 場地監測快照 */
export async function getMonitorSnapshot() {
  const integ = await deviceIntegration()
  const at = now()
  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { courts: { orderBy: { sortOrder: 'asc' }, include: { devices: { orderBy: { type: 'asc' } } } } },
  })
  if (!venue) return null
  const courtIds = venue.courts.map((c) => c.id)
  const today = taipeiDateString(at)

  // 模擬設備的心跳：線上設備每次讀取時更新最後回報時間（只在展示資料庫）
  if (integ.mode === 'SIMULATED') {
    await prisma.device.updateMany({ where: { court: { venueId: venue.id }, status: 'ONLINE' }, data: { lastSeen: at } })
  }

  const [current, upcoming] = await Promise.all([
    prisma.reservation.findMany({
      where: { courtId: { in: courtIds }, startsAt: { lte: at }, endsAt: { gt: at }, status: { in: ['BOOKED', 'EVENT', 'BLOCKED'] } },
      include: {
        booking: { select: { id: true, code: true, contactName: true, contactPhone: true } },
        session: { select: { id: true, title: true, startAt: true, endAt: true, registrations: { where: { status: 'CONFIRMED' }, select: { seats: true, checkedInAt: true } } } },
      },
    }),
    prisma.reservation.findMany({
      where: { courtId: { in: courtIds }, startsAt: { gt: at, lt: taipeiToUtc(addDays(today, 1), 0) }, status: { in: ['BOOKED', 'EVENT', 'BLOCKED'] } },
      include: { booking: { select: { code: true } }, session: { select: { title: true } } },
      orderBy: { startsAt: 'asc' },
    }),
  ])

  // 模擬資料要重讀（心跳已更新）
  const devices = integ.mode === 'SIMULATED'
    ? await prisma.device.findMany({ where: { courtId: { in: courtIds } }, orderBy: { type: 'asc' } })
    : venue.courts.flatMap((c) => c.devices)

  const courts = venue.courts.map((c) => {
    const cur = current.find((r) => r.courtId === c.id)
    const next = upcoming.find((r) => r.courtId === c.id)
    let usage: { kind: 'BOOKING' | 'EVENT' | 'BLOCKED'; label: string; until: string; link: string | null } | null = null
    let checkIn: string
    if (cur?.status === 'EVENT' && cur.session) {
      const confirmed = cur.session.registrations.reduce((s, r) => s + r.seats, 0)
      const checked = cur.session.registrations.filter((r) => r.checkedInAt).reduce((s, r) => s + r.seats, 0)
      usage = { kind: 'EVENT', label: `活動「${cur.session.title}」`, until: formatDateTime(cur.session.endAt), link: `/admin/sessions/${cur.session.id}` }
      checkIn = `活動報到 ${checked}／${confirmed} 位`
    } else if (cur?.status === 'BOOKED' && cur.booking) {
      usage = { kind: 'BOOKING', label: `訂單 ${cur.booking.code}（${cur.booking.contactName.slice(0, 1)}○○ ${maskPhone(cur.booking.contactPhone)}）`, until: formatDateTime(cur.endsAt), link: `/admin/bookings?order=${cur.booking.id}` }
      checkIn = '場地報到資料尚未串接'
    } else if (cur?.status === 'BLOCKED') {
      usage = { kind: 'BLOCKED', label: `封場：${cur.note ?? '維護'}`, until: formatDateTime(cur.endsAt), link: '/admin/maintenance' }
      checkIn = '—'
    } else {
      checkIn = '目前沒有預約'
    }

    const courtDevices = devices.filter((d) => d.courtId === c.id)
    const deviceViews = courtDevices
      .filter((d) => d.type !== 'CAMERA' || integ.mode === 'SIMULATED')
      .map((d) => {
        let state: DeviceState = 'NOT_CONNECTED'
        if (integ.mode === 'SIMULATED') {
          if (d.status === 'OFFLINE') state = 'OFFLINE'
          else if (at.getTime() - d.lastSeen.getTime() > STALE_MS) state = 'UNKNOWN'
          else state = 'ONLINE'
        }
        return {
          id: d.id,
          type: d.type,
          typeLabel: DEVICE_TYPE_LABEL[d.type] ?? d.type,
          name: d.name,
          state,
          lastSeen: integ.mode === 'SIMULATED' ? d.lastSeen.toISOString() : null,
          lastAction: integ.mode === 'SIMULATED' ? d.lastAction : null,
          simulated: integ.mode === 'SIMULATED',
        }
      })

    // 感測器：展示環境以模擬的人流感測（攝影機的 lastAction OCCUPIED / EMPTY）表示；正式環境尚未串接
    const sensorDevice = integ.mode === 'SIMULATED' ? courtDevices.find((d) => d.type === 'CAMERA') : null
    let sensor: { state: 'NOT_CONNECTED' | 'OCCUPIED' | 'EMPTY' | 'UNKNOWN'; updatedAt: string | null; simulated: boolean } = {
      state: 'NOT_CONNECTED',
      updatedAt: null,
      simulated: false,
    }
    if (sensorDevice) {
      const stale = sensorDevice.status === 'OFFLINE' || at.getTime() - sensorDevice.lastSeen.getTime() > STALE_MS
      sensor = {
        state: stale ? 'UNKNOWN' : sensorDevice.lastAction === 'OCCUPIED' ? 'OCCUPIED' : 'EMPTY',
        updatedAt: sensorDevice.lastSeen.toISOString(),
        simulated: true,
      }
    }

    // 預約與感測不一致時提示
    let mismatch: string | null = null
    if (sensor.state === 'OCCUPIED' && !usage) mismatch = '感測到有人，但目前沒有預約'
    if (sensor.state === 'EMPTY' && usage && usage.kind !== 'BLOCKED') mismatch = '有預約，但感測器目前未偵測到人'

    return {
      id: c.id,
      name: c.name,
      courtStatus: c.status,
      usage,
      next: next
        ? {
            label: next.status === 'EVENT' ? `活動「${next.session?.title ?? ''}」` : next.status === 'BLOCKED' ? `封場：${next.note ?? '維護'}` : `訂單 ${next.booking?.code ?? ''}`,
            at: activityTimeLabel(taipeiMinuteOfDay(next.startsAt), taipeiMinuteOfDay(next.startsAt) + 60).split('–')[0],
            startsAt: next.startsAt.toISOString(),
          }
        : null,
      checkIn,
      sensor,
      mismatch,
      devices: deviceViews,
    }
  })

  const seen = integ.mode === 'SIMULATED' ? devices.map((d) => d.lastSeen.getTime()) : []
  return {
    venue: { id: venue.id, name: venue.name },
    integration: integ,
    generatedAt: at.toISOString(),
    lastDeviceUpdate: seen.length ? new Date(Math.max(...seen)).toISOString() : null,
    deviceRecords: venue.courts.reduce((s, c) => s + c.devices.length, 0),
    courts,
    counts: {
      inUseByBooking: courts.filter((c) => c.usage && c.usage.kind !== 'BLOCKED').length,
      blocked: courts.filter((c) => c.usage?.kind === 'BLOCKED').length,
      offline: courts.reduce((s, c) => s + c.devices.filter((d) => d.state === 'OFFLINE').length, 0),
      unknown: courts.reduce((s, c) => s + c.devices.filter((d) => d.state === 'UNKNOWN').length, 0),
    },
  }
}

export type MonitorSnapshot = NonNullable<Awaited<ReturnType<typeof getMonitorSnapshot>>>

/* ─────────────────────────── 設備指令 ─────────────────────────── */

export class DeviceCommandError extends Error {}

export const ACTIONS_BY_TYPE: Record<string, { action: string; label: string }[]> = {
  DOOR: [
    { action: 'UNLOCK', label: '開門' },
    { action: 'LOCK', label: '上鎖' },
  ],
  LIGHTS: [
    { action: 'ON', label: '開燈' },
    { action: 'OFF', label: '關燈' },
  ],
  FANS: [
    { action: 'ON', label: '開啟' },
    { action: 'OFF', label: '關閉' },
  ],
}

/** 預覽：列出操作對象、影響與安全檢查結果（不送出） */
export async function previewDeviceCommand(deviceId: string, action: string) {
  const integ = await deviceIntegration()
  const d = await prisma.device.findUnique({ where: { id: deviceId }, include: { court: { include: { venue: { select: { name: true } } } } } })
  if (!d) throw new DeviceCommandError('找不到設備')
  const allowed = ACTIONS_BY_TYPE[d.type]?.some((a) => a.action === action)
  if (!allowed) throw new DeviceCommandError('這個設備不支援此動作')
  const label = ACTIONS_BY_TYPE[d.type].find((a) => a.action === action)!.label
  const warnings: string[] = []
  const blockers: string[] = []
  if (integ.mode !== 'SIMULATED') blockers.push(integ.reason)

  const at = now()
  const soon = new Date(at.getTime() + 15 * 60_000)
  const busy = await prisma.reservation.findFirst({
    where: { courtId: d.courtId, status: { in: ['BOOKED', 'EVENT'] }, startsAt: { lt: soon }, endsAt: { gt: at } },
    include: { booking: { select: { code: true } }, session: { select: { title: true } } },
  })
  if ((d.type === 'LIGHTS' || d.type === 'FANS') && action === 'OFF') {
    if (busy) blockers.push(`場地目前或 15 分鐘內有${busy.session ? `活動「${busy.session.title}」` : `訂單 ${busy.booking?.code ?? ''}`}，不可關閉`)
    const sensor = await prisma.device.findFirst({ where: { courtId: d.courtId, type: 'CAMERA' } })
    const sensorKnown = integ.mode === 'SIMULATED' && sensor && sensor.status === 'ONLINE' && at.getTime() - sensor.lastSeen.getTime() <= STALE_MS
    if (!sensorKnown) blockers.push('現場是否有人無法確認（感測器未串接或資料過期），為避免影響現場人員不可關閉')
    else if (sensor?.lastAction === 'OCCUPIED') blockers.push('感測器偵測到現場有人，不可關閉')
  }
  if (d.type === 'DOOR' && action === 'UNLOCK') warnings.push('開門會讓非預約者也能進入，請確認現場需求；此指令不影響逃生門（逃生門不受本系統控制）')
  if (d.status === 'OFFLINE') warnings.push('設備目前離線，指令可能失敗或逾時')

  return {
    device: { id: d.id, name: d.name, typeLabel: DEVICE_TYPE_LABEL[d.type] ?? d.type },
    court: d.court.name,
    venue: d.court.venue.name,
    action,
    actionLabel: label,
    simulated: integ.mode === 'SIMULATED',
    warnings,
    blockers,
  }
}

export async function sendDeviceCommand(params: { deviceId: string; action: string; idempotencyKey: string; reason: string; actor: string }) {
  const existing = await prisma.deviceCommand.findUnique({ where: { idempotencyKey: params.idempotencyKey } })
  if (existing) return existing
  const preview = await previewDeviceCommand(params.deviceId, params.action)
  if (preview.blockers.length > 0) throw new DeviceCommandError(preview.blockers.join('；'))
  const cmd = await prisma.deviceCommand.create({
    data: {
      deviceId: params.deviceId,
      action: params.action,
      status: 'SENT',
      idempotencyKey: params.idempotencyKey,
      reason: params.reason.slice(0, 200) || null,
      simulated: preview.simulated,
      requestedBy: params.actor,
      sentAt: now(),
    },
  })
  await prisma.auditLog.create({
    data: { actor: params.actor, action: 'DEVICE_COMMAND', target: `${preview.court} ${preview.device.name}`, detail: { action: params.action, commandId: cmd.id, simulated: preview.simulated } },
  })
  return cmd
}

/** 查詢指令結果。模擬設備：線上設備約 2 秒回報完成；離線設備回報失敗；30 秒無回報為逾時 */
export async function refreshDeviceCommand(id: string) {
  const cmd = await prisma.deviceCommand.findUnique({ where: { id }, include: { device: true } })
  if (!cmd) throw new DeviceCommandError('找不到指令')
  if (cmd.status !== 'SENT' || !cmd.sentAt) return cmd
  const elapsed = now().getTime() - cmd.sentAt.getTime()
  if (cmd.simulated) {
    if (cmd.device.status === 'OFFLINE' && elapsed > ACK_AFTER_MS) {
      return prisma.deviceCommand.update({ where: { id }, data: { status: 'FAILED', error: '設備離線，未回應（模擬）' } })
    }
    if (cmd.device.status !== 'OFFLINE' && elapsed > ACK_AFTER_MS) {
      const lastAction = cmd.action === 'UNLOCK' ? 'UNLOCKED' : cmd.action === 'LOCK' ? 'LOCKED' : cmd.action
      await prisma.device.update({ where: { id: cmd.deviceId }, data: { lastAction, lastSeen: now() } })
      return prisma.deviceCommand.update({ where: { id }, data: { status: 'ACKED', ackAt: now() } })
    }
  }
  if (elapsed > TIMEOUT_MS) return prisma.deviceCommand.update({ where: { id }, data: { status: 'TIMEOUT', error: '設備逾時未回報' } })
  return cmd
}

export async function recentCommands(limit = 20) {
  return prisma.deviceCommand.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { device: { include: { court: { select: { name: true } } } } } })
}

/* ─────────────────────────── 異常事件 ─────────────────────────── */

interface Detected {
  dedupeKey: string
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  detail?: string
  link?: string
}

/** 偵測目前的異常；新事件建立、已不存在的自動事件標記解除。可重複執行。 */
export async function detectIncidents() {
  const integ = await deviceIntegration()
  const found: Detected[] = []
  const at = now()

  if (integ.mode === 'SIMULATED') {
    const devices = await prisma.device.findMany({ include: { court: { select: { name: true } } } })
    for (const d of devices) {
      if (d.status === 'OFFLINE') {
        found.push({ dedupeKey: `DEVICE_OFFLINE:${d.id}`, type: 'DEVICE_OFFLINE', severity: 'HIGH', title: `${d.court.name} ${d.name}離線`, detail: `最後回報 ${formatDateTime(d.lastSeen)}（模擬）`, link: '/admin/control' })
      } else if (at.getTime() - d.lastSeen.getTime() > STALE_MS) {
        found.push({ dedupeKey: `DEVICE_STALE:${d.id}`, type: 'DEVICE_STALE', severity: 'MEDIUM', title: `${d.court.name} ${d.name}狀態未知`, detail: `超過 5 分鐘沒有回報（模擬）`, link: '/admin/monitor' })
      }
    }
  }
  const [refundPending, failedRefunds, manualRefunds, noOccupancy, failedPayments] = await Promise.all([
    prisma.booking.findMany({ where: { status: 'REFUND_PENDING' }, select: { id: true, code: true, total: true } }),
    prisma.booking.findMany({ where: { refundStatus: 'FAILED' }, select: { id: true, code: true } }),
    prisma.refund.findMany({ where: { status: 'MANUAL_PENDING' }, include: { booking: { select: { id: true, code: true } } } }),
    prisma.session.findMany({
      where: { deletedAt: null, status: { notIn: ['CANCELLED', 'DRAFT', 'COMPLETED'] }, endAt: { gt: at }, courts: { some: {} }, occupancy: { none: {} } },
      select: { id: true, title: true, startAt: true },
      take: 20,
    }),
    prisma.payment.findMany({
      where: { status: 'FAILED', createdAt: { gte: new Date(at.getTime() - 24 * 3600_000) }, booking: { status: 'PENDING' } },
      include: { booking: { select: { id: true, code: true } } },
      take: 20,
    }),
  ])
  for (const b of refundPending) found.push({ dedupeKey: `PAYMENT_AFTER_EXPIRY:${b.id}`, type: 'PAYMENT_AFTER_EXPIRY', severity: 'HIGH', title: `訂單 ${b.code} 款項待退`, detail: '付款時時段或名額已失效，需要退款', link: `/admin/bookings?order=${b.id}` })
  for (const b of failedRefunds) found.push({ dedupeKey: `REFUND_FAILED:${b.id}`, type: 'REFUND_FAILED', severity: 'HIGH', title: `訂單 ${b.code} 退款失敗`, detail: '請查看失敗原因後重試或改人工處理', link: `/admin/bookings?order=${b.id}` })
  for (const r of manualRefunds) found.push({ dedupeKey: `REFUND_MANUAL:${r.id}`, type: 'REFUND_MANUAL', severity: 'MEDIUM', title: `訂單 ${r.booking.code} 待人工退款 NT$${r.cashAmount}`, link: `/admin/bookings?order=${r.booking.id}` })
  for (const s of noOccupancy) found.push({ dedupeKey: `OCCUPANCY_CONFLICT:${s.id}`, type: 'OCCUPANCY_CONFLICT', severity: 'MEDIUM', title: `活動「${s.title}」${formatDateTime(s.startAt)} 未佔用場地`, detail: '場地可能已被其他預約使用，請調整時段或場地', link: `/admin/sessions/${s.id}` })
  for (const p of failedPayments) found.push({ dedupeKey: `PAYMENT_FAILED:${p.id}`, type: 'PAYMENT_FAILED', severity: 'LOW', title: `訂單 ${p.booking.code} 付款失敗`, detail: p.failReason ?? undefined, link: `/admin/bookings?order=${p.booking.id}` })

  for (const f of found) {
    const existing = await prisma.incident.findUnique({ where: { dedupeKey: f.dedupeKey } })
    if (!existing) {
      await prisma.incident.create({ data: { ...f, detail: f.detail ?? null, link: f.link ?? null } }).catch(() => {})
    } else if (existing.status === 'RESOLVED' && existing.resolvedBy === 'system') {
      await prisma.incident.update({ where: { id: existing.id }, data: { status: 'OPEN', resolvedAt: null, resolvedBy: null, title: f.title, detail: f.detail ?? null } })
    }
  }
  const keys = new Set(found.map((f) => f.dedupeKey))
  const open = await prisma.incident.findMany({ where: { status: { in: ['OPEN', 'ACKED'] } }, select: { id: true, dedupeKey: true } })
  const gone = open.filter((i) => !keys.has(i.dedupeKey)).map((i) => i.id)
  if (gone.length) await prisma.incident.updateMany({ where: { id: { in: gone } }, data: { status: 'RESOLVED', resolvedAt: at, resolvedBy: 'system', note: '狀況已排除（系統自動偵測）' } })
  return found.length
}

const SEVERITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export async function listIncidents(status: 'OPEN' | 'ALL' = 'OPEN', limit = 100) {
  const rows = await prisma.incident.findMany({
    where: status === 'OPEN' ? { status: { in: ['OPEN', 'ACKED'] } } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || b.createdAt.getTime() - a.createdAt.getTime())
}

export async function updateIncident(id: string, status: 'ACKED' | 'RESOLVED', note: string, actor: string) {
  const inc = await prisma.incident.findUnique({ where: { id } })
  if (!inc) throw new Error('找不到事件')
  await prisma.incident.update({
    where: { id },
    data: { status, note: note.trim().slice(0, 300) || inc.note, ...(status === 'RESOLVED' ? { resolvedAt: now(), resolvedBy: actor } : {}) },
  })
  await prisma.auditLog.create({ data: { actor, action: status === 'RESOLVED' ? 'INCIDENT_RESOLVED' : 'INCIDENT_ACKED', target: inc.title, detail: { note } } })
}
