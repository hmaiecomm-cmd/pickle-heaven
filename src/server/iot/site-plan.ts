import 'server-only'
import { CONTRACT_VERSION, type CameraDef, type CircuitDef, type CircuitInterval, type CircuitKind, type CircuitOverride, type DoorCode, type IntervalReason, type SitePlan } from '@gh/iot-contract'
import { prisma } from '@/lib/db'
import { circuitCommandBlocker } from '@/lib/circuit-guard'
import { CIRCUIT_DEFINITIONS, DEFAULT_CIRCUIT_CONFIG, type CircuitNumber } from '@/lib/control-types'
import { addDays, now, taipeiDateString, taipeiToUtc, taipeiWeekday } from '@/lib/time'
import { decryptCode } from '../slot-password-service'
import { DEFAULT_CAMERAS } from '@/lib/camera-layout'
import { activeSiteId } from './site-id'

/**
 * 組出給場館電腦的「場館計畫」：未來 48 小時（台北時間今天 00:00 起）的
 *   - 各迴路開啟時段（與 scheduling-service.calculateCircuitStates 同一套規則）
 *   - 仍在維持中的手動操作
 *   - 門禁密碼（時段密碼系統的 30 天滾動資料，只下發這 48 小時內會用到的）
 * 場館電腦依計畫自己執行，所以斷網也照常運作。
 */

export const PLAN_HOURS = 48
const MIN = 60_000
const COURT_CIRCUITS: CircuitNumber[][] = [
  ['01', '02'],
  ['03', '04'],
]
const COURT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
/** M-7045 只有 16 路；17、18 為預留，不下發 */
const MAX_CHANNEL = 16

const KIND: Record<string, CircuitKind> = {
  RESERVATION_DYNAMIC: 'COURT',
  OPERATING_HOURS: 'BUSINESS',
  NIGHT_AMBIENT: 'NIGHT',
  ALWAYS_ON: 'ALWAYS_ON',
  RESERVED: 'RESERVED',
}

type Window = { startMinute: number | null; endMinute: number | null; weekdays: string }

/** 每日時段 → 絕對時間區段（含跨日，例如 22:00–翌日 02:00 或 endMinute > 1440） */
function dailyIntervals(w: Window, from: Date, to: Date): { start: Date; end: Date }[] {
  if (w.startMinute === null || w.endMinute === null) return []
  const days = new Set(w.weekdays.split(',').map(Number))
  const out: { start: Date; end: Date }[] = []
  let day = addDays(taipeiDateString(from), -1)
  const last = taipeiDateString(to)
  for (let guard = 0; guard < 10 && day <= last; guard++, day = addDays(day, 1)) {
    if (!days.has(taipeiWeekday(day))) continue
    const endMinute = w.endMinute <= w.startMinute ? w.endMinute + 1440 : w.endMinute
    const start = taipeiToUtc(day, w.startMinute)
    const end = taipeiToUtc(day, endMinute)
    if (end > from && start < to) out.push({ start, end })
  }
  return out
}

function clipMerge(list: CircuitInterval[], from: Date, to: Date): CircuitInterval[] {
  const f = from.getTime()
  const t = to.getTime()
  const clipped = list
    .map((i) => ({ ...i, s: Math.max(f, Date.parse(i.start)), e: Math.min(t, Date.parse(i.end)) }))
    .filter((i) => i.e > i.s)
    .sort((a, b) => a.circuit.localeCompare(b.circuit) || a.s - b.s)
  const out: (CircuitInterval & { s: number; e: number })[] = []
  for (const i of clipped) {
    const prev = out[out.length - 1]
    // 同一迴路、同一原因且重疊或相連 → 合併
    if (prev && prev.circuit === i.circuit && prev.reason === i.reason && i.s <= prev.e) {
      prev.e = Math.max(prev.e, i.e)
      if (prev.ref !== i.ref) prev.ref = undefined
      continue
    }
    out.push({ ...i })
  }
  return out.map(({ s, e, ...i }) => ({ ...i, start: new Date(s).toISOString(), end: new Date(e).toISOString(), ...(i.ref ? { ref: i.ref } : {}) }))
}

