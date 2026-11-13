import { VENUE_ZONES, type ZoneId } from './venue-layout'

/**
 * 即時監控的 6 支攝影機（Camera 01–06）預設值。
 * 名稱、區域、平面圖位置可在「攝影機管理」修改（存在 MonitorCamera 資料表）；沒有資料列時使用這裡的預設。
 * 座標使用 venue-layout 的平面圖 viewBox（136 × 66）。這裡只放顯示資料，不含任何串流網址或憑證。
 */

export const CAMERA_IDS = ['01', '02', '03', '04', '05', '06'] as const
export type CameraId = (typeof CAMERA_IDS)[number]

export interface CameraDefaults {
  id: CameraId
  name: string
  zone: ZoneId
  x: number
  y: number
  /** 拍攝方向（度；0 = 向右，90 = 向下） */
  facing: number
  coverage: string
}

export const DEFAULT_CAMERAS: CameraDefaults[] = [
  { id: '01', name: '球場 A－中央', zone: 'courtA', x: 88, y: 44.2, facing: 90, coverage: '球場 A 全場（由中央上方俯拍）' },
  { id: '02', name: '球場 A－側邊', zone: 'courtA', x: 111.5, y: 53.5, facing: 180, coverage: '球場 A 側邊與邊線' },
  { id: '03', name: '室內休息區', zone: 'dining', x: 99, y: 19.5, facing: 165, coverage: '室內休息區座位、飲料販賣機' },
  { id: '04', name: '門口休息區', zone: 'deck', x: 110.5, y: 33.6, facing: 180, coverage: '門口旁戶外座位區與門口動線' },
  { id: '05', name: '球場 B－中央', zone: 'courtB', x: 35, y: 44.2, facing: 90, coverage: '球場 B 全場（由中央上方俯拍）' },
  { id: '06', name: '出入口／大門', zone: 'entrance', x: 111, y: 10, facing: 200, coverage: '大門與進出人員' },
]

export const cameraCode = (id: string) => `Camera ${id}`
export const cameraTitle = (id: string, name: string) => `攝影機 ${id}｜${name}`

export function isCameraId(v: unknown): v is CameraId {
  return typeof v === 'string' && (CAMERA_IDS as readonly string[]).includes(v)
}

/** 前一支／下一支（循環），供主畫面切換 */
export function stepCamera<T extends string>(ids: readonly T[], id: T, delta: 1 | -1): T {
  const i = Math.max(0, ids.indexOf(id))
  return ids[(i + delta + ids.length) % ids.length]
}

/**
 * Demo Mode 的示範影像（只有 03、04 有現場照片）。照片不是即時串流，畫面上一律標示「示範影像」。
 * 04 的主畫面用整張外觀照（保留建築、招牌、綠化），縮圖取景在門口休息區。
 */
export const DEMO_MEDIA: Partial<Record<CameraId, { main: string; mainPosition: string; thumb: string; thumbPosition: string }>> = {
  '03': { main: '/monitor-demo/cam03-indoor-lounge.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam03-indoor-lounge.jpg', thumbPosition: '50% 55%' },
  '04': { main: '/monitor-demo/cam04-entrance-full.jpg', mainPosition: '50% 70%', thumb: '/monitor-demo/cam04-entrance-lounge.jpg', thumbPosition: '45% 60%' },
}

/** 攝影機可選的區域 */
export const CAMERA_ZONES: { id: ZoneId; name: string }[] = [...VENUE_ZONES.map((z) => ({ id: z.id, name: z.name })), { id: 'outdoor', name: '戶外' }]

export const STREAM_PROTOCOLS = ['NVR', 'RTSP', 'HLS', 'WEBRTC'] as const
export type StreamProtocol = (typeof STREAM_PROTOCOLS)[number]
export const PROTOCOL_LABEL: Record<StreamProtocol, string> = { NVR: 'NVR 通道', RTSP: 'RTSP', HLS: 'HLS', WEBRTC: 'WebRTC' }

/** 平面圖上的拍攝範圍扇形（SVG path） */
export function conePath(c: { x: number; y: number; facing: number }, length = 9, spread = 50): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const a1 = rad(c.facing - spread / 2)
  const a2 = rad(c.facing + spread / 2)
  const p = (a: number) => `${(c.x + length * Math.cos(a)).toFixed(2)} ${(c.y + length * Math.sin(a)).toFixed(2)}`
  return `M ${c.x} ${c.y} L ${p(a1)} A ${length} ${length} 0 0 1 ${p(a2)} Z`
}
