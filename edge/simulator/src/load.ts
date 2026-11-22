import { randomUUID } from 'node:crypto'
import type { EdgeAgent } from './agent'
import { buildDemoPlan } from './demo-plan'
import { createContext, waitUntil } from './harness'

/**
 * 多場館壓力測試：N 個模擬場館同時長輪詢，平台對每館下一個指令，量測送達延遲。
 */
export async function runLoad(o: { sites: number; gatewayUrl?: string; platformSecret?: string }) {
  const day = new Date().toISOString().slice(0, 10)
  const h = await createContext({ startAt: Date.now(), gatewayUrl: o.gatewayUrl, platformSecret: o.platformSecret })
  const { ctx } = h
  try {
    console.log(`開通 ${o.sites} 個場館…`)
    const agents: EdgeAgent[] = []
    for (let i = 0; i < o.sites; i++) {
      const id = `load-${String(i + 1).padStart(4, '0')}`
      const a = await ctx.newSite(id, { pollWaitSec: 20, heartbeatMs: 10_000, flushMs: 2_000, tickMs: 5_000 })
      await ctx.platform.putPlan(buildDemoPlan({ siteId: id, day, generatedAt: Date.now() }))
      agents.push(a)
    }
    agents.forEach((a) => a.start())
    await waitUntil(() => agents.every((a) => a.planRev !== null), 60_000, '全部下載計畫')
    await new Promise((r) => setTimeout(r, 1_000))

    console.log('對每個場館下一個指令…')
    const sentAt = new Map<string, number>()
    await Promise.all(
      agents.map(async (a) => {
        const id = `load-${randomUUID()}`
        sentAt.set(a.opts.siteId, Date.now())
        await ctx.platform.enqueue(a.opts.siteId, id, { type: 'audio.play', file: 'load.mp3' })
      }),
    )
    await waitUntil(() => agents.every((a) => a.hw.played.some((p) => p.file === 'load.mp3')), 60_000, '全部執行')
    // 壓力測試的場館時鐘就是真實時間，executed.at 可直接與送出時間比較
    const real = agents.map((a) => a.executed.find((e) => e.command.type === 'audio.play')!.at - sentAt.get(a.opts.siteId)!).sort((x, y) => x - y)
    const pct = (p: number) => real[Math.min(real.length - 1, Math.floor((p / 100) * real.length))]
    console.log(`\n場館數 ${o.sites}｜指令送達延遲 p50 ${pct(50)} ms｜p95 ${pct(95)} ms｜最大 ${real[real.length - 1]} ms`)
    await waitUntil(() => ctx.sink.payloads('ack').length >= o.sites, 60_000, '平台收到全部 ack').catch((e) => console.log(e.message))
    console.log(`平台收到 ack ${ctx.sink.payloads('ack').length}/${o.sites}`)
  } finally {
    await h.close()
  }
}
