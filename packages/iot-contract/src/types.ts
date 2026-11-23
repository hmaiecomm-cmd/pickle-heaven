/**
 * 顧好 IoT 協定 v1 — 平台（Vercel）、IoT Gateway（DigitalOcean）、場館電腦（地端）三方共用的資料格式。
 *
 * 原則
 * - 所有連線都由「場館電腦主動連出」：場館是 REST client，不開任何對外 port。
 * - 雲端給場館一份「場館計畫」（未來約 48 小時的門禁密碼＋迴路開關時間表），
 *   場館依計畫自己執行，所以斷網時照常開門、開燈、關燈。
 * - 雲端只用「指令」處理臨時事件：手動開關、遠端開門、要求回報、重新下載計畫。
 * - 時間一律是含時區的 ISO 8601 字串（例：2026-11-12T08:00:00.000+08:00 或 ...Z）。
 *
 * 此檔不依賴任何套件，三方都能直接引用。
 */

export const CONTRACT_VERSION = 'gh-iot/1' as const

/** 迴路編號：01–16（對應 M-7045 的 DO 通道由 CircuitDef.channel 決定） */
export type CircuitNo = string
export type OnOff = 'ON' | 'OFF'

// ─────────────────────────── 場館計畫 ───────────────────────────

export type CircuitKind =
  /** 依該球場的預約開關（球場燈、球場風扇） */
  | 'COURT'
  /** 依營業時間開關（招牌、ProShop、休息區風扇…） */
  | 'BUSINESS'
  /** 夜間情境（圍欄燈、招牌燈、露營燈、地燈…） */
  | 'NIGHT'
  /** 24 小時供電，排程與遠端都不可動 */
  | 'ALWAYS_ON'
  /** 預留／停用 */
  | 'RESERVED'

export interface CircuitDef {
  no: CircuitNo
  name: string
  kind: CircuitKind
  /** M-7045 DO 通道 1–16 */
  channel: number
  /** COURT 類：對應的球場代號（A、B…） */
  court?: string
  /** 允許遠端手動控制 */
  remote: boolean
  /** 允許排程控制 */
  schedule: boolean
  /** 安全上限：連續開啟超過這麼多分鐘就由地端強制關閉（例：熱水器） */
  maxOnMinutes?: number
}

export type IntervalReason = 'BOOKING' | 'EVENT' | 'BLOCKED' | 'BUSINESS_HOURS' | 'NIGHT' | 'CUSTOM'

/** 迴路「應該開著」的區間；不在任何區間內就是 OFF */
export interface CircuitInterval {
  circuit: CircuitNo
  start: string
  end: string
  reason: IntervalReason
  /** 追溯用：預約、活動或排程 ID */
  ref?: string
}

export type HoldMode = 'NEXT_CHANGE' | 'MINUTES' | 'INDEFINITE'

/** 手動操作的維持方式 */
export interface Hold {
  mode: HoldMode
  /** MINUTES：到這個時間交回排程 */
  until?: string
}

/** 計畫產生當下仍在維持的手動操作（場館重開機後也能還原） */
export interface CircuitOverride {
  circuit: CircuitNo
  state: OnOff
  hold: Hold
  /** NEXT_CHANGE：手動操作當下排程算出的狀態；排程結果變得跟它不同時就結束維持 */
  baseline?: OnOff
  by?: string
}

/** 門禁密碼：只下發「今天到明天」需要的，雲端保留 30 天滾動資料庫 */
export interface DoorCode {
  id: string
  /** 明碼（只透過 TLS＋簽章傳輸，Gateway 以 AES-GCM 加密保存） */
  code: string
  /** 密碼可用時間（已含開放前與失效後的緩衝） */
  validFrom: string
  validTo: string
  /** DAY / MORNING / AFTERNOON / HOUR_XX / ORDER_xxx / MANUAL_GRANT */
  slotType: string
  /** 這組密碼適用的門（目前只有大門 main） */
  doors: string[]
}

export interface AudioCues {
  welcome?: string
  opening?: string
  ending?: string
  goodnight?: string
  doNotUseCourt?: string
}

