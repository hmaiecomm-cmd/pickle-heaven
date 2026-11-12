import { CIRCUIT_DEFINITIONS, DEFAULT_CIRCUIT_CONFIG, type CircuitNumber } from './control-types'

/**
 * 球館平面配置：依「電力回路終點配置圖（1～18）」繪製，比例為示意。
 * 座標單位：平面圖 viewBox 136 × 66。這裡不含任何硬體連線資訊。
 */

export const PLAN_WIDTH = 136
export const PLAN_HEIGHT = 66

export type ZoneId =
  | 'restroom'
  | 'proshop'
  | 'dining'
  | 'office'
  | 'entrance'
  | 'deck'
  | 'courtB'
  | 'courtA'
  | 'parking'
  | 'outdoor'

export interface VenueZone {
  id: ZoneId
  name: string
  x: number
  y: number
  w: number
  h: number
  tone: 'court' | 'room' | 'service' | 'deck' | 'outdoor'
}

export const VENUE_ZONES: VenueZone[] = [
  { id: 'restroom', name: '浴廁', x: 17, y: 8, w: 16, h: 22, tone: 'service' },
  { id: 'proshop', name: 'Pro Shop', x: 33, y: 17, w: 37, h: 13, tone: 'room' },
  { id: 'dining', name: '桌區', x: 70, y: 17, w: 31, h: 13, tone: 'room' },
  { id: 'office', name: '辦公室', x: 74, y: 8, w: 27, h: 9, tone: 'service' },
  { id: 'entrance', name: '出入口', x: 101, y: 8, w: 12, h: 22, tone: 'outdoor' },
  { id: 'deck', name: '休息區（站板）', x: 6, y: 32, w: 107, h: 10, tone: 'deck' },
  { id: 'courtB', name: '球場 B', x: 8, y: 43, w: 54, h: 21, tone: 'court' },
  { id: 'courtA', name: '球場 A', x: 63, y: 43, w: 50, h: 21, tone: 'court' },
  { id: 'parking', name: '停車場', x: 119, y: 43, w: 15, h: 21, tone: 'outdoor' },
]

/** 建築外框（浴廁、Pro Shop、桌區、辦公室、出入口所在的主建築） */
export const BUILDING = { x: 17, y: 8, w: 96, h: 22 }

/** 電線桿位置（迴路 12 的終點在旁邊） */
export const UTILITY_POLE = { x: 117, y1: 24, y2: 64 }

export type DeviceKind = 'light' | 'fan' | 'outlet' | 'sign' | 'heater' | 'ambient' | 'groundLight' | 'door' | 'ac' | 'network' | 'appliance' | 'vending'

export interface CircuitPlacement {
  circuit: CircuitNumber
  zone: ZoneId
  kind: DeviceKind
  x: number
  y: number
}

/** 終點位置；同一迴路有多個終點時會出現多筆（例如 08 壁掛扇 4 台） */
export const CIRCUIT_PLACEMENTS: CircuitPlacement[] = [
  { circuit: '01', zone: 'courtA', kind: 'light', x: 88, y: 46 },
  { circuit: '02', zone: 'courtA', kind: 'fan', x: 88, y: 61 },
  { circuit: '03', zone: 'courtB', kind: 'light', x: 35, y: 46 },
  { circuit: '04', zone: 'courtB', kind: 'fan', x: 35, y: 61 },
  { circuit: '06', zone: 'proshop', kind: 'light', x: 47, y: 21 },
  { circuit: '06', zone: 'proshop', kind: 'light', x: 59, y: 25 },
  { circuit: '07', zone: 'proshop', kind: 'outlet', x: 67, y: 25 },
  { circuit: '08', zone: 'deck', kind: 'fan', x: 36, y: 35 },
  { circuit: '08', zone: 'deck', kind: 'fan', x: 58, y: 35 },
  { circuit: '08', zone: 'deck', kind: 'fan', x: 76, y: 35 },
  { circuit: '08', zone: 'deck', kind: 'fan', x: 98, y: 35 },
  { circuit: '09', zone: 'outdoor', kind: 'heater', x: 12, y: 16 },
  { circuit: '10', zone: 'deck', kind: 'ambient', x: 12, y: 35 },
  { circuit: '11', zone: 'deck', kind: 'groundLight', x: 12, y: 39.5 },
  { circuit: '12', zone: 'outdoor', kind: 'door', x: 121, y: 20 },
  { circuit: '14', zone: 'office', kind: 'network', x: 95, y: 12.5 },
  { circuit: '15', zone: 'office', kind: 'appliance', x: 85, y: 12.5 },
  { circuit: '16', zone: 'dining', kind: 'vending', x: 87, y: 26 },
]

/** 配置圖上尚未標出位置的迴路（17、18 為預留，不列入） */
export const UNPLACED_CIRCUITS: CircuitNumber[] = ['05', '13']

