import 'server-only'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { CAMERA_IDS, CAMERA_ZONES, DEFAULT_CAMERAS, DEMO_MEDIA, STREAM_PROTOCOLS, type CameraId, type StreamProtocol } from '@/lib/camera-layout'
import { PLAN_HEIGHT, PLAN_WIDTH } from '@/lib/venue-layout'

/**
 * 即時監控：攝影機設定、事件與操作紀錄。
 *
 * 目前尚未串接攝影機或錄影主機（NVR），一律為 Demo Mode：狀態「未連線」，沒有即時串流與錄影。
 * 回傳給前端的資料永遠不包含密碼、token 或可直接播放的串流網址；
 * 串流憑證只放在伺服器環境變數，資料庫只記錄變數名稱，前端只知道「是否已設定」。
 */

export class CameraError extends Error {}

const MONITOR_EVENT_TYPES = ['DEVICE_OFFLINE', 'DEVICE_STALE', 'OCCUPANCY_CONFLICT']
const CAMERA_AUDIT_ACTIONS = ['CAMERA_UPDATE', 'CAMERA_TEST', 'CAMERA_SNAPSHOT', 'INCIDENT_ACKED', 'INCIDENT_RESOLVED']
const ASSIGNABLE_VIEW_ROLES = ['MANAGER', 'OPERATOR', 'VIEWER'] as const

export type CameraState = 'NOT_CONNECTED' | 'DISABLED'

/** 所有有權看即時監控的人都會拿到的資料 */
export interface CameraView {
  id: CameraId
  name: string
  zone: string
  x: number
  y: number
  facing: number
  coverage: string
  enabled: boolean
  state: CameraState
  demo: { main: string; mainPosition: string; thumb: string; thumbPosition: string } | null
}

/** 攝影機管理（需 camera.manage）才拿得到；仍不含任何密碼 */
export interface CameraAdminView extends CameraView {
  protocol: StreamProtocol | null
  host: string | null
  port: number | null
  channel: string | null
  credentialEnv: string | null
  credentialPresent: boolean
  viewRoles: string[]
  lastTestAt: string | null
  lastTestResult: string | null
  updatedBy: string | null
  updatedAt: string | null
}

type Row = {
  id: string
  name: string
  zone: string
  x: number
  y: number
  facing: number
  coverage: string | null
  enabled: boolean
  protocol: string | null
  host: string | null
  port: number | null
  channel: string | null
  credentialEnv: string | null
  viewRoles: string
  lastTestAt: Date | null
  lastTestResult: string | null
  updatedBy: string | null
  updatedAt: Date | null
}

export type CameraStorage = 'ready' | 'unavailable'

/** 讀取設定並與預設值合併；資料表不存在（例如正式庫尚未建立）時回傳預設值，標示 unavailable */
async function loadRows(): Promise<{ rows: Row[]; storage: CameraStorage }> {
  let saved: Row[] = []
  let storage: CameraStorage = 'ready'
  try {
    saved = (await prisma.monitorCamera.findMany()) as Row[]
  } catch {
    storage = 'unavailable'
  }
  const byId = new Map(saved.map((r) => [r.id, r]))
  const rows = DEFAULT_CAMERAS.map<Row>(
    (d) =>
      byId.get(d.id) ?? {
        ...d,
        enabled: true,
        protocol: null,
        host: null,
        port: null,
        channel: null,
        credentialEnv: null,
        viewRoles: 'OWNER,MANAGER,OPERATOR,VIEWER',
        lastTestAt: null,
        lastTestResult: null,
        updatedBy: null,
        updatedAt: null,
      },
  )
  return { rows, storage }
}

const rolesOf = (r: Row) => r.viewRoles.split(',').map((s) => s.trim()).filter(Boolean)
/** 擁有者一律可看；其他角色依攝影機的觀看權限 */
const canSee = (r: Row, role: string) => role === 'OWNER' || role === 'DEMO' || rolesOf(r).includes(role)

function toView(r: Row): CameraView {
  const id = r.id as CameraId
  return {
    id,
    name: r.name,
    zone: r.zone,
    x: r.x,
    y: r.y,
    facing: r.facing,
    coverage: r.coverage ?? '',
    enabled: r.enabled,
    state: r.enabled ? 'NOT_CONNECTED' : 'DISABLED',
    demo: DEMO_MEDIA[id] ?? null,
  }
}

