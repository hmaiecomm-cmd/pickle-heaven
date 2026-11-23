import postgres from 'postgres'
import type { CommandAck, CommandRecord, EdgeCommand, EdgeEvent, StatusReport, WebhookPayload } from '@gh/iot-contract'
import type { LogUploadMeta, OutboxRow, SiteRow, Store } from './types'

type Sql = postgres.Sql

const iso = (d: Date | string | null): string | null => (d === null ? null : new Date(d).toISOString())

function toSite(r: Record<string, any>): SiteRow {
  return {
    siteId: r.site_id,
    name: r.name,
    venueId: r.venue_id,
    keyVersion: r.key_version,
    disabled: r.disabled,
    planRev: r.plan_rev,
    lastSeenAt: r.last_seen_at,
    agentVersion: r.agent_version,
    online: r.online,
    status: r.status,
    statusAt: r.status_at,
  }
}

function toCommand(r: Record<string, any>): CommandRecord {
  return {
    id: r.id,
    siteId: r.site_id,
    command: r.command as EdgeCommand,
    status: r.status,
    requestedBy: r.requested_by,
    createdAt: iso(r.created_at)!,
    expiresAt: iso(r.expires_at)!,
    deliveredAt: iso(r.delivered_at),
    ackedAt: iso(r.acked_at),
    ack: r.ack,
  }
}

function toLogMeta(r: Record<string, any>): LogUploadMeta {
  return { id: r.id, siteId: r.site_id, uploadedAt: new Date(r.uploaded_at), bytes: r.bytes, files: r.files }
}

/** 正式版：DigitalOcean Managed Postgres。多台 Gateway 同時運作靠交易與 FOR UPDATE SKIP LOCKED。 */
export class PostgresStore implements Store {
  readonly sql: Sql