/** 只是位置標記，不是電力迴路，不可控制 */
export const LOCATION_MARKERS: { id: string; zone: ZoneId; name: string; x: number; y: number }[] = [
  { id: 'restroom', zone: 'restroom', name: '浴廁', x: 25, y: 22 },
]

export interface CircuitSpec {
  /** 設備數量，例如「8 盞」 */
  units?: string
  voltage: string
  load: string
  /** 補充說明，例如涵蓋範圍 */
  note?: string
}

/** 依「18 路強電控制迴路清單」；未確認的項目保留「待確認」 */
export const CIRCUIT_SPECS: Record<CircuitNumber, CircuitSpec> = {
  '01': { units: '8 盞', voltage: '220V', load: '2,400W（約 300W × 8）' },
  '02': { units: '4 台', voltage: '220V', load: '4,800W（約 1,200W × 4）' },
  '03': { units: '8 盞', voltage: '220V', load: '2,400W（約 300W × 8）' },
  '04': { units: '4 台', voltage: '220V', load: '4,800W（約 1,200W × 4）' },
  '05': { voltage: '110V／220V', load: '待確認' },
  '06': { voltage: '110V（全電壓燈具）', load: '待確認', note: '含廁所及辦公室照明' },
  '07': { voltage: '110V', load: '待確認' },
  '08': { units: '4 台', voltage: '220V', load: '待確認' },
  '09': { units: '2 台', voltage: '220V', load: '待確認（依機型）' },
  '10': { voltage: '110V', load: '待確認' },
  '11': { voltage: '220V', load: '100W' },
  '12': { voltage: '110V／220V', load: '待確認' },
  '13': { units: '3 台', voltage: '220V', load: '6,315W（2,105W × 3）' },
  '14': { voltage: '220V', load: '待確認' },
  '15': { voltage: '110V', load: '待確認' },
  '16': { voltage: '220V', load: '待確認' },
  '17': { voltage: '220V', load: '未定' },
  '18': { voltage: '220V', load: '未定' },
}

export const isPending = (v: string) => /待確認|未定/.test(v)

export type CircuitCategory = (typeof CIRCUIT_DEFINITIONS)[CircuitNumber]['category']

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const { businessHours, nightAmbience } = DEFAULT_CIRCUIT_CONFIG

export const CATEGORY_INFO: Record<CircuitCategory, { label: string; range: string; schedule: string; rule: string; tone: string }> = {
  RESERVATION_DYNAMIC: {
    label: '預約動態控制',
    range: '01–04',
    schedule: '依線上預約',
    rule: '依線上預約自動開／關；開打前提前開啟、結束後延遲關閉的分鐘數待設定。',
    tone: 'blue',
  },
  OPERATING_HOURS: {
    label: '營業時間控制',
    range: '05–09',
    schedule: `${hhmm(businessHours.startMinute)}–${hhmm(businessHours.endMinute)}`,
    rule: `營業時間 ${hhmm(businessHours.startMinute)}–${hhmm(businessHours.endMinute)} 供電（可調整）。`,
    tone: 'green',
  },
  NIGHT_AMBIENT: {
    label: '環境夜間控制',
    range: '10–11',
    schedule: `${hhmm(nightAmbience.startMinute)}–${hhmm(nightAmbience.endMinute)}`,
    rule: `夜間 ${hhmm(nightAmbience.startMinute)}–${hhmm(nightAmbience.endMinute)} 開啟（可調整）。`,
    tone: 'orange',
  },
  ALWAYS_ON: {
    label: '24 小時供電',
    range: '12–16',
    schedule: '不斷電（Bypass）',
    rule: '不斷電供電（Bypass），不排程關閉，也不套用預約自動斷電。24 小時供電不代表設備全天開機，設備是否運轉由設備自行控制。',
    tone: 'purple',
  },
  RESERVED: {
    label: '預留迴路',
    range: '17–18',
    schedule: '—',
    rule: '保留未來擴充使用，目前未接設備、不啟用。',
    tone: 'zinc',
  },
}

export const ZONE_NAME: Record<ZoneId, string> = {
  ...(Object.fromEntries(VENUE_ZONES.map((z) => [z.id, z.name])) as Record<ZoneId, string>),
  outdoor: '戶外',
}

/** 迴路的位置說明（多個終點時列出區域） */
export function circuitLocation(n: CircuitNumber): string {
  if (UNPLACED_CIRCUITS.includes(n)) return '位置待確認'
  const zones = [...new Set(CIRCUIT_PLACEMENTS.filter((p) => p.circuit === n).map((p) => ZONE_NAME[p.zone]))]
  if (n === '09') return '建築左外側（戶外）'
  if (n === '12') return '電線桿旁（戶外）'
  return zones.join('、') || '—'
}

export const CIRCUIT_NUMBERS = Object.keys(CIRCUIT_DEFINITIONS) as CircuitNumber[]