export interface SitePlan {
  contract: typeof CONTRACT_VERSION
  siteId: string
  /** 由 Gateway 指定，內容有變才遞增 */
  rev?: number
  generatedAt: string
  timezone: string
  /** 計畫涵蓋範圍；地端在 window.to 之前一定要拿到下一版 */
  window: { from: string; to: string }
  circuits: CircuitDef[]
  timeline: CircuitInterval[]
  overrides: CircuitOverride[]
  doorCodes: DoorCode[]
  /** 營業時間（自午夜起分鐘，可 > 1440 表示跨日），供地端顯示與打烊判斷 */
  business: { openMinute: number; closeMinute: number }
  audio?: AudioCues
}

// ─────────────────────────── 指令 ───────────────────────────

export type EdgeCommand =
  | { type: 'circuit.set'; circuit: CircuitNo; state: OnOff; hold: Hold; reason?: string }
  | { type: 'circuit.release'; circuit: CircuitNo }
  | { type: 'door.unlock'; door: string; seconds: number; reason?: string }
  | { type: 'status.report' }
  | { type: 'plan.refresh' }
  | { type: 'audio.play'; file: string }
  | { type: 'camera.live'; camera: string; session: string; seconds: number }
  | { type: 'camera.stop'; session: string }
  | { type: 'nvr.index'; cameras?: string[]; from: string; to: string }
  | { type: 'nvr.clip'; camera: string; session: string; from: string; to: string }
  /** 調閱本機 log：篩選後以 PUT /edge/v1/logs/{指令 id} 上傳，再 ack */
  | { type: 'log.upload'; files: LogFile[]; from: string; to: string; minLevel?: LogLevel; maxBytes?: number }
  /** 模擬器故障注入（工程測試用） */
  | { type: 'sim.inject'; fault: string; [key: string]: unknown }

export type EdgeCommandType = EdgeCommand['type']

export interface CommandEnvelope {
  id: string
  issuedAt: string
  /** 過期就不能執行，回報 EXPIRED（例：斷網兩小時後不能補開熱水器） */
  expiresAt: string
  requestedBy?: string
  command: EdgeCommand
}

export type CommandResult = 'OK' | 'FAILED' | 'EXPIRED' | 'REJECTED'

export interface CommandAck {
  result: CommandResult
  at: string
  error?: string
  /** 執行後的各迴路實際狀態 */
  circuits?: Record<CircuitNo, OnOff>
}

// ─────────────────────────── 本機 log 調閱 ───────────────────────────

/** 本機 log 檔（見規格 11.1）：edge.log、audit.log、modbus.log */
export type LogFile = 'edge' | 'audit' | 'modbus'
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export const LOG_FILES: LogFile[] = ['edge', 'audit', 'modbus']
export const LOG_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR']
/** 單次上傳上限（所有檔案 content 合計，UTF-8 位元組） */
export const LOG_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
/** Gateway 保存天數 */
export const LOG_RETENTION_DAYS = 30

/** NVR 錄影保存天數 */
export const NVR_RETENTION_DAYS = 14
/** 一次調閱的最長影片秒數（10 分鐘） */
export const CLIP_MAX_SECONDS = 600

export interface LogUploadFile {
  name: LogFile
  /** JSON Lines 原文（時間範圍與等級已篩選），每行一筆 */
  content: string
  lines: number
  /** 超過 maxBytes 被截斷時為 true（保留最新的部分） */
  truncated: boolean
}

/** PUT /edge/v1/logs/{commandId} */
export interface LogUploadRequest {
  from: string
  to: string
  files: LogUploadFile[]
}

export interface LogUploadSummary {
  id: string
  siteId: string
  status: CommandStatus
  requestedBy: string | null
  createdAt: string
  from: string
  to: string
  files: LogFile[]
  minLevel: LogLevel | null
  error: string | null
  upload: { uploadedAt: string; bytes: number; files: { name: LogFile; lines: number; bytes: number; truncated: boolean }[] } | null
}

// ─────────────────────────── 地端回報 ───────────────────────────

export interface HeartbeatRequest {
  agentVersion: string
  localTime: string
  uptimeSec: number
  planRev: number | null
  /** 地端排隊中、尚未送出的事件數（斷網後恢復時會 > 0） */
  pendingEvents?: number
}

export interface HeartbeatResponse {
  serverTime: string
  planRev: number
  /** 地端時鐘與伺服器差距（毫秒，正值表示地端較快） */
  clockSkewMs: number
}

