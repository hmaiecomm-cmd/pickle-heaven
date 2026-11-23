import { LOG_RETENTION_DAYS, NVR_RETENTION_DAYS, signRequest, type WebhookEnvelope } from '@gh/iot-contract'
import type { Deps } from './app'

/**
 * 背景工作（每台 Gateway 都會啟動，但用鎖保證同一時間只有一台在跑）：
 * 1. 離線偵測：超過 OFFLINE_AFTER_SEC 沒心跳 → 標示離線並通知平台
 * 2. Webhook 投遞：outbox 至少送達一次，失敗指數退避（最長 10 分鐘）
 * 3. 清除超過保存期限的場館 log 上傳（每小時）
 */
export function startWorkers({ cfg, store, rt, now = () => new Date() }: Deps, fetchImpl: typeof fetch = fetch) {
  let stopped = false
  const timers: NodeJS.Timeout[] = []

  async function sweepOffline() {
    if (!(await rt.tryLock('sweeper', cfg.instanceId, 30_000))) return
    const cutoff = new Date(now().getTime() - cfg.offlineAfterSec * 1000)
    for (const s of await store.staleOnlineSites(cutoff)) {
      if (await rt.isPresent(s.siteId)) continue
      if (await store.setOffline(s.siteId)) {
        await store.enqueueWebhook({ kind: 'presence', siteId: s.siteId, online: false, lastSeenAt: s.lastSeenAt ? new Date(s.lastSeenAt).toISOString() : null })
      }
    }
  }

  async function deliverWebhooks() {
    if (!cfg.webhookUrl || !cfg.webhookSecret) return
    const batch = await store.claimWebhooks(now(), 20)
    const url = new URL(cfg.webhookUrl)
    await Promise.all(
      batch.map(async (row) => {
        // id 固定為 outbox 編號：重送時不變，平台據此去重
        const env: WebhookEnvelope = { id: `wh_${row.id}`, sentAt: now().toISOString(), payload: row.payload }
        const body = JSON.stringify(env)
        const post = () =>
          fetchImpl(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...signRequest({ keyId: 'gateway', secret: cfg.webhookSecret!, method: 'POST', pathWithQuery: url.pathname + url.search, body }),
            },
            body,
            signal: AbortSignal.timeout(10_000),
          })
        try {
          // 連線層錯誤（例如重用到對方已關閉的 keep-alive 連線）立即重試一次，不必等退避
          const res = await post().catch((e) => (e instanceof TypeError ? post() : Promise.reject(e)))
          if (res.ok) await store.completeWebhook(row.id, now())
          else throw new Error(`HTTP ${res.status}`)
        } catch (e) {
          const delay = Math.min(600_000, 2_000 * 2 ** Math.min(row.attempts, 9))
          await store.failWebhook(row.id, (e as Error).message, new Date(now().getTime() + delay))
        }
      }),
    )
  }

  async function purgeLogs() {
    if (!(await rt.tryLock('log-purge', cfg.instanceId, 300_000))) return
    const n = await store.purgeLogUploads(new Date(now().getTime() - LOG_RETENTION_DAYS * 86_400_000))
    if (n) console.log(`[gateway] purged ${n} log uploads`)
  }

  async function purgeMedia() {
    if (!(await rt.tryLock('media-purge', cfg.instanceId, 60_000))) return
    const t = now().getTime()
    await store.purgeMedia('live', new Date(t - 10 * 60_000))
    await store.purgeMedia('clip', new Date(t - 24 * 3600_000))
    await store.purgeNvrIndexes(new Date(t - NVR_RETENTION_DAYS * 86_400_000))
  }

  const loop = (fn: () => Promise<void>, everyMs: number) => {
    const tick = async () => {
      if (stopped) return
      try {
        await fn()
      } catch (e) {
        console.error('[gateway] worker error', (e as Error).message)
      }
      if (!stopped) timers.push(setTimeout(tick, everyMs))
    }
    timers.push(setTimeout(tick, everyMs))
  }

  loop(sweepOffline, Math.max(1_000, Math.min(15_000, (cfg.offlineAfterSec * 1000) / 3)))
  loop(deliverWebhooks, 2_000)
  loop(purgeLogs, 3_600_000)
  loop(purgeMedia, 60_000)

  return {
    stop() {
      stopped = true
      timers.forEach(clearTimeout)
    },
    /** 測試用：立即跑一次 */
    async runOnce() {
      await sweepOffline()
      await deliverWebhooks()
    },
  }
}
