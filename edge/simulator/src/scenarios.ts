import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { buildDemoPlan, hm, taipei } from './demo-plan'
import { HttpStatusError, signedFetch } from './http'
import { waitUntil, type Ctx } from './harness'

/**
 * 情境劇本。每個情境都同時扮演「平台」（推計畫、下指令、收 webhook）與「場館」（模擬電腦＋硬體），
 * 並以斷言檢查結果。新增情境：在 SCENARIOS 加一筆即可。
 */
export interface Scenario {
  id: string
  title: string
  tags: string[]
  run(ctx: Ctx): Promise<void>
}

export const DAY = '2026-11-25'
const T = (h: number, m = 0) => taipei(DAY, hm(h, m))
const MIN = 60_000
const iso = (t: number) => new Date(t).toISOString()

async function siteWithPlan(ctx: Ctx, siteId: string, planOpts: Partial<Parameters<typeof buildDemoPlan>[0]> = {}) {
  const agent = await ctx.newSite(siteId)
  const plan = buildDemoPlan({ siteId, day: DAY, generatedAt: ctx.clock.now(), ...planOpts })
  await ctx.platform.putPlan(plan)
  agent.start()
  await waitUntil(() => agent.planRev !== null, 5_000, '場館下載計畫')
  return { agent, plan }
}

const relay = (a: { hw: { relays: string[] } }, ch: number) => a.hw.relays[ch]

