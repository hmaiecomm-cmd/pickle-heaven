import { randomUUID } from 'node:crypto'
import type { CommandAck, CommandRecord, EdgeEvent, StatusReport, WebhookPayload } from '@gh/iot-contract'
import { TERMINAL, type LogUploadMeta, type OutboxRow, type SiteRow, type Store } from './types'

/** 單機記憶體版：開發、測試與模擬器使用。重啟即清空。 */
export class MemoryStore implements Store {
  private sites = new Map<string, SiteRow>()
  private plans = new Map<string, { rev: number; hash: string; ciphertext: string }>()
  private commands = new Map<string, CommandRecord>()
  private events = new Map<string, Set<string>>()
  private logs = new Map<string, { meta: LogUploadMeta; gz: Buffer }>()
  private outbox = new Map<string, OutboxRow & { nextAt: number; done: boolean; claimedUntil: number }>()

  async getSite(siteId: string) {
    return this.sites.get(siteId) ?? null
  }
  async listSites() {
    return [...this.sites.values()].sort((a, b) => a.siteId.localeCompare(b.siteId))
  }
  async upsertSite(siteId: string, data: { name: string; venueId: string | null }) {
    const cur = this.sites.get(siteId)
    const row: SiteRow = cur
      ? { ...cur, ...data }
      : { siteId, ...data, keyVersion: 1, disabled: false, planRev: 0, lastSeenAt: null, agentVersion: null, online: false, status: null, statusAt: null }
    this.sites.set(siteId, row)
    return row
  }
  async bumpKeyVersion(siteId: string) {
    const s = this.must(siteId)
    s.keyVersion += 1
    return s.keyVersion
  }
  async setDisabled(siteId: string, disabled: boolean) {
    this.must(siteId).disabled = disabled
  }
  async touchSite(siteId: string, at: Date, agentVersion: string) {
    const s = this.must(siteId)
    const cameOnline = !s.online
    s.online = true
    s.lastSeenAt = at
    s.agentVersion = agentVersion
    return { cameOnline }
  }
  async staleOnlineSites(cutoff: Date) {
    return [...this.sites.values()].filter((s) => s.online && (!s.lastSeenAt || s.lastSeenAt < cutoff))
  }
  async setOffline(siteId: string) {
    const s = this.sites.get(siteId)
    if (!s || !s.online) return false
    s.online = false
    return true
  }
  async saveStatus(siteId: string, status: StatusReport, at: Date) {
    const s = this.must(siteId)
    s.status = status
    s.statusAt = at
  }

  async putPlan(siteId: string, hash: string, ciphertext: string) {
    const s = this.must(siteId)
    const cur = this.plans.get(siteId)
    if (cur && cur.hash === hash) return { rev: cur.rev, changed: false }
    const rev = (cur?.rev ?? 0) + 1
    this.plans.set(siteId, { rev, hash, ciphertext })
    s.planRev = rev
    return { rev, changed: true }
  }
  async getPlan(siteId: string) {
    const p = this.plans.get(siteId)
    return p ? { rev: p.rev, ciphertext: p.ciphertext } : null
  }

