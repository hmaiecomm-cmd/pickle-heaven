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

/** 攝影機（NVR 通道）；court 有值時，位移偵測會對照該球場的預約 */
export interface CameraDef {
  /** 01–06 */
  id: string
  name: string
  court?: string
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
  cameras?: CameraDef[]
}

// ─────────────────────────── 指令 ───────────────────────────

export type EdgeCommand =
  | { type: 'circuit.set'; circuit: CircuitNo; state: OnOff; hold: Hold; reason?: string }
  | { type: 'circuit.release'; circuit: CircuitNo }
  | { type: 'door.unlock'; door: string; seconds: number; reason?: string }
  | { type: 'status.report' }
  | { type: 'plan.refresh' }
  | { type: 'audio.play'; file: string }
  /** 調閱本機 log：篩選後以 PUT /edge/v1/logs/{指令 id} 上傳，再 ack */
  | { type: 'log.upload'; files: LogFile[]; from: string; to: string; minLevel?: LogLevel; maxBytes?: number }
  /** 即時影像：開始（或延長）把某支攝影機的 HLS 片段上傳到 session，seconds 秒後自動停止 */
  | { type: 'camera.live'; camera: string; session: string; seconds: number; quality?: MediaQuality }
  | { type: 'camera.stop'; session: string }
  /** 查詢 NVR 錄影索引，結果以 PUT /edge/v1/media/nvr-index/{指令 id} 上傳 */
  | { type: 'nvr.index'; cameras?: string[]; from: string; to: string }
  /** 調閱 NVR 錄影片段（最長 10 分鐘），HLS 片段上傳到 session，最後呼叫 /end */
  | { type: 'nvr.clip'; camera: string; session: string; from: string; to: string; quality?: MediaQuality }
  /**
   * 只給網頁模擬器：雲端「工程測試頁」用來在地端製造狀況（斷網、RS-485 斷線、繼電器卡住、時鐘偏差、輸入密碼、有人進場）。
   * 實體場館電腦一律回 REJECTED。
   */
  | { type: 'sim.inject'; fault: SimFault; seconds?: number; channel?: number; value?: string }

export type EdgeCommandType = EdgeCommand['type']

export type SimFault = 'offline' | 'modbus' | 'door' | 'stuck' | 'skew' | 'code' | 'motion' | 'reset'

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

// ─────────────────────────── 影像（攝影機即時串流、NVR 錄影） ───────────────────────────

export type MediaQuality = 'low' | 'high'
export type MediaKind = 'live' | 'clip'

/** NVR 保存天數（索引與調閱範圍） */
export const NVR_RETENTION_DAYS = 14
/** 單一 HLS 片段上限 */
export const MEDIA_SEGMENT_MAX_BYTES = 4 * 1024 * 1024
/** 即時串流單次最長秒數（要更久就再送一次 camera.live 延長） */
export const LIVE_MAX_SECONDS = 300
/** 錄影調閱單次最長秒數 */
export const CLIP_MAX_SECONDS = 600
/** session 編號格式（由雲端產生） */
export const MEDIA_SESSION_PATTERN = /^[a-z0-9][a-z0-9-]{7,63}$/

export interface NvrRecording {
  camera: string
  start: string
  end: string
  /** continuous＝連續錄影；motion＝位移觸發 */
  kind: 'continuous' | 'motion'
  bytes?: number
}

/** PUT /edge/v1/media/nvr-index/{commandId} */
export interface NvrIndex {
  from: string
  to: string
  /** NVR 實際保存的最早時間 */
  oldest: string | null
  recordings: NvrRecording[]
  /** 硬碟用量（選填） */
  disk?: { usedBytes: number; totalBytes: number }
}

export interface MediaSessionInfo {
  session: string
  siteId: string
  kind: MediaKind
  camera: string
  createdAt: string
  /** live：何時自動停止；clip：調閱的時間範圍 */
  until: string | null
  from: string | null
  to: string | null
  segments: number
  bytes: number
  lastSegmentAt: string | null
  /** clip 已上傳完（或 live 已停止） */
  ended: boolean
  endReason: string | null
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
  | { kind: 'media.ended'; siteId: string; session: string; camera: string; mediaKind: MediaKind; segments: number; reason?: string }
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

/** Gateway 記錄的每個場館最近請求（雲端看得到場館送了什麼、拿走了什麼） */
export interface TrafficEntry {
  at: string
  /** up＝場館送上來；down＝場館取走（計畫、指令） */
  dir: 'up' | 'down'
  method: string
  path: string
  status: number
  bytes: number
  ms: number
  note?: string
}

/** 場館連線來源（浮動 IP）變更紀錄 */
export interface IpChange {
  at: string
  ip: string
  prev: string | null
  /** 模擬器宣告的 IP（x-sim-egress-ip，只對 -sim 場館採用） */
  simulated: boolean
}

/** Gateway 收到的一次心跳 */
export interface HeartbeatLog {
  at: string
  ip: string
  /** 距上次心跳（毫秒）；第一次為 null */
  gapMs: number | null
  skewMs: number
  uptimeSec: number
  planRev: number | null
  pendingEvents: number
  agentVersion: string
}

/** 場館連線狀態：目前 IP、IP 變更歷史、最近心跳 */
export interface SiteConnection {
  siteId: string
  online: boolean
  lastSeenAt: string | null
  offlineAfterSec: number
  ip: string | null
  ipSince: string | null
  simulated: boolean
  ipHistory: IpChange[]
  heartbeats: HeartbeatLog[]
}

/** 模擬器專用標頭：模擬浮動 IP（真實場館電腦不送；Gateway 只對 siteId 結尾 -sim 的場館採用） */
export const HEADER_SIM_EGRESS_IP = 'x-sim-egress-ip'

export interface ApiError {
  error: { code: string; message: string }
}