export const SCENARIOS: Scenario[] = [
  {
    id: 'court-booking',
    title: '單場預約：A 場 10–12 點，燈與風扇提前 5 分開、延後 5 分關，B 場不動',
    tags: ['schedule'],
    async run(ctx) {
      ctx.clock.set(T(9, 50))
      const { agent } = await siteWithPlan(ctx, 'sim-court', { bookings: [{ court: 'A', start: T(10), end: T(12), id: 'bk1' }] })
      assert.equal(relay(agent, 1), 'OFF', '09:50 A 燈應關')
      ctx.clock.set(T(9, 55))
      agent.tick()
      assert.equal(relay(agent, 1), 'ON', '09:55 A 燈應開（提前 5 分）')
      assert.equal(relay(agent, 2), 'ON', '09:55 A 風扇應開')
      assert.equal(relay(agent, 3), 'OFF', 'B 燈不應開')
      ctx.clock.set(T(12, 4))
      agent.tick()
      assert.equal(relay(agent, 1), 'ON', '12:04 仍在延後關閉內')
      ctx.clock.set(T(12, 5))
      agent.tick()
      assert.equal(relay(agent, 1), 'OFF', '12:05 A 燈應關')
      assert.ok(agent.hw.played.some((p) => p.file === 'opening.mp3'), '開場應播 opening')
      assert.ok(agent.hw.played.some((p) => p.file === 'ending.mp3'), '結束應播 ending')
    },
  },
  {
    id: 'business-and-night',
    title: '營業時間（05–09）與夜間情境燈（10–11 於 18–22 點）',
    tags: ['schedule'],
    async run(ctx) {
      ctx.clock.set(T(7, 59))
      const { agent } = await siteWithPlan(ctx, 'sim-hours')
      assert.equal(relay(agent, 5), 'OFF', '開門前招牌關')
      ctx.clock.set(T(8))
      agent.tick()
      for (const ch of [5, 6, 7, 8]) assert.equal(relay(agent, ch), 'ON', `營業時 DO${ch} 開`)
      assert.equal(relay(agent, 10), 'OFF', '白天露營燈關')
      ctx.clock.set(T(18))
      agent.tick()
      assert.equal(relay(agent, 10), 'ON', '18:00 露營燈開')
      assert.equal(relay(agent, 11), 'ON', '18:00 地燈開')
      ctx.clock.set(T(22))
      agent.tick()
      for (const ch of [5, 6, 10, 11]) assert.equal(relay(agent, ch), 'OFF', `22:00 打烊 DO${ch} 關`)
      for (const ch of [12, 13, 14, 15, 16]) assert.equal(relay(agent, ch), 'ON', `24 小時供電 DO${ch} 恆開`)
    },
  },
  {
    id: 'door-codes',
    title: '門禁密碼：時段內正確開門、錯誤拒絕、時段外拒絕、連錯 5 次鎖定',
    tags: ['door'],
    async run(ctx) {
      ctx.clock.set(T(9, 45))
      const { agent } = await siteWithPlan(ctx, 'sim-door', { bookings: [{ court: 'A', start: T(10), end: T(11), id: 'bk-door', code: '482913' }] })
      assert.equal(agent.enterCode('482913'), false, '09:45 尚未開放（開打前 10 分）')
      ctx.clock.set(T(9, 50))
      assert.equal(agent.enterCode('482913'), true, '09:50 正確密碼開門')
      assert.ok(agent.hw.played.some((p) => p.file === 'welcome.mp3'), '開門播 welcome')
      ctx.clock.set(T(11, 31))
      assert.equal(agent.enterCode('482913'), false, '11:31 已失效（結束後 30 分）')
      ctx.clock.set(T(10, 30))
      for (let i = 0; i < 5; i++) agent.enterCode('000000')
      assert.equal(agent.enterCode('482913'), false, '連錯 5 次後 5 分鐘內鎖定，正確密碼也不開')
      await waitUntil(() => ctx.sink.payloads('events', 'sim-door').some((p) => p.events.some((e) => e.type === 'door.code_ok')), 8_000, '平台收到開門事件')
      const denied = ctx.sink.payloads('events', 'sim-door').flatMap((p) => p.events).filter((e) => e.type === 'door.code_denied')
      assert.ok(denied.some((e) => e.data?.reason === 'LOCKOUT'), '平台收到鎖定事件')
    },
  },
  {
    id: 'manual-override',
    title: '手動開燈 30 分鐘：長輪詢即時收到、ack 回平台、到期交回排程',
    tags: ['command'],
    async run(ctx) {
      ctx.clock.set(T(14))
      const { agent } = await siteWithPlan(ctx, 'sim-override')
      const until = new Date(T(14, 30)).toISOString()
      const sent = Date.now()
      await ctx.platform.enqueue('sim-override', `cmd-${randomUUID()}`, { type: 'circuit.set', circuit: '03', state: 'ON', hold: { mode: 'MINUTES', until } })
      await waitUntil(() => relay(agent, 3) === 'ON', 5_000, 'B 燈被手動打開')
      const latency = Date.now() - sent
      ctx.log(`指令延遲 ${latency} ms`)
      assert.ok(latency < 2_000, `長輪詢延遲應 < 2 秒，實際 ${latency} ms`)
      await waitUntil(() => ctx.sink.payloads('ack', 'sim-override').some((p) => p.ack.result === 'OK'), 8_000, '平台收到 ack')
      ctx.clock.set(T(14, 29))
      agent.tick()
      assert.equal(relay(agent, 3), 'ON', '維持期間內仍開')
      ctx.clock.set(T(14, 30))
      agent.tick()
      assert.equal(relay(agent, 3), 'OFF', '到期交回排程（無預約→關）')
    },
  },
  {
    id: 'override-next-change',
    title: '手動關燈「到下一個排程切換點」：預約進行中關掉，下一段預約開始時自動恢復',
    tags: ['command'],
    async run(ctx) {
      ctx.clock.set(T(10, 30))
      const { agent } = await siteWithPlan(ctx, 'sim-nextchange', {
        bookings: [
          { court: 'A', start: T(10), end: T(11), id: 'b1' },
          { court: 'A', start: T(13), end: T(14), id: 'b2' },
        ],
      })
      assert.equal(relay(agent, 1), 'ON')
      await ctx.platform.enqueue('sim-nextchange', `cmd-${randomUUID()}`, { type: 'circuit.set', circuit: '01', state: 'OFF', hold: { mode: 'NEXT_CHANGE' } })
      await waitUntil(() => relay(agent, 1) === 'OFF', 5_000, 'A 燈被手動關閉')
      ctx.clock.set(T(11, 10))
      agent.tick()
      assert.equal(relay(agent, 1), 'OFF', '排程變成 OFF → 手動維持結束，仍是關')
      ctx.clock.set(T(12, 55))
      agent.tick()
      assert.equal(relay(agent, 1), 'ON', '下一段預約開始，排程恢復開啟')
    },
  },
  {
    id: 'booking-cancelled',
    title: '當天取消預約：平台推新版計畫，燈不再開、密碼立即失效',
    tags: ['schedule', 'door'],
    async run(ctx) {
      ctx.clock.set(T(9))
      const { agent } = await siteWithPlan(ctx, 'sim-cancel', { bookings: [{ court: 'B', start: T(10), end: T(11), id: 'bk-c', code: '771204' }] })
      const rev1 = agent.planRev
      await ctx.platform.putPlan(buildDemoPlan({ siteId: 'sim-cancel', day: DAY, generatedAt: ctx.clock.now() + 1, bookings: [] }))
      await waitUntil(() => agent.planRev !== rev1, 5_000, '場館收到新版計畫')
      ctx.clock.set(T(10, 15))
      agent.tick()
      assert.equal(relay(agent, 3), 'OFF', '取消後 B 燈不開')
      assert.equal(agent.enterCode('771204'), false, '取消後密碼失效')
    },
  },
  {
    id: 'same-plan-no-bump',
    title: '內容相同的計畫重推不會遞增版本（避免上千場館白白重新下載）',
    tags: ['scale'],
    async run(ctx) {
      ctx.clock.set(T(9))
      const { plan } = await siteWithPlan(ctx, 'sim-dedupe')
      const r = await ctx.platform.putPlan({ ...plan, generatedAt: new Date(T(9, 15)).toISOString() })
      assert.equal(r.changed, false)
      assert.equal(r.rev, 1)
    },
  },
  {
    id: 'offline-operation',
    title: '斷網 2 小時：本機照排程開關燈、密碼照常開門；恢復後補傳事件、Gateway 去重',
    tags: ['network'],
    async run(ctx) {
      ctx.clock.set(T(9, 30))
      const { agent } = await siteWithPlan(ctx, 'sim-offline', { bookings: [{ court: 'A', start: T(10), end: T(12), id: 'bk-o', code: '640219' }] })
      await waitUntil(() => agent.outbox.length === 0, 5_000, '初始事件送完')
      agent.setOffline(true)
      await waitUntil(async () => !(await ctx.platform.site('sim-offline')).online, 10_000, 'Gateway 判定離線')
      await waitUntil(() => ctx.sink.payloads('presence', 'sim-offline').some((p) => !p.online), 8_000, '平台收到離線通知')
      ctx.clock.set(T(10))
      agent.tick()
      assert.equal(relay(agent, 1), 'ON', '斷網中照排程開燈')
      assert.equal(agent.enterCode('640219'), true, '斷網中密碼照常開門')
      ctx.clock.set(T(12, 5))
      agent.tick()
      assert.equal(relay(agent, 1), 'OFF', '斷網中照排程關燈')
      const queued = agent.outbox.length
      assert.ok(queued >= 3, `斷網期間事件累積在本機（${queued} 筆）`)
      agent.setOffline(false)
      await waitUntil(() => agent.outbox.length === 0, 10_000, '恢復後補傳完畢')
      const sinkEvents = () => ctx.sink.payloads('events', 'sim-offline').flatMap((p) => p.events)
      await waitUntil(() => sinkEvents().some((e) => e.type === 'agent.recovered') && sinkEvents().some((e) => e.type === 'door.code_ok'), 15_000, '平台收到恢復與斷網期間的開門事件')
      const okEvents = sinkEvents().filter((e) => e.type === 'door.code_ok')
      assert.equal(okEvents.length, 1, '開門事件只出現一次')
    },
  },
  {
    id: 'event-dedupe',
    title: '同一批事件重送兩次：Gateway 只轉給平台一次',
    tags: ['network'],
    async run(ctx) {
      ctx.clock.set(T(9))
      const { agent } = await siteWithPlan(ctx, 'sim-dup')
      await waitUntil(() => agent.outbox.length === 0, 5_000)
      const ev = { eventId: `ev-${randomUUID()}`, type: 'motion.unbooked' as const, at: new Date().toISOString(), data: { court: 'B' } }
      const send = () => signedFetch({ baseUrl: ctx.gatewayUrl, keyId: 'sim-dup', secret: agent.opts.secret, method: 'POST', path: '/edge/v1/events', body: { events: [ev] } })
      await send()
      await send()
      await waitUntil(() => ctx.sink.payloads('events', 'sim-dup').flatMap((p) => p.events).some((e) => e.eventId === ev.eventId), 8_000)
      await new Promise((r) => setTimeout(r, 2_500))
      const n = ctx.sink.payloads('events', 'sim-dup').flatMap((p) => p.events).filter((e) => e.eventId === ev.eventId).length
      assert.equal(n, 1)
    },
  },
  {
    id: 'expired-command',
    title: '斷網期間下的指令過期：恢復後不執行，平台收到 command.expired',
    tags: ['network', 'command', 'safety'],
    async run(ctx) {
      ctx.clock.set(T(15))
      const { agent } = await siteWithPlan(ctx, 'sim-expire')
      agent.setOffline(true)
      const id = `cmd-${randomUUID()}`
      await ctx.platform.enqueue('sim-expire', id, { type: 'circuit.set', circuit: '09', state: 'ON', hold: { mode: 'INDEFINITE' } }, 5)
      await new Promise((r) => setTimeout(r, 6_000))
      agent.setOffline(false)
      await waitUntil(() => ctx.sink.payloads('command.expired', 'sim-expire').some((p) => p.commandId === id), 10_000, '平台收到過期通知')
      assert.equal((await ctx.platform.command(id)).status, 'EXPIRED')
      assert.ok(!agent.executed.some((e) => e.id === id), '過期指令不執行')
    },
  },
  {
    id: 'duplicate-command',
    title: '平台重送同一個指令 ID：只建立一筆、只執行一次',
    tags: ['command'],
    async run(ctx) {
      ctx.clock.set(T(15))
      const { agent } = await siteWithPlan(ctx, 'sim-idem')
      const id = `cmd-${randomUUID()}`
      const cmd = { type: 'audio.play' as const, file: 'notice.mp3' }
      await ctx.platform.enqueue('sim-idem', id, cmd)
      await ctx.platform.enqueue('sim-idem', id, cmd)
      await waitUntil(() => agent.executed.some((e) => e.id === id), 5_000)
      await new Promise((r) => setTimeout(r, 1_000))
      assert.equal(agent.hw.played.filter((p) => p.file === 'notice.mp3').length, 1)
    },
  },
  {
    id: 'relay-failure',
    title: '繼電器卡住：手動指令回報 FAILED，平台收到 hardware.error',
    tags: ['hardware'],
    async run(ctx) {
      ctx.clock.set(T(15))
      const { agent } = await siteWithPlan(ctx, 'sim-relay')
      agent.hw.faults.stuckChannels = [4]
      const id = `cmd-${randomUUID()}`
      await ctx.platform.enqueue('sim-relay', id, { type: 'circuit.set', circuit: '04', state: 'ON', hold: { mode: 'MINUTES', until: new Date(T(16)).toISOString() } })
      await waitUntil(() => ctx.sink.payloads('ack', 'sim-relay').some((p) => p.commandId === id), 8_000, '平台收到 ack')
      const ack = ctx.sink.payloads('ack', 'sim-relay').find((p) => p.commandId === id)!
      assert.equal(ack.ack.result, 'FAILED')
      await waitUntil(() => ctx.sink.payloads('events', 'sim-relay').some((p) => p.events.some((e) => e.type === 'hardware.error')), 8_000, '平台收到硬體異常')
    },
  },
  {
    id: 'modbus-down',
    title: 'RS-485 斷線：排程寫入失敗會回報 hardware.error，狀態回報 modbus=ERROR',
    tags: ['hardware'],
    async run(ctx) {
      ctx.clock.set(T(7))
      const { agent } = await siteWithPlan(ctx, 'sim-modbus')
      agent.hw.faults.modbusDown = true
      ctx.clock.set(T(8))
      agent.tick()
      assert.equal(agent.status().hardware?.modbus, 'ERROR')
      await waitUntil(() => ctx.sink.payloads('events', 'sim-modbus').some((p) => p.events.some((e) => e.type === 'hardware.error')), 8_000)
      agent.hw.faults.modbusDown = false
      agent.tick()
      assert.equal(relay(agent, 5), 'ON', '恢復後補寫成功')
    },
  },
  {
    id: 'heater-safety',
    title: '熱水器安全上限 180 分鐘：手動「一直開」也會被地端強制關閉',
    tags: ['safety'],
    async run(ctx) {
      ctx.clock.set(T(23))
      const { agent } = await siteWithPlan(ctx, 'sim-heater')
      await ctx.platform.enqueue('sim-heater', `cmd-${randomUUID()}`, { type: 'circuit.set', circuit: '09', state: 'ON', hold: { mode: 'INDEFINITE' } })
      await waitUntil(() => relay(agent, 9) === 'ON', 5_000)
      ctx.clock.advance(179 * MIN)
      agent.tick()
      assert.equal(relay(agent, 9), 'ON', '179 分鐘仍開')
      ctx.clock.advance(1 * MIN)
      agent.tick()
      assert.equal(relay(agent, 9), 'OFF', '180 分鐘強制關閉')
      await waitUntil(() => ctx.sink.payloads('events', 'sim-heater').some((p) => p.events.some((e) => e.type === 'circuit.forced_off')), 8_000)
    },
  },
  {
    id: 'reject-always-on',
    title: '24 小時供電迴路（門鎖供電 12）不接受遠端關閉',
    tags: ['safety'],
    async run(ctx) {
      ctx.clock.set(T(12))
      const { agent } = await siteWithPlan(ctx, 'sim-always')
      const id = `cmd-${randomUUID()}`
      await ctx.platform.enqueue('sim-always', id, { type: 'circuit.set', circuit: '12', state: 'OFF', hold: { mode: 'INDEFINITE' } })
      await waitUntil(async () => (await ctx.platform.command(id)).status === 'REJECTED', 5_000)
      assert.equal(relay(agent, 12), 'ON')
    },
  },
  {
    id: 'motion-unbooked',
    title: '無預約時球場有人：廣播 do_not_use_court 並通知平台',
    tags: ['camera'],
    async run(ctx) {
      ctx.clock.set(T(16))
      const { agent } = await siteWithPlan(ctx, 'sim-motion', { bookings: [{ court: 'A', start: T(15), end: T(17) }] })
      agent.motion('A')
      assert.ok(!agent.hw.played.some((p) => p.file === 'do_not_use_court.mp3'), 'A 有預約不播')
      agent.motion('B')
      assert.ok(agent.hw.played.some((p) => p.file === 'do_not_use_court.mp3'), 'B 無預約要播')
      await waitUntil(() => ctx.sink.payloads('events', 'sim-motion').some((p) => p.events.some((e) => e.type === 'motion.unbooked')), 8_000)
    },
  },
  {
    id: 'remote-unlock',
    title: '後台遠端開門',
    tags: ['door', 'command'],
    async run(ctx) {
      ctx.clock.set(T(12))
      const { agent } = await siteWithPlan(ctx, 'sim-unlock')
      await ctx.platform.enqueue('sim-unlock', `cmd-${randomUUID()}`, { type: 'door.unlock', door: 'main', seconds: 5, reason: '客服協助' })
      await waitUntil(() => agent.hw.unlocks.length === 1, 5_000)
    },
  },
  {
    id: 'log-upload',
    title: '調閱本機 log：時間與等級篩選、截斷、遮罩、上傳後 ack、平台下載',
    tags: ['logs', 'command'],
    async run(ctx) {
      ctx.clock.set(T(10, 58))
      const { agent, plan } = await siteWithPlan(ctx, 'sim-logs', { bookings: [{ court: 'A', start: T(11), end: T(12), id: 'bk-log', code: '731904' }] })
      ctx.clock.set(T(11))
      agent.tick() // 11:00 前 5 分已開，這裡再寫一次確保有 modbus log
      agent.enterCode('000000')
      agent.enterCode(plan.doorCodes[0].code)
      ctx.clock.set(T(12, 5))
      agent.tick()
      for (let i = 0; i < 40; i++) agent.writeLog('edge', 'DEBUG', 'system', 'filler', { i, pad: 'x'.repeat(80) })
      agent.writeLog('edge', 'ERROR', 'system', 'disk almost full', { freeMb: 120 })

      const id = `log-${randomUUID()}`
      await ctx.platform.enqueue('sim-logs', id, { type: 'log.upload', files: ['edge', 'audit', 'modbus'], from: iso(T(10, 50)), to: iso(T(13)) }, 600)
      await waitUntil(async () => (await ctx.platform.command(id)).status === 'ACKED', 8_000, 'log.upload ack')
      const [row] = (await ctx.platform.logs('sim-logs')).logs
      assert.equal(row.id, id)
      assert.ok(row.upload, '應有上傳結果')
      assert.deepEqual(row.upload!.files.map((f) => f.name), ['edge', 'audit', 'modbus'])

      const audit = await ctx.platform.logFile('sim-logs', id, 'audit')
      assert.ok(audit.includes('door.code_denied') && audit.includes('door.code_ok'), 'audit.log 應有門禁紀錄')
      assert.ok(!audit.includes(plan.doorCodes[0].code), 'log 不可出現門禁明碼')
      assert.ok(audit.includes('****00'), '錯誤密碼只留遮罩')
      const modbus = await ctx.platform.logFile('sim-logs', id, 'modbus')
      assert.ok(modbus.split("\n").filter(Boolean).every((l) => JSON.parse(l).component === 'modbus'), 'modbus.log 每行都是 JSON')
      await waitUntil(() => ctx.sink.payloads('log.uploaded', 'sim-logs').length === 1, 8_000, 'log.uploaded webhook')

      // 只要 WARN 以上、限制 1 KB → 只剩錯誤、且標示截斷時保留最新
      const id2 = `log-${randomUUID()}`
      await ctx.platform.enqueue('sim-logs', id2, { type: 'log.upload', files: ['edge'], from: iso(T(10, 50)), to: iso(T(13)), minLevel: 'WARN' }, 600)
      await waitUntil(async () => (await ctx.platform.command(id2)).status === 'ACKED', 8_000)
      const warn = (await ctx.platform.logFile('sim-logs', id2, 'edge')).split("\n").filter(Boolean).map((l) => JSON.parse(l))
      assert.ok(warn.length > 0 && warn.every((l) => l.level === 'WARN' || l.level === 'ERROR'), 'minLevel=WARN 只留 WARN/ERROR')
      assert.ok(warn.some((l) => l.msg === 'disk almost full'))

      const id3 = `log-${randomUUID()}`
      await ctx.platform.enqueue('sim-logs', id3, { type: 'log.upload', files: ['edge'], from: iso(T(10, 50)), to: iso(T(13)), maxBytes: 1024 }, 600)
      await waitUntil(async () => (await ctx.platform.command(id3)).status === 'ACKED', 8_000)
      const r3 = (await ctx.platform.logs('sim-logs')).logs.find((l) => l.id === id3)!
      assert.equal(r3.upload!.files[0].truncated, true, '超過 maxBytes 應標示截斷')
      assert.ok(r3.upload!.bytes <= 1024)
      const kept = (await ctx.platform.logFile('sim-logs', id3, 'edge')).trim().split('\n')
      const start = agent.logs.edge.indexOf(kept[0])
      assert.ok(start > 0, '截斷時丟掉最舊的部分')
      assert.deepEqual(agent.logs.edge.slice(start, start + kept.length), kept, '保留的是連續、較新的部分')

      // 防呆：不是 log.upload 的指令、未要求的檔案都不可上傳
      const put = (cmdId: string, files: unknown[]) =>
        signedFetch({ baseUrl: ctx.gatewayUrl, keyId: 'sim-logs', secret: agent.opts.secret, method: 'PUT', path: `/edge/v1/logs/${cmdId}`, body: { from: iso(T(10)), to: iso(T(13)), files } }).then(
          () => 'OK',
          (e) => (e instanceof HttpStatusError ? `${e.status} ${e.code}` : String(e)),
        )
      assert.equal(await put(id2, [{ name: 'modbus', content: '', lines: 0, truncated: false }]), '422 VALIDATION')
      const cmd = `cmd-${randomUUID()}`
      await ctx.platform.enqueue('sim-logs', cmd, { type: 'status.report' })
      await waitUntil(async () => (await ctx.platform.command(cmd)).status === 'ACKED', 8_000)
      assert.equal(await put(cmd, [{ name: 'edge', content: '', lines: 0, truncated: false }]), '409 CONFLICT')
      assert.equal(await put('nope-12345678', [{ name: 'edge', content: '', lines: 0, truncated: false }]), '404 NOT_FOUND')
    },
  },
  {
    id: 'security',
    title: '安全：錯誤簽章、重送 nonce、時鐘偏差、未開通場館、停用場館、換金鑰',
    tags: ['security'],
    async run(ctx) {
      ctx.clock.set(T(12))
      const { agent } = await siteWithPlan(ctx, 'sim-sec')
      const secret = agent.opts.secret
      const call = (tamper: Parameters<typeof signedFetch>[0]['tamper'], keyId = 'sim-sec', s = secret) =>
        signedFetch({ baseUrl: ctx.gatewayUrl, keyId, secret: s, method: 'GET', path: '/edge/v1/plan', tamper }).then(
          () => 'OK',
          (e) => (e instanceof HttpStatusError ? `${e.status} ${e.code}` : String(e)),
        )
      assert.equal(await call({ badSignature: true }), '401 BAD_SIGNATURE')
      assert.equal(await call({ skewMs: 6 * MIN }), '401 CLOCK_SKEW')
      assert.equal(await call({ nonce: 'fixed-nonce-123' }), 'OK')
      assert.equal(await call({ nonce: 'fixed-nonce-123' }), '401 REPLAY')
      assert.equal(await call({}, 'sim-nobody'), '401 UNAUTHENTICATED')
      // 拿 A 場館的金鑰冒充 B 場館
      await ctx.platform.upsertSite('sim-other', '另一館')
      assert.equal(await call({}, 'sim-other'), '401 BAD_SIGNATURE')
      await ctx.platform.disable('sim-sec')
      assert.equal(await call({}), '403 SITE_DISABLED')
      await ctx.platform.enable('sim-sec')
      const rotated = await ctx.platform.credentials('sim-sec', true)
      assert.equal(await call({}), '401 BAD_SIGNATURE', '換金鑰後舊金鑰失效')
      assert.equal(await call({}, 'sim-sec', rotated.secret), 'OK', '新金鑰可用')
      agent.opts.secret = rotated.secret
    },
  },
  {
    id: 'restart-recovery',
    title: '場館電腦重開機：重新下載計畫並立即回到正確狀態',
    tags: ['hardware', 'network'],
    async run(ctx) {
      ctx.clock.set(T(10, 30))
      const { agent } = await siteWithPlan(ctx, 'sim-reboot', { bookings: [{ court: 'B', start: T(10), end: T(12) }] })
      assert.equal(relay(agent, 3), 'ON')
      await agent.stop()
      const fresh = await ctx.newSite('sim-reboot')
      fresh.start()
      await waitUntil(() => fresh.planRev !== null, 5_000, '重開機後下載計畫')
      assert.equal(relay(fresh, 3), 'ON', '重開機後 B 燈立即恢復')
      assert.equal(relay(fresh, 1), 'OFF')
    },
  },
]
