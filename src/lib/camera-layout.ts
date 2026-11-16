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
  { id: '01', name: 'QR 密碼鎖（門外）', zone: 'entrance', x: 107, y: 8, facing: 270, coverage: 'QR 密碼鎖與門外動線' },
  { id: '02', name: '門內監看（入口內側）', zone: 'entrance', x: 107, y: 22, facing: 90, coverage: '入口內側與門內動線' },
  { id: '03', name: '休息區監看', zone: 'dining', x: 85, y: 23, facing: 0, coverage: '桌區座位與飲料販賣機' },
  { id: '04', name: '球場 A－中央', zone: 'courtA', x: 88, y: 53, facing: 90, coverage: '球場 A 全場（由中央上方俯拍）' },
  { id: '05', name: 'Pro Shop 內部', zone: 'proshop', x: 51, y: 23, facing: 0, coverage: 'Pro Shop 商品展示與內部動線' },
  { id: '06', name: '球場 B－中央', zone: 'courtB', x: 35, y: 53, facing: 90, coverage: '球場 B 全場（由中央上方俯拍）' },
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
 * Demo Mode 的示範影像。照片不是即時串流，畫面上一律標示「示範影像」。
 * 各 Camera 的主畫面與縮圖可使用不同的取景範圍或角度。
 */
export const DEMO_MEDIA: Partial<Record<CameraId, { main: string; mainPosition: string; thumb: string; thumbPosition: string }>> = {
  '01': { main: '/monitor-demo/cam01-entrance-qr.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam01-entrance-qr.jpg', thumbPosition: '50% 50%' },
  '02': { main: '/monitor-demo/cam02-entrance-inside.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam02-entrance-inside.jpg', thumbPosition: '50% 50%' },
  '03': { main: '/monitor-demo/cam03-indoor-lounge.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam03-indoor-lounge.jpg', thumbPosition: '50% 55%' },
  '04': { main: '/monitor-demo/cam04-court-a.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam04-court-a.jpg', thumbPosition: '50% 50%' },
  '05': { main: '/monitor-demo/cam05-proshop.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam05-proshop.jpg', thumbPosition: '50% 50%' },
  '06': { main: '/monitor-demo/cam06-court-b.jpg', mainPosition: '50% 50%', thumb: '/monitor-demo/cam06-court-b.jpg', thumbPosition: '50% 50%' },
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