export async function buildSitePlan(venueId: string, at: Date = now()): Promise<SitePlan | null> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      circuits: { include: { schedules: { where: { enabled: true } } }, orderBy: { circuitNumber: 'asc' } },
      courts: { where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true } },
    },
  })
  const siteId = venue ? activeSiteId(venue) : null
  if (!venue || !siteId) return null

  const from = taipeiToUtc(taipeiDateString(at), 0)
  const to = new Date(from.getTime() + PLAN_HOURS * 3600_000)

  // ── 迴路定義 ──
  const circuits: CircuitDef[] = []
  for (const c of venue.circuits) {
    const def = CIRCUIT_DEFINITIONS[c.circuitNumber as CircuitNumber]
    const mapping = (c.deviceMapping ?? {}) as { channel?: number; maxOnMinutes?: number }
    const channel = Number.isInteger(mapping.channel) ? mapping.channel! : Number(c.circuitNumber)
    if (!def || !(channel >= 1 && channel <= MAX_CHANNEL)) continue
    let kind = KIND[c.category] ?? 'RESERVED'
    if (!c.enabled) kind = 'RESERVED'
    const courtIndex = COURT_CIRCUITS.findIndex((g) => g.includes(c.circuitNumber as CircuitNumber))
    const maxOn = mapping.maxOnMinutes ?? (c.name.includes('熱水器') ? 180 : undefined)
    circuits.push({
      no: c.circuitNumber,
      name: c.name,
      kind,
      channel,
      ...(kind === 'COURT' && courtIndex >= 0 && venue.courts[courtIndex] ? { court: COURT_LETTERS[courtIndex] } : {}),
      remote: c.enabled && c.remoteControlEnabled && kind !== 'ALWAYS_ON' && kind !== 'RESERVED',
      schedule: c.enabled && c.scheduleControlEnabled && kind !== 'ALWAYS_ON' && kind !== 'RESERVED',
      ...(maxOn ? { maxOnMinutes: maxOn } : {}),
    })
  }

  // ── 時間表 ──
  const raw: CircuitInterval[] = []
  const iso = (d: Date) => d.toISOString()
  for (const c of venue.circuits) {
    const n = c.circuitNumber as CircuitNumber
    const def = CIRCUIT_DEFINITIONS[n]
    if (!def || !circuits.some((x) => x.no === n && x.schedule) || circuitCommandBlocker(c, 'SCHEDULE')) continue
    const own = c.schedules.filter((x) => x.category === def.category)
    const main = own.find((x) => x.note === null)
    const custom = own.filter((x) => x.note !== null)

    if (def.category === 'RESERVATION_DYNAMIC') {
      const court = venue.courts[COURT_CIRCUITS.findIndex((g) => g.includes(n))]
      if (!court) continue
      const adv = (c.reservationAdvanceMinutes ?? DEFAULT_CIRCUIT_CONFIG.reservation.advanceMinutes) * MIN
      const delay = (c.reservationDelayMinutes ?? DEFAULT_CIRCUIT_CONFIG.reservation.delayMinutes) * MIN
      const rows = await prisma.reservation.findMany({
        where: {
          courtId: court.id,
          startsAt: { lt: new Date(to.getTime() + adv) },
          endsAt: { gt: new Date(from.getTime() - delay) },
          OR: [
            { status: { in: ['BOOKED', 'EVENT'] } },
            { status: 'BLOCKED', maintenanceEventId: null, lighting: true },
            { status: 'BLOCKED', maintenanceEvent: { plan: { lighting: true } } },
          ],
        },
        select: { id: true, startsAt: true, endsAt: true, status: true },
      })
      for (const r of rows) {
        const reason: IntervalReason = r.status === 'EVENT' ? 'EVENT' : r.status === 'BLOCKED' ? 'BLOCKED' : 'BOOKING'
        raw.push({ circuit: n, start: iso(new Date(r.startsAt.getTime() - adv)), end: iso(new Date(r.endsAt.getTime() + delay)), reason, ref: r.id })
      }
    } else if (def.category === 'OPERATING_HOURS' || def.category === 'NIGHT_AMBIENT') {
      const base: Window = main ?? (def.category === 'OPERATING_HOURS' ? { startMinute: venue.openMinute, endMinute: venue.closeMinute, weekdays: '0,1,2,3,4,5,6' } : DEFAULT_CIRCUIT_CONFIG.nightAmbience)
      const reason: IntervalReason = def.category === 'OPERATING_HOURS' ? 'BUSINESS_HOURS' : 'NIGHT'
      for (const w of dailyIntervals(base, from, to)) raw.push({ circuit: n, start: iso(w.start), end: iso(w.end), reason })
      for (const s of custom) for (const w of dailyIntervals(s, from, to)) raw.push({ circuit: n, start: iso(w.start), end: iso(w.end), reason: 'CUSTOM', ref: s.id })
    }
  }

  // ── 手動操作 ──
  const overrides: CircuitOverride[] = venue.circuits
    .filter((c) => c.overrideMode && c.overrideState && circuits.some((x) => x.no === c.circuitNumber && x.remote))
    .filter((c) => c.overrideMode !== 'MINUTES' || (c.overrideUntil && c.overrideUntil > at))
    .map((c) => ({
      circuit: c.circuitNumber,
      state: c.overrideState as 'ON' | 'OFF',
      hold: { mode: c.overrideMode as 'NEXT_CHANGE' | 'MINUTES' | 'INDEFINITE', ...(c.overrideMode === 'MINUTES' && c.overrideUntil ? { until: c.overrideUntil.toISOString() } : {}) },
      ...(c.overrideBaseline === 'ON' || c.overrideBaseline === 'OFF' ? { baseline: c.overrideBaseline } : {}),
      ...(c.overrideBy ? { by: c.overrideBy } : {}),
    }))

  // ── 門禁密碼 ──
  const slots = await prisma.slotPassword.findMany({
    where: { venueId, status: { in: ['SCHEDULED', 'ACTIVE'] }, expireAt: { gt: at }, openAt: { lt: to } },
    orderBy: { openAt: 'asc' },
    select: { id: true, codeCiphertext: true, openAt: true, expireAt: true, slotType: true },
  })
  const doorCodes: DoorCode[] = []
  for (const s of slots) {
    try {
      doorCodes.push({ id: s.id, code: decryptCode(s.codeCiphertext), validFrom: s.openAt.toISOString(), validTo: s.expireAt.toISOString(), slotType: s.slotType, doors: ['main'] })
    } catch (err) {
      console.error('[iot] 無法解密時段密碼，略過', s.id, err)
    }
  }

  return {
    contract: CONTRACT_VERSION,
    siteId,
    generatedAt: at.toISOString(),
    timezone: venue.timezone,
    window: { from: from.toISOString(), to: to.toISOString() },
    circuits,
    timeline: clipMerge(raw, from, to),
    overrides,
    doorCodes,
    business: { openMinute: venue.openMinute, closeMinute: venue.closeMinute },
    audio: { welcome: 'welcome.mp3', opening: 'opening.mp3', ending: 'ending.mp3', goodnight: 'goodnight.mp3', doNotUseCourt: 'do_not_use_court.mp3' },
    cameras: await planCameras(),
  }
}

/** 6 支攝影機（NVR 通道）；球場攝影機標上球場，讓地端位移偵測對照預約 */
async function planCameras(): Promise<CameraDef[]> {
  const rows = await prisma.monitorCamera.findMany({ select: { id: true, name: true, zone: true, enabled: true } }).catch(() => [])
  const byId = new Map(rows.map((r) => [r.id, r]))
  return DEFAULT_CAMERAS.filter((d) => byId.get(d.id)?.enabled !== false).map((d) => {
    const r = byId.get(d.id)
    const zone = r?.zone ?? d.zone
    const court = zone === 'courtA' ? 'A' : zone === 'courtB' ? 'B' : undefined
    return { id: d.id, name: r?.name ?? d.name, ...(court ? { court } : {}) }
  })
}
