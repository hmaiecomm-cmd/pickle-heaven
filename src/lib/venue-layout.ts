import { CIRCUIT_DEFINITIONS, type CircuitNumber } from './control-types'

/**
 * 球館平面配置（示意）。區域與設備位置是依迴路名稱推估的示意圖，
 * 實際位置待現場確認；這裡不含任何硬體連線資訊。
 * 座標單位：平面圖 viewBox 100 × 70。
 */

export type ZoneId = 'entrance' | 'proshop' | 'lounge' | 'office' | 'shower' | 'toilet' | 'courtA' | 'courtB' | 'outdoor'

export interface VenueZone {
  id: ZoneId
  name: string
  x: number
  y: number
  w: number
  h: number
  tone: 'court' | 'room' | 'service' | 'outdoor'
}

export const VENUE_ZONES: VenueZone[] = [
  { id: 'courtA', name: '球場 A', x: 50, y: 3, w: 23, h: 64, tone: 'court' },
  { id: 'courtB', name: '球場 B', x: 75, y: 3, w: 23, h: 64, tone: 'court' },
  { id: 'proshop', name: 'Pro Shop', x: 12, y: 3, w: 35, h: 22, tone: 'room' },
  { id: 'lounge', name: '休息區', x: 12, y: 28, w: 35, h: 18, tone: 'room' },
  { id: 'office', name: '辦公室', x: 12, y: 49, w: 12, h: 18, tone: 'service' },
  { id: 'shower', name: '浴室', x: 26, y: 49, w: 10, h: 18, tone: 'service' },
  { id: 'toilet', name: '廁所', x: 38, y: 49, w: 9, h: 18, tone: 'service' },
  { id: 'entrance', name: '出入口', x: 2, y: 26, w: 8, h: 18, tone: 'outdoor' },
]

export type DeviceKind = 'light' | 'fan' | 'outlet' | 'sign' | 'heater' | 'ambient' | 'groundLight' | 'door' | 'ac' | 'network' | 'appliance' | 'vending'

export interface CircuitPlacement {
  circuit: CircuitNumber
  zone: ZoneId
  kind: DeviceKind
  x: number
  y: number
}

/** 有實體位置的迴路（17、18 為預留，不放在平面圖上） */
export const CIRCUIT_PLACEMENTS: CircuitPlacement[] = [
  { circuit: '01', zone: 'courtA', kind: 'light', x: 61.5, y: 20 },
  { circuit: '02', zone: 'courtA', kind: 'fan', x: 61.5, y: 50 },
  { circuit: '03', zone: 'courtB', kind: 'light', x: 86.5, y: 20 },
  { circuit: '04', zone: 'courtB', kind: 'fan', x: 86.5, y: 50 },
  { circuit: '05', zone: 'entrance', kind: 'sign', x: 5, y: 32.5 },
  { circuit: '06', zone: 'proshop', kind: 'light', x: 19, y: 13 },
  { circuit: '07', zone: 'proshop', kind: 'outlet', x: 29, y: 19 },
  { circuit: '08', zone: 'lounge', kind: 'fan', x: 19, y: 37 },
  { circuit: '09', zone: 'shower', kind: 'heater', x: 30, y: 58 },
  { circuit: '10', zone: 'lounge', kind: 'ambient', x: 29, y: 40 },
  { circuit: '11', zone: 'outdoor', kind: 'groundLight', x: 5, y: 57 },
  { circuit: '12', zone: 'entrance', kind: 'door', x: 5, y: 39.5 },
  { circuit: '13', zone: 'proshop', kind: 'ac', x: 39, y: 13 },
  { circuit: '14', zone: 'office', kind: 'network', x: 16, y: 56 },
  { circuit: '15', zone: 'office', kind: 'appliance', x: 16, y: 62.5 },
  { circuit: '16', zone: 'lounge', kind: 'vending', x: 39, y: 37 },
]

/** 只是位置標記，不是電力迴路，不可控制 */
export const LOCATION_MARKERS: { id: string; zone: ZoneId; name: string; x: number; y: number }[] = [
  { id: 'toilet', zone: 'toilet', name: '廁所', x: 42.5, y: 58 },
]

export type CircuitCategory = (typeof CIRCUIT_DEFINITIONS)[CircuitNumber]['category']

export const CATEGORY_INFO: Record<CircuitCategory, { label: string; range: string; rule: string; tone: string }> = {
  RESERVATION_DYNAMIC: {
    label: '預約動態控制',
    range: '01–04',
    rule: '依球場預約自動開關；開打前提前開啟、結束後延遲關閉的分鐘數待設定。',
    tone: 'emerald',
  },
  OPERATING_HOURS: {
    label: '營業時間控制',
    range: '05–09',
    rule: '營業時間內供電，營業時間外斷電；營業時段待設定。',
    tone: 'sky',
  },
  NIGHT_AMBIENT: {
    label: '環境夜間控制',
    range: '10–11',
    rule: '夜間時段開啟的環境氣氛燈；夜間時段待設定。',
    tone: 'violet',
  },
  ALWAYS_ON: {
    label: '24 小時供電',
    range: '12–16',
    rule: '迴路全天保持供電，不套用預約自動斷電。24 小時供電不代表設備全天開機，設備本身是否運轉由設備自行控制。',
    tone: 'amber',
  },
  RESERVED: {
    label: '預留',
    range: '17–18',
    rule: '預留迴路，目前未接設備、不啟用。',
    tone: 'zinc',
  },
}

export const ZONE_NAME: Record<ZoneId, string> = {
  ...(Object.fromEntries(VENUE_ZONES.map((z) => [z.id, z.name])) as Record<ZoneId, string>),
  outdoor: '戶外／動線',
}

export const CIRCUIT_NUMBERS = Object.keys(CIRCUIT_DEFINITIONS) as CircuitNumber[]
