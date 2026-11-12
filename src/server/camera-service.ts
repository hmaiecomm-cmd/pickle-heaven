import 'server-only'
import { prisma } from '@/lib/db'
import { CAMERAS, type CameraSpec } from '@/lib/camera-layout'

/**
 * 即時監控資料。目前尚未串接攝影機或錄影主機（NVR），因此一律回報 Demo Mode：
 * 攝影機狀態為「未連線」，不提供任何影像、回放或匯出。
 * 回傳內容只含顯示用資料，永遠不包含串流網址、帳號、密碼或 token。
 */

export type CameraState = 'NOT_CONNECTED' | 'ONLINE' | 'OFFLINE'

export interface CameraView extends CameraSpec {
  state: CameraState
  model: string
  lastSeen: string | null
}

export interface MonitorEvent {
  id: string
  severity: string
  title: string
  detail: string | null
  link: string | null
  status: string
  createdAt: string
}

export interface CameraOverview {
  integration: { connected: false; label: string; reason: string }
  cameras: CameraView[]
  events: MonitorEvent[]
  generatedAt: string
}

/** 與現場設備、攝影機有關的異常類型 */
const MONITOR_EVENT_TYPES = ['DEVICE_OFFLINE', 'DEVICE_STALE', 'OCCUPANCY_CONFLICT']

export async function getCameraOverview(): Promise<CameraOverview> {
  const rows = await prisma.incident
    .findMany({
      where: { status: { in: ['OPEN', 'ACKED'] }, OR: [{ type: { in: MONITOR_EVENT_TYPES } }, { type: { startsWith: 'CAMERA' } }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, severity: true, title: true, detail: true, link: true, status: true, createdAt: true },
    })
    .catch(() => [])

  return {
    integration: {
      connected: false,
      label: 'Demo Mode',
      reason: '尚未串接攝影機與錄影主機（NVR）；需提供攝影機／NVR 型號、串流方式與安裝位置後才能接上。',
    },
    cameras: CAMERAS.map((c) => ({ ...c, state: 'NOT_CONNECTED', model: '待確認', lastSeen: null })),
    events: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    generatedAt: new Date().toISOString(),
  }
}