function toAdminView(r: Row): CameraAdminView {
  return {
    ...toView(r),
    protocol: (STREAM_PROTOCOLS as readonly string[]).includes(r.protocol ?? '') ? (r.protocol as StreamProtocol) : null,
    host: r.host,
    port: r.port,
    channel: r.channel,
    credentialEnv: r.credentialEnv,
    credentialPresent: Boolean(r.credentialEnv && process.env[r.credentialEnv]),
    viewRoles: rolesOf(r),
    lastTestAt: r.lastTestAt?.toISOString() ?? null,
    lastTestResult: r.lastTestResult,
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt?.toISOString() ?? null,
  }
}

export const INTEGRATION = {
  connected: false as const,
  label: 'Demo Mode',
  reason: '尚未串接攝影機與錄影主機（NVR）；需提供 NVR／攝影機型號、串流方式與網路架構後才能接上。',
}

/** 依角色可看到的攝影機（停用的攝影機仍列出，但標示停用） */
export async function listCameras(role: string): Promise<{ cameras: CameraView[]; storage: CameraStorage }> {
  const { rows, storage } = await loadRows()
  return { cameras: rows.filter((r) => canSee(r, role)).map(toView), storage }
}

export async function listCamerasForAdmin(): Promise<{ cameras: CameraAdminView[]; storage: CameraStorage }> {
  const { rows, storage } = await loadRows()
  return { cameras: rows.map(toAdminView), storage }
}

export async function assertCameraVisible(id: string, role: string): Promise<CameraView> {
  const { rows } = await loadRows()
  const r = rows.find((x) => x.id === id)
  if (!r || !canSee(r, role)) throw new CameraError('找不到這支攝影機，或目前角色沒有觀看權限')
  return toView(r)
}

const hostRe = /^[A-Za-z0-9.-]{1,253}$/
const envRe = /^[A-Z][A-Z0-9_]{2,63}$/

export const cameraUpdateSchema = z.object({
  name: z.string().trim().min(1, '請填寫名稱').max(30, '名稱最多 30 字'),
  zone: z.string().refine((v) => CAMERA_ZONES.some((z) => z.id === v), '區域不正確'),
  x: z.number().min(1).max(PLAN_WIDTH - 1),
  y: z.number().min(1).max(PLAN_HEIGHT - 1),
  facing: z.number().int().min(0).max(359),
  coverage: z.string().trim().max(60, '拍攝範圍最多 60 字'),
  enabled: z.boolean(),
  protocol: z.enum(STREAM_PROTOCOLS).nullable(),
  host: z
    .string()
    .trim()
    .max(253)
    .refine((v) => v === '' || hostRe.test(v), '主機只能填 IP 或網域，不可含帳號、密碼或路徑')
    .transform((v) => v || null),
  port: z.number().int().min(1).max(65535).nullable(),
  channel: z
    .string()
    .trim()
    .max(120)
    .refine((v) => !/[@\s]|:\/\/|password|passwd|token|secret|key=/i.test(v), '通道／路徑不可包含帳號、密碼或 token，請改用憑證環境變數')
    .transform((v) => v || null),
  credentialEnv: z
    .string()
    .trim()
    .refine((v) => v === '' || envRe.test(v), '憑證環境變數名稱只能用大寫英文、數字與底線，例如 CAMERA_03_PASSWORD')
    .transform((v) => v || null),
  viewRoles: z.array(z.enum(ASSIGNABLE_VIEW_ROLES)),
})
export type CameraUpdateInput = z.input<typeof cameraUpdateSchema>

export async function updateCamera(id: string, input: CameraUpdateInput, actor: string): Promise<CameraAdminView> {
  if (!(CAMERA_IDS as readonly string[]).includes(id)) throw new CameraError('攝影機編號不正確')
  const data = cameraUpdateSchema.parse(input)
  const before = (await loadRows()).rows.find((r) => r.id === id)!
  const viewRoles = ['OWNER', ...data.viewRoles].join(',')
  const values = { ...data, coverage: data.coverage || null, viewRoles, updatedBy: actor }
  let saved: Row
  try {
    saved = (await prisma.monitorCamera.upsert({ where: { id }, create: { id, ...values }, update: values })) as Row
  } catch {
    throw new CameraError('攝影機設定資料表尚未建立，暫時無法儲存。請先完成資料庫更新。')
  }
  const changed = (Object.keys(values) as (keyof typeof values)[]).filter((k) => k !== 'updatedBy' && String(before[k as keyof Row] ?? '') !== String(values[k] ?? ''))
  await prisma.auditLog.create({ data: { actor, action: 'CAMERA_UPDATE', target: `Camera ${id}`, detail: { changed, name: data.name } } })
  return toAdminView(saved)
}

/**
 * 連線測試：檢查設定是否完整、憑證環境變數是否存在（不讀出內容）。
 * 系統尚未建置串流閘道，無法從雲端實際連到現場 NVR，結果會明確說明，不會回報「連線成功」。
 */
