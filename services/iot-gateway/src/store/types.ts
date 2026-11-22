import type { LogFile, CommandAck, CommandRecord, CommandStatus, EdgeCommand, EdgeEvent, StatusReport, WebhookPayload } from '@gh/iot-contract'

/**
 * 持久層介面。正式用 Postgres，開發／測試用記憶體。
 * 所有方法都必須可在多台 Gateway 同時執行下安全運作（Postgres 版靠交易與 SKIP LOCKED）。
 */

export interface SiteRow {
  siteId: string
  name: string
  venueId: string | null
  keyVersion: number
  disabled: boolean
  planRev: number
  lastSeenAt: Date | null
  agentVersion: string | null
  online: boolean
  status: StatusReport | null
  statusAt: Date | null
}

export interface OutboxRow {
  id: string
  payload: WebhookPayload
  attempts: number
}

export interface LogUploadMeta {
  id: string
  siteId: string
  uploadedAt: Date
  bytes: number
  files: { name: LogFile; lines: number; bytes: number; truncated: boolean }[]
}

export interface Store {
  // 場館
  getSite(siteId: string): Promise<SiteRow | null>
  listSites(): Promise<SiteRow[]>
  upsertSite(siteId: string, data: { name: string; venueId: string | null }): Promise<SiteRow>
  bumpKeyVersion(siteId: string): Promise<number>
  setDisabled(siteId: string, disabled: boolean): Promise<void>
  /** 心跳：回傳這次是否由離線轉為上線 */
  touchSite(siteId: string, at: Date, agentVersion: string): Promise<{ cameOnline: boolean }>
  /** 資料庫裡標示上線、但 last_seen_at 早於 cutoff 的場館（即時在線以 Redis 為準，由呼叫端再確認） */
  staleOnlineSites(cutoff: Date): Promise<SiteRow[]>
  /** 標為離線；回傳 true 表示這次真的由上線轉離線 */
  setOffline(siteId: string): Promise<boolean>
  saveStatus(siteId: string, status: StatusReport, at: Date): Promise<void>

  // 計畫（ciphertext 為 AES-GCM 加密後的 JSON）
  putPlan(siteId: string, hash: string, ciphertext: string, at: Date): Promise<{ rev: number; changed: boolean }>
  getPlan(siteId: string): Promise<{ rev: number; ciphertext: string } | null>

  // 指令
  enqueueCommand(c: { id: string; siteId: string; command: EdgeCommand; requestedBy: string | null; createdAt: Date; expiresAt: Date }): Promise<{ record: CommandRecord; created: boolean }>
  /** 取出可送達的指令並標為 DELIVERED（含已送達但逾時未 ack 的重送）；過期的標為 EXPIRED 並回傳 */
  takeCommands(siteId: string, at: Date, redeliverBefore: Date, limit: number): Promise<{ deliver: CommandRecord[]; expired: CommandRecord[] }>
  ackCommand(siteId: string, id: string, ack: CommandAck, at: Date): Promise<CommandRecord | null>
  getCommand(id: string): Promise<CommandRecord | null>
  listCommands(siteId: string, limit: number): Promise<CommandRecord[]>
  countPending(siteId: string, at: Date): Promise<number>

  // 事件（依 eventId 去重，回傳這次新寫入的）
  insertEvents(siteId: string, events: EdgeEvent[], at: Date): Promise<EdgeEvent[]>

  // 本機 log 上傳（id = log.upload 指令 id；gz = gzip 後的 LogUploadRequest JSON）
  saveLogUpload(meta: LogUploadMeta, gz: Buffer): Promise<void>
  listLogUploads(siteId: string, ids: string[]): Promise<LogUploadMeta[]>
  getLogUpload(siteId: string, id: string): Promise<{ meta: LogUploadMeta; gz: Buffer } | null>
  /** 刪除早於 before 的上傳，回傳筆數 */
  purgeLogUploads(before: Date): Promise<number>

  // Webhook outbox
  enqueueWebhook(payload: WebhookPayload): Promise<void>
  /** 取出到期待送的 webhook 並鎖定（多台 Gateway 不會重複取） */
  claimWebhooks(at: Date, limit: number): Promise<OutboxRow[]>
  completeWebhook(id: string, at: Date): Promise<void>
  failWebhook(id: string, error: string, retryAt: Date): Promise<void>

  close(): Promise<void>
}

export const TERMINAL: CommandStatus[] = ['ACKED', 'FAILED', 'EXPIRED', 'REJECTED']