export interface StatusReport {
  at: string
  planRev: number | null
  circuits: Record<CircuitNo, OnOff>
  door?: { locked: boolean; contactOpen?: boolean }
  hardware?: { modbus: 'OK' | 'ERROR'; doorController: 'OK' | 'ERROR'; speaker?: 'OK' | 'ERROR' }
}

export type EdgeEventType =
  | 'agent.started'
  | 'agent.recovered'
  | 'door.code_ok'
  | 'door.code_denied'
  | 'door.unlocked'
  | 'circuit.changed'
  | 'circuit.forced_off'
  | 'motion.unbooked'
  | 'audio.played'
  | 'hardware.error'

export interface EdgeEvent {
  /** 地端產生的唯一 ID（重送時不變，Gateway 依此去重） */
  eventId: string
  type: EdgeEventType
  at: string
  data?: Record<string, unknown>
}

export interface EventsRequest {
  events: EdgeEvent[]
}

export interface EventsResponse {
  acked: string[]
}

export interface CommandsResponse {
  serverTime: string
  planRev: number
  commands: CommandEnvelope[]
}

// ─────────────────────────── Gateway → 平台 Webhook ───────────────────────────

export type WebhookPayload =
  | { kind: 'ack'; siteId: string; commandId: string; command: EdgeCommand; ack: CommandAck; requestedBy?: string }
  | { kind: 'status'; siteId: string; status: StatusReport }
  | { kind: 'events'; siteId: string; events: EdgeEvent[] }
  | { kind: 'presence'; siteId: string; online: boolean; lastSeenAt: string | null; agentVersion?: string }
  | { kind: 'command.expired'; siteId: string; commandId: string; command: EdgeCommand }
  | { kind: 'log.uploaded'; siteId: string; commandId: string; bytes: number; files: { name: LogFile; lines: number; truncated: boolean }[]; requestedBy?: string }

export interface WebhookEnvelope {
  id: string
  sentAt: string
  payload: WebhookPayload
}

// ─────────────────────────── 平台 → Gateway 內部 API ───────────────────────────

export interface UpsertSiteRequest {
  name: string
  venueId?: string
}

export interface SiteSummary {
  siteId: string
  name: string
  venueId: string | null
  disabled: boolean
  keyVersion: number
  online: boolean
  lastSeenAt: string | null
  agentVersion: string | null
  planRev: number
  status: StatusReport | null
}

export interface ProvisionResponse {
  siteId: string
  keyVersion: number
  /** 只在開通／換金鑰當下回傳一次，請交給場館電腦保存 */
  secret: string
}

export interface PutPlanResponse {
  rev: number
  changed: boolean
}

export interface EnqueueCommandRequest {
  /** 冪等：同一個 ID 重送不會建立第二筆 */
  id: string
  command: EdgeCommand
  ttlSec?: number
  requestedBy?: string
}

export type CommandStatus = 'QUEUED' | 'DELIVERED' | 'ACKED' | 'FAILED' | 'EXPIRED' | 'REJECTED'

export interface CommandRecord {
  id: string
  siteId: string
  command: EdgeCommand
  status: CommandStatus
  requestedBy: string | null
  createdAt: string
  expiresAt: string
  deliveredAt: string | null
  ackedAt: string | null
  ack: CommandAck | null
}

export interface ApiError {
  error: { code: string; message: string }
}

// ─────────────────────────── 攝影機與媒體 ───────────────────────────

export type MediaQuality = 'low' | 'high'

export interface CameraDef {
  id: string
  name: string
  court?: string
}

export interface NvrIndex {
  camera: string
  from: string
  to: string
  segments: { start: string; end: string; hasMotion: boolean }[]
}

export interface NvrRecording {
  camera: string
  from: string
  to: string
  url: string
}

export interface MediaSessionInfo {
  session: string
  camera: string
  live: boolean
  title: string
  createdAt: string
  expiresAt: string
  url?: string
}

// ─────────────────────────── 網絡流量紀錄 ───────────────────────────

export interface TrafficEntry {
  at: string
  direction: 'up' | 'down'
  bytes: number
  method: string
  path: string
  status: number
  error?: string
}
