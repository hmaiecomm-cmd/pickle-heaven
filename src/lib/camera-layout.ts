import type { ZoneId } from './venue-layout'

/**
 * 即時監控的 6 支攝影機（Camera 1–6）。
 * 座標使用 venue-layout 的平面圖 viewBox（136 × 66）；安裝位置與拍攝方向為示意，待現場確認。
 * 這裡只放公開的顯示資料，不含任何串流網址、帳號或密碼。
 */

export type CameraId = 1 | 2 | 3 | 4 | 5 | 6

export interface CameraSpec {
  id: CameraId
  /** 顯示代號，例如 Camera 1 */
  code: string
  name: string
  zone: ZoneId
  /** 平面圖上的安裝位置 */
  x: number
  y: number
  /** 拍攝方向（度；0 = 向右，90 = 向下） */
  facing: number
  /** 拍攝範圍說明 */
  coverage: string
}

export const CAMERAS: CameraSpec[] = [
  { id: 1, code: 'Camera 1', name: '出入口', zone: 'entrance', x: 111, y: 10, facing: 180, coverage: '大門外側與進出人員' },
  { id: 2, code: 'Camera 2', name: '門內監看', zone: 'entrance', x: 103, y: 28, facing: 200, coverage: '門內通道、桌區入口' },
  { id: 3, code: 'Camera 3', name: '休息區', zone: 'deck', x: 60, y: 33, facing: 90, coverage: '休息區（站板）' },
  { id: 4, code: 'Camera 4', name: '球場 A', zone: 'courtA', x: 111, y: 44.5, facing: 160, coverage: '球場 A 全場' },
  { id: 5, code: 'Camera 5', name: 'Pro Shop', zone: 'proshop', x: 35, y: 19, facing: 20, coverage: 'Pro Shop 櫃位與商品區' },
  { id: 6, code: 'Camera 6', name: '球場 B', zone: 'courtB', x: 10, y: 44.5, facing: 20, coverage: '球場 B 全場' },
]

export const CAMERA_IDS = CAMERAS.map((c) => c.id)

export function cameraById(id: number): CameraSpec | undefined {
  return CAMERAS.find((c) => c.id === id)
}

/** 前一支／下一支（循環），供主畫面切換 */
export function stepCamera(id: CameraId, delta: 1 | -1): CameraId {
  const i = CAMERA_IDS.indexOf(id)
  return CAMERA_IDS[(i + delta + CAMERA_IDS.length) % CAMERA_IDS.length]
}

/** 平面圖上的拍攝範圍扇形（SVG path） */
export function conePath(c: Pick<CameraSpec, 'x' | 'y' | 'facing'>, length = 9, spread = 50): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const a1 = rad(c.facing - spread / 2)
  const a2 = rad(c.facing + spread / 2)
  const p = (a: number) => `${(c.x + length * Math.cos(a)).toFixed(2)} ${(c.y + length * Math.sin(a)).toFixed(2)}`
  return `M ${c.x} ${c.y} L ${p(a1)} A ${length} ${length} 0 0 1 ${p(a2)} Z`
}