  constructor(url: string) {
    this.sql = postgres(url, {
      max: Number(process.env.PG_POOL_MAX ?? 10),
      idle_timeout: 30,
      // DO Managed Postgres 走 TLS；憑證由 DO 簽發
      ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: process.env.PG_SSL_STRICT === '1' },
      transform: { undefined: null },
    })
  }

  async getSite(siteId: string) {
    const [r] = await this.sql`SELECT * FROM sites WHERE site_id = ${siteId}`
    return r ? toSite(r) : null
  }
  async listSites() {
    return (await this.sql`SELECT * FROM sites ORDER BY site_id`).map(toSite)
  }
  async upsertSite(siteId: string, data: { name: string; venueId: string | null }) {
    const [r] = await this.sql`
      INSERT INTO sites (site_id, name, venue_id) VALUES (${siteId}, ${data.name}, ${data.venueId})
      ON CONFLICT (site_id) DO UPDATE SET name = EXCLUDED.name, venue_id = EXCLUDED.venue_id, updated_at = now()
      RETURNING *`
    return toSite(r)
  }
  async bumpKeyVersion(siteId: string) {
    const [r] = await this.sql`UPDATE sites SET key_version = key_version + 1, updated_at = now() WHERE site_id = ${siteId} RETURNING key_version`
    if (!r) throw new Error(`site ${siteId} not found`)
    return r.key_version as number
  }
  async setDisabled(siteId: string, disabled: boolean) {
    await this.sql`UPDATE sites SET disabled = ${disabled}, updated_at = now() WHERE site_id = ${siteId}`
  }
  async touchSite(siteId: string, at: Date, agentVersion: string) {
    // 只有「離線→上線」或版本變更時才真的寫入，避免上千個場館的心跳把資料庫寫爆；
    // 其餘情況每 5 分鐘落地一次 last_seen_at（即時在線狀態在 Redis）。
    const [r] = await this.sql`
      WITH prev AS (SELECT online FROM sites WHERE site_id = ${siteId})
      UPDATE sites SET online = true, last_seen_at = ${at}, agent_version = ${agentVersion}
      WHERE site_id = ${siteId}
        AND (online = false OR agent_version IS DISTINCT FROM ${agentVersion} OR last_seen_at IS NULL OR last_seen_at < ${new Date(at.getTime() - 5 * 60_000)})
      RETURNING (SELECT online FROM prev) AS was_online`
    return { cameOnline: r ? r.was_online === false : false }
  }
  async staleOnlineSites(cutoff: Date) {
    return (await this.sql`SELECT * FROM sites WHERE online = true AND (last_seen_at IS NULL OR last_seen_at < ${cutoff})`).map(toSite)
  }
  async setOffline(siteId: string) {
    const r = await this.sql`UPDATE sites SET online = false WHERE site_id = ${siteId} AND online = true RETURNING site_id`
    return r.length > 0
  }
  async saveStatus(siteId: string, status: StatusReport, at: Date) {
    await this.sql`UPDATE sites SET status = ${this.sql.json(status as any)}, status_at = ${at} WHERE site_id = ${siteId}`
  }

  async putPlan(siteId: string, hash: string, ciphertext: string, at: Date) {
    return this.sql.begin(async (tx) => {
      const [site] = await tx`SELECT plan_rev FROM sites WHERE site_id = ${siteId} FOR UPDATE`
      if (!site) throw new Error(`site ${siteId} not found`)
      const [cur] = await tx`SELECT hash FROM site_plans WHERE site_id = ${siteId} AND rev = ${site.plan_rev}`
      if (cur && cur.hash === hash) return { rev: site.plan_rev as number, changed: false }
      const rev = (site.plan_rev as number) + 1
      await tx`INSERT INTO site_plans (site_id, rev, hash, ciphertext, created_at) VALUES (${siteId}, ${rev}, ${hash}, ${ciphertext}, ${at})`
      await tx`UPDATE sites SET plan_rev = ${rev}, updated_at = now() WHERE site_id = ${siteId}`
      // 只保留最近 20 版
      await tx`DELETE FROM site_plans WHERE site_id = ${siteId} AND rev <= ${rev - 20}`
      return { rev, changed: true }
    })
  }
  async getPlan(siteId: string) {
    const [r] = await this.sql`
      SELECT p.rev, p.ciphertext FROM site_plans p JOIN sites s ON s.site_id = p.site_id AND s.plan_rev = p.rev
      WHERE p.site_id = ${siteId}`
    return r ? { rev: r.rev as number, ciphertext: r.ciphertext as string } : null
  }

  async enqueueCommand(c: Parameters<Store['enqueueCommand']>[0]) {
    const [r] = await this.sql`
      INSERT INTO commands (id, site_id, type, command, requested_by, created_at, expires_at)
      VALUES (${c.id}, ${c.siteId}, ${c.command.type}, ${this.sql.json(c.command as any)}, ${c.requestedBy}, ${c.createdAt}, ${c.expiresAt})
      ON CONFLICT (id) DO NOTHING RETURNING *`
    if (r) return { record: toCommand(r), created: true }
    const [existing] = await this.sql`SELECT * FROM commands WHERE id = ${c.id}`
    return { record: toCommand(existing), created: false }
  }
  async takeCommands(siteId: string, at: Date, redeliverBefore: Date, limit: number) {
    return this.sql.begin(async (tx) => {
      const expired = await tx`
        UPDATE commands SET status = 'EXPIRED'
        WHERE site_id = ${siteId} AND status IN ('QUEUED', 'DELIVERED') AND expires_at <= ${at}
        RETURNING *`
      const deliver = await tx`
        UPDATE commands SET status = 'DELIVERED', delivered_at = ${at}, deliveries = deliveries + 1
        WHERE id IN (
          SELECT id FROM commands
          WHERE site_id = ${siteId} AND expires_at > ${at}
            AND (status = 'QUEUED' OR (status = 'DELIVERED' AND delivered_at < ${redeliverBefore}))
          ORDER BY created_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *`
      return {
        deliver: deliver.map(toCommand).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        expired: expired.map(toCommand),
      }
    })
  }
  async ackCommand(siteId: string, id: string, ack: CommandAck, at: Date) {
    const status = ack.result === 'OK' ? 'ACKED' : ack.result
    const [r] = await this.sql`
      UPDATE commands SET status = ${status}, ack = ${this.sql.json(ack as any)}, acked_at = ${at}
      WHERE id = ${id} AND site_id = ${siteId} AND status IN ('QUEUED', 'DELIVERED')
      RETURNING *`
    if (r) return toCommand(r)
    const [existing] = await this.sql`SELECT * FROM commands WHERE id = ${id} AND site_id = ${siteId}`
    return existing ? toCommand(existing) : null
  }
  async getCommand(id: string) {
    const [r] = await this.sql`SELECT * FROM commands WHERE id = ${id}`
    return r ? toCommand(r) : null
  }
  async listCommands(siteId: string, limit: number) {
    return (await this.sql`SELECT * FROM commands WHERE site_id = ${siteId} ORDER BY created_at DESC LIMIT ${limit}`).map(toCommand)
  }
  async countPending(siteId: string, at: Date) {
    const [r] = await this.sql`SELECT count(*)::int AS n FROM commands WHERE site_id = ${siteId} AND status IN ('QUEUED', 'DELIVERED') AND expires_at > ${at}`
    return r.n as number
  }

  async insertEvents(siteId: string, events: EdgeEvent[], at: Date) {
    if (events.length === 0) return []
    const rows = events.map((e) => ({ site_id: siteId, event_id: e.eventId, type: e.type, at: new Date(e.at), data: e.data ?? null, received_at: at }))
    const inserted = await this.sql`
      INSERT INTO events ${this.sql(rows as any, 'site_id', 'event_id', 'type', 'at', 'data', 'received_at')}
      ON CONFLICT (site_id, event_id) DO NOTHING RETURNING event_id`
    const fresh = new Set(inserted.map((r) => r.event_id as string))
    return events.filter((e) => fresh.has(e.eventId))
  }

  async saveLogUpload(m: LogUploadMeta, gz: Buffer) {
    await this.sql`
      INSERT INTO log_uploads (id, site_id, uploaded_at, bytes, files, content_gz)
      VALUES (${m.id}, ${m.siteId}, ${m.uploadedAt}, ${m.bytes}, ${this.sql.json(m.files as any)}, ${gz})
      ON CONFLICT (id) DO UPDATE SET uploaded_at = EXCLUDED.uploaded_at, bytes = EXCLUDED.bytes, files = EXCLUDED.files, content_gz = EXCLUDED.content_gz`
  }
  async listLogUploads(siteId: string, ids: string[]) {
    if (ids.length === 0) return []
    const rows = await this.sql`SELECT id, site_id, uploaded_at, bytes, files FROM log_uploads WHERE site_id = ${siteId} AND id IN ${this.sql(ids)}`
    return rows.map(toLogMeta)
  }
  async getLogUpload(siteId: string, id: string) {
    const [r] = await this.sql`SELECT * FROM log_uploads WHERE site_id = ${siteId} AND id = ${id}`
    return r ? { meta: toLogMeta(r), gz: Buffer.from(r.content_gz) } : null
  }
  async purgeLogUploads(before: Date) {
    const r = await this.sql`DELETE FROM log_uploads WHERE uploaded_at < ${before}`
    return r.count
  }

  async enqueueWebhook(payload: WebhookPayload) {
    await this.sql`INSERT INTO webhook_outbox (payload) VALUES (${this.sql.json(payload as any)})`
  }
  async claimWebhooks(at: Date, limit: number): Promise<OutboxRow[]> {
    const rows = await this.sql`
      UPDATE webhook_outbox SET attempts = attempts + 1, claimed_until = ${new Date(at.getTime() + 30_000)}
      WHERE id IN (
        SELECT id FROM webhook_outbox
        WHERE delivered_at IS NULL AND next_attempt_at <= ${at} AND (claimed_until IS NULL OR claimed_until < ${at})
        ORDER BY id LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, payload, attempts`
    return rows.map((r) => ({ id: String(r.id), payload: r.payload as WebhookPayload, attempts: r.attempts as number }))
  }
  async completeWebhook(id: string, at: Date) {
    await this.sql`UPDATE webhook_outbox SET delivered_at = ${at}, last_error = NULL WHERE id = ${id}`
  }
  async failWebhook(id: string, error: string, retryAt: Date) {
    await this.sql`UPDATE webhook_outbox SET next_attempt_at = ${retryAt}, claimed_until = NULL, last_error = ${error.slice(0, 500)} WHERE id = ${id}`
  }

  async close() {
    await this.sql.end({ timeout: 5 })
  }
}