  async enqueueCommand(c: Parameters<Store['enqueueCommand']>[0]) {
    const existing = this.commands.get(c.id)
    if (existing) return { record: existing, created: false }
    const record: CommandRecord = {
      id: c.id,
      siteId: c.siteId,
      command: c.command,
      status: 'QUEUED',
      requestedBy: c.requestedBy,
      createdAt: c.createdAt.toISOString(),
      expiresAt: c.expiresAt.toISOString(),
      deliveredAt: null,
      ackedAt: null,
      ack: null,
    }
    this.commands.set(c.id, record)
    return { record, created: true }
  }
  async takeCommands(siteId: string, at: Date, redeliverBefore: Date, limit: number) {
    const deliver: CommandRecord[] = []
    const expired: CommandRecord[] = []
    const list = [...this.commands.values()].filter((c) => c.siteId === siteId && !TERMINAL.includes(c.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const c of list) {
      if (Date.parse(c.expiresAt) <= at.getTime()) {
        c.status = 'EXPIRED'
        expired.push(c)
        continue
      }
      const due = c.status === 'QUEUED' || (c.status === 'DELIVERED' && c.deliveredAt !== null && Date.parse(c.deliveredAt) < redeliverBefore.getTime())
      if (due && deliver.length < limit) {
        c.status = 'DELIVERED'
        c.deliveredAt = at.toISOString()
        deliver.push(c)
      }
    }
    return { deliver, expired }
  }
  async ackCommand(siteId: string, id: string, ack: CommandAck, at: Date) {
    const c = this.commands.get(id)
    if (!c || c.siteId !== siteId) return null
    if (TERMINAL.includes(c.status)) return c
    c.status = ack.result === 'OK' ? 'ACKED' : ack.result
    c.ack = ack
    c.ackedAt = at.toISOString()
    return c
  }
  async getCommand(id: string) {
    return this.commands.get(id) ?? null
  }
  async listCommands(siteId: string, limit: number) {
    return [...this.commands.values()].filter((c) => c.siteId === siteId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
  }
  async countPending(siteId: string, at: Date) {
    return [...this.commands.values()].filter((c) => c.siteId === siteId && !TERMINAL.includes(c.status) && Date.parse(c.expiresAt) > at.getTime()).length
  }

  async insertEvents(siteId: string, events: EdgeEvent[]) {
    const seen = this.events.get(siteId) ?? new Set<string>()
    this.events.set(siteId, seen)
    const fresh: EdgeEvent[] = []
    for (const e of events) {
      if (seen.has(e.eventId)) continue
      seen.add(e.eventId)
      fresh.push(e)
    }
    return fresh
  }

  async saveLogUpload(meta: LogUploadMeta, gz: Buffer) {
    this.logs.set(meta.id, { meta, gz })
  }
  async listLogUploads(siteId: string, ids: string[]) {
    return ids.map((id) => this.logs.get(id)).filter((r) => r && r.meta.siteId === siteId).map((r) => r!.meta)
  }
  async getLogUpload(siteId: string, id: string) {
    const r = this.logs.get(id)
    return r && r.meta.siteId === siteId ? r : null
  }
  async purgeLogUploads(before: Date) {
    let n = 0
    for (const [id, r] of this.logs) if (r.meta.uploadedAt < before) (this.logs.delete(id), n++)
    return n
  }

  async enqueueWebhook(payload: WebhookPayload) {
    const id = randomUUID()
    this.outbox.set(id, { id, payload, attempts: 0, nextAt: 0, done: false, claimedUntil: 0 })
  }
  async claimWebhooks(at: Date, limit: number) {
    const t = at.getTime()
    const out: OutboxRow[] = []
    for (const r of this.outbox.values()) {
      if (out.length >= limit) break
      if (r.done || r.nextAt > t || r.claimedUntil > t) continue
      r.claimedUntil = t + 30_000
      r.attempts += 1
      out.push({ id: r.id, payload: r.payload, attempts: r.attempts })
    }
    return out
  }
  async completeWebhook(id: string) {
    const r = this.outbox.get(id)
    if (r) r.done = true
  }
  async failWebhook(id: string, _error: string, retryAt: Date) {
    const r = this.outbox.get(id)
    if (r) {
      r.nextAt = retryAt.getTime()
      r.claimedUntil = 0
    }
  }
  /** 測試用：尚未送達的 webhook 數 */
  pendingWebhooks() {
    return [...this.outbox.values()].filter((r) => !r.done).length
  }

  async close() {}

  private must(siteId: string) {
    const s = this.sites.get(siteId)
    if (!s) throw new Error(`site ${siteId} not found`)
    return s
  }
}
