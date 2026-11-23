import type { CircuitDef, CircuitInterval, DoorCode, SitePlan } from '../../../packages/iot-contract/src/index'

/**
 * 模擬用的場館計畫（迴路配置與平台 src/lib/control-types.ts 一致）：
 *   01–04 球場 A/B 燈與涼風扇（依預約）
 *   05–09 招牌、ProShop、休息區風扇、熱水器（依營業時間）
 *   10–11 露營燈、地燈（夜間）
 *   12–16 24 小時供電（不可動）
 */
export const DEMO_CIRCUITS: CircuitDef[] = [
  { no: '01', name: '球場 A 主燈', kind: 'COURT', court: 'A', channel: 1, remote: true, schedule: true },
  { no: '02', name: '球場 A 涼風扇', kind: 'COURT', court: 'A', channel: 2, remote: true, schedule: true },
  { no: '03', name: '球場 B 主燈', kind: 'COURT', court: 'B', channel: 3, remote: true, schedule: true },
  { no: '04', name: '球場 B 涼風扇', kind: 'COURT', court: 'B', channel: 4, remote: true, schedule: true },
  { no: '05', name: '大門與 Pro Shop 招牌', kind: 'BUSINESS', channel: 5, remote: true, schedule: true },
  { no: '06', name: 'Pro Shop 室內照明', kind: 'BUSINESS', channel: 6, remote: true, schedule: true },
  { no: '07', name: 'Pro Shop 室內插座', kind: 'BUSINESS', channel: 7, remote: true, schedule: true },
  { no: '08', name: '休息區壁掛扇', kind: 'BUSINESS', channel: 8, remote: true, schedule: true },
  { no: '09', name: '浴室熱水器', kind: 'BUSINESS', channel: 9, remote: true, schedule: true, maxOnMinutes: 180 },
  { no: '10', name: '環境氣氛燈－露營燈', kind: 'NIGHT', channel: 10, remote: true, schedule: true },
  { no: '11', name: '環境氣氛燈－地燈', kind: 'NIGHT', channel: 11, remote: true, schedule: true },
  { no: '12', name: '大門監控與門鎖供電', kind: 'ALWAYS_ON', channel: 12, remote: false, schedule: false },
  { no: '13', name: 'Pro Shop 冷氣供電', kind: 'ALWAYS_ON', channel: 13, remote: false, schedule: false },
  { no: '14', name: '辦公室弱電箱專用插座', kind: 'ALWAYS_ON', channel: 14, remote: false, schedule: false },
  { no: '15', name: '辦公室電器', kind: 'ALWAYS_ON', channel: 15, remote: false, schedule: false },
  { no: '16', name: '販賣機專用插座', kind: 'ALWAYS_ON', channel: 16, remote: false, schedule: false },
]

const COURT_CIRCUITS: Record<string, string[]> = { A: ['01', '02'], B: ['03', '04'] }
const BUSINESS = ['05', '06', '07', '08', '09']
const NIGHT = ['10', '11']

/** 台北時間某日某分鐘 → epoch ms */
export function taipei(day: string, minute: number): number {
  return Date.parse(`${day}T00:00:00+08:00`) + minute * 60_000
}
export const hm = (h: number, m = 0) => h * 60 + m
const iso = (t: number) => new Date(t).toISOString()

export interface DemoBooking {
  court: 'A' | 'B'
  start: number
  end: number
  id?: string
  code?: string
}

export function buildDemoPlan(o: {
  siteId: string
  day: string
  generatedAt: number
  bookings?: DemoBooking[]
  openMinute?: number
  closeMinute?: number
  night?: [number, number]
  advanceMin?: number
  delayMin?: number
  codeOpenBeforeMin?: number
  codeExpireAfterMin?: number
  extraCodes?: DoorCode[]
}): SitePlan {
  const bookings = o.bookings ?? []
  const open = o.openMinute ?? hm(8)
  const close = o.closeMinute ?? hm(22)
  const [ns, ne] = o.night ?? [hm(18), hm(22)]
  const adv = (o.advanceMin ?? 5) * 60_000
  const delay = (o.delayMin ?? 5) * 60_000
  const timeline: CircuitInterval[] = []
  for (const b of bookings) {
    for (const c of COURT_CIRCUITS[b.court]) timeline.push({ circuit: c, start: iso(b.start - adv), end: iso(b.end + delay), reason: 'BOOKING', ref: b.id })
  }
  for (const c of BUSINESS) timeline.push({ circuit: c, start: iso(taipei(o.day, open)), end: iso(taipei(o.day, close)), reason: 'BUSINESS_HOURS' })
  for (const c of NIGHT) timeline.push({ circuit: c, start: iso(taipei(o.day, ns)), end: iso(taipei(o.day, ne)), reason: 'NIGHT' })
  const before = (o.codeOpenBeforeMin ?? 10) * 60_000
  const after = (o.codeExpireAfterMin ?? 30) * 60_000
  const doorCodes: DoorCode[] = bookings
    .filter((b) => b.code)
    .map((b, i) => ({ id: b.id ?? `code-${i}`, code: b.code!, validFrom: iso(b.start - before), validTo: iso(b.end + after), slotType: 'ORDER', doors: ['main'] }))
  return {
    contract: 'gh-iot/1',
    siteId: o.siteId,
    generatedAt: iso(o.generatedAt),
    timezone: 'Asia/Taipei',
    window: { from: iso(taipei(o.day, 0)), to: iso(taipei(o.day, 48 * 60)) },
    circuits: DEMO_CIRCUITS,
    timeline,
    overrides: [],
    doorCodes: [...doorCodes, ...(o.extraCodes ?? [])],
    business: { openMinute: open, closeMinute: close },
    audio: { welcome: 'welcome.mp3', opening: 'opening.mp3', ending: 'ending.mp3', goodnight: 'goodnight.mp3', doNotUseCourt: 'do_not_use_court.mp3' },
  }
}