export async function testCameraConnection(id: string, actor: string): Promise<{ ok: false; result: string; testedAt: string }> {
  const r = (await loadRows()).rows.find((x) => x.id === id)
  if (!r) throw new CameraError('攝影機編號不正確')
  let result: string
  if (!r.enabled) result = '攝影機已停用，未進行測試。'
  else if (!r.protocol || !r.host) result = '尚未設定串流來源（類型與主機），無法測試。'
  else if (r.credentialEnv && !process.env[r.credentialEnv]) result = `設定已填寫，但伺服器尚未設定憑證環境變數 ${r.credentialEnv}。`
  else result = '設定格式正確；系統尚未建置串流閘道（NVR 串接），無法實際連線，目前仍為 Demo Mode。'
  const testedAt = new Date()
  await prisma.monitorCamera
    .upsert({ where: { id }, create: { ...r, id, lastTestAt: testedAt, lastTestResult: result, updatedAt: undefined }, update: { lastTestAt: testedAt, lastTestResult: result } })
    .catch(() => {})
  await prisma.auditLog.create({ data: { actor, action: 'CAMERA_TEST', target: `Camera ${id}`, detail: { result } } })
  return { ok: false, result, testedAt: testedAt.toISOString() }
}

/** 歷史回放：沒有 NVR，因此沒有任何錄影片段 */
export async function getPlayback(id: string, date: string, role: string) {
  await assertCameraVisible(id, role)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new CameraError('日期格式不正確')
  return { connected: false as const, date, segments: [] as { start: string; end: string }[], message: '尚未串接錄影主機（NVR），這一天沒有可回放的錄影。' }
}

export async function recordSnapshot(id: string, role: string, actor: string, at: string) {
  const cam = await assertCameraVisible(id, role)
  await prisma.auditLog.create({ data: { actor, action: 'CAMERA_SNAPSHOT', target: `Camera ${id}`, detail: { at, demo: true } } })
  return { name: cam.name, demo: cam.demo?.main ?? null }
}

const SOURCE_LABEL: Record<string, string> = {
  DEVICE_OFFLINE: '設備離線',
  DEVICE_STALE: '設備回報逾時',
  OCCUPANCY_CONFLICT: '場地使用異常',
}

export interface MonitorEvent {
  id: string
  type: string
  typeLabel: string
  severity: string
  title: string
  detail: string | null
  link: string | null
  status: 'OPEN' | 'ACKED' | 'RESOLVED'
  note: string | null
  resolvedBy: string | null
  createdAt: string
  updatedAt: string
}

/** 監控相關事件（攝影機、設備、場地異常），來源為系統偵測寫入的 Incident；不產生任何假事件 */
export async function listMonitorEvents(limit = 100): Promise<MonitorEvent[]> {
  const rows = await prisma.incident
    .findMany({
      where: { OR: [{ type: { in: MONITOR_EVENT_TYPES } }, { type: { startsWith: 'CAMERA' } }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    .catch(() => [])
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    typeLabel: SOURCE_LABEL[r.type] ?? (r.type.startsWith('CAMERA') ? '攝影機異常' : r.type),
    severity: r.severity,
    title: r.title,
    detail: r.detail,
    link: r.link,
    status: (['OPEN', 'ACKED', 'RESOLVED'].includes(r.status) ? r.status : 'OPEN') as MonitorEvent['status'],
    note: r.note,
    resolvedBy: r.resolvedBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export interface MonitorAuditEntry {
  id: string
  actor: string
  action: string
  target: string | null
  summary: string
  createdAt: string
}

const AUDIT_LABEL: Record<string, string> = {
  CAMERA_UPDATE: '修改攝影機設定',
  CAMERA_TEST: '攝影機連線測試',
  CAMERA_SNAPSHOT: '截圖',
  INCIDENT_ACKED: '確認事件',
  INCIDENT_RESOLVED: '結案事件',
}

export async function listMonitorAudit(limit = 50): Promise<MonitorAuditEntry[]> {
  const rows = await prisma.auditLog.findMany({ where: { action: { in: CAMERA_AUDIT_ACTIONS } }, orderBy: { createdAt: 'desc' }, take: limit }).catch(() => [])
  return rows.map((r) => {
    const d = (r.detail ?? {}) as Record<string, unknown>
    const extra = typeof d.note === 'string' && d.note ? `：${d.note}` : typeof d.result === 'string' ? `：${d.result}` : Array.isArray(d.changed) && d.changed.length ? `（${d.changed.length} 個欄位）` : ''
    return { id: r.id, actor: r.actor, action: r.action, target: r.target, summary: `${AUDIT_LABEL[r.action] ?? r.action}${extra}`, createdAt: r.createdAt.toISOString() }
  })
}
