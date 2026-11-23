import { EdgeAgent } from './agent'
import { buildDemoPlan, hm, taipei } from './demo-plan'
import { createContext } from './harness'
import { runLoad } from './load'
import { startPanel } from './panel'
import { DAY, SCENARIOS } from './scenarios'

/**
 * 用法
 *   npm run scenarios                         全部情境（內建記憶體版 Gateway）
 *   npm run scenarios -- door-codes security  指定情境 ID 或標籤（door、network、safety…）
 *   npm run scenarios -- --verbose
 *   npm run load -- --sites 200               多場館壓力測試
 *   npm run panel                             單一場館＋即時面板（內建 Gateway、示範計畫）
 *   npm run panel -- --url https://gw.example.com --site xindian001 --secret <場館金鑰>
 *                                              連到真正的 Gateway，當作一台場館電腦
 */

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const has = (name: string) => args.includes(`--${name}`)
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--verbose'].includes(args[i - 1])))

async function scenarios() {
  const want = positional.slice(1)
  const list = want.length ? SCENARIOS.filter((s) => want.includes(s.id) || s.tags.some((t) => want.includes(t))) : SCENARIOS
  if (list.length === 0) {
    console.log('找不到情境。可用：\n' + SCENARIOS.map((s) => `  ${s.id.padEnd(22)} [${s.tags.join(',')}] ${s.title}`).join('\n'))
    process.exit(1)
  }
  let pass = 0
  const failed: string[] = []
  for (const s of list) {
    const h = await createContext({ startAt: taipei(DAY, hm(9)), verbose: has('verbose'), gatewayUrl: flag('gateway'), platformSecret: flag('platform-secret') })
    const t0 = Date.now()
    try {
      await s.run(h.ctx)
      pass++
      console.log(`✔ ${s.id.padEnd(22)} ${s.title} (${Date.now() - t0} ms)`)
    } catch (e) {
      failed.push(s.id)
      console.log(`✘ ${s.id.padEnd(22)} ${s.title}\n    ${(e as Error).message}`)
    } finally {
      await h.close()
    }
  }
  console.log(`\n${pass}/${list.length} 通過${failed.length ? `；失敗：${failed.join(', ')}` : ''}`)
  process.exit(failed.length ? 1 : 0)
}

async function panel() {
  const port = Number(flag('port') ?? 4310)
  const url = flag('url')
  if (url) {
    const site = flag('site')
    const secret = flag('secret') ?? process.env.SITE_SECRET
    if (!site || !secret) throw new Error('連真正的 Gateway 需要 --site 與 --secret（或環境變數 SITE_SECRET）')
    const agent = new EdgeAgent({ baseUrl: url, siteId: site, secret, log: console.log })
    agent.start()
    startPanel(agent, port)
    return
  }
  const h = await createContext({ startAt: Date.now() })
  const day = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)
  const agent = new EdgeAgent({ baseUrl: h.ctx.gatewayUrl, siteId: 'demo-site', secret: (await (async () => {
    await h.ctx.platform.upsertSite('demo-site', '示範場館')
    return (await h.ctx.platform.credentials('demo-site')).secret
  })()), log: console.log, heartbeatMs: 5_000, pollWaitSec: 20 })
  const nowMin = Math.floor(((Date.now() + 8 * 3600_000) % 86_400_000) / 60_000)
  await h.ctx.platform.putPlan(
    buildDemoPlan({
      siteId: 'demo-site',
      day,
      generatedAt: Date.now(),
      bookings: [
        { court: 'A', start: taipei(day, nowMin - 10), end: taipei(day, nowMin + 50), id: 'demo-a', code: '123456' },
        { court: 'B', start: taipei(day, nowMin + 5), end: taipei(day, nowMin + 65), id: 'demo-b', code: '654321' },
      ],
    }),
  )
  agent.start()
  startPanel(agent, port)
  console.log('示範密碼：123456（A 場，現在可用）、654321（B 場）。平台指令請用 PlatformClient 或測試腳本送出。')
}

const cmd = positional[0] ?? 'scenarios'
const run = cmd === 'load' ? () => runLoad({ sites: Number(flag('sites') ?? 50), gatewayUrl: flag('gateway'), platformSecret: flag('platform-secret') }) : cmd === 'panel' ? panel : scenarios
run().catch((e) => {
  console.error(e)
  process.exit(1)
})
