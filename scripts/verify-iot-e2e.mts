/**
 * IoT 端到端驗證：平台（真實程式碼）→ IoT Gateway（記憶體版）→ 模擬場館電腦 → webhook 回平台。
 *
 * 一律使用暫存的本機 SQLite，絕不連正式或開發的 Turso：
 *   npm run verify:iot
 *
 * 驗證項目
 *   1. 平台由預約、時段密碼、迴路設定組出場館計畫並推送（內容不變不遞增版本）
 *   2. 場館下載計畫：A 場預約時段、營業時間、夜間燈、門禁密碼都正確
 *   3. 後台手動開燈 → Gateway → 場館執行 → webhook → ControlCommand=ACKED、Circuit.actualState=ON
 *   4. 場館輸入密碼開門 → webhook → AuditLog DOOR_CODE_OK（不含明碼）
 *   5. 後台調閱場館 log → 場館上傳 → 可下載、AuditLog IOT_LOG_REQUESTED／IOT_LOG_UPLOADED
 *   6. 場館電腦離線 → webhook → ControlEvent DEVICE_OFFLINE
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import assert from 'node:assert/strict'

const dir = mkdtempSync(join(process.env.IOT_E2E_DIR ?? tmpdir(), 'iot-e2e-'))
const dbFile = join(dir, 'e2e.db').replace(/\\/g, '/')
process.env.TURSO_DATABASE_URL = `file:${dbFile}`
delete process.env.TURSO_AUTH_TOKEN
delete process.env.DEMO_DATABASE_URL
process.env.SLOT_PASSWORD_SECRET = 'e2e-slot-password-secret-0123456789'

const step = (m: string) => console.log(`\n▶ ${m}`)
const ok = (m: string) => console.log(`  ✔ ${m}`)

async function main() {
  step(`建立暫存資料庫 ${dbFile}`)
  const sql = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', shell: process.platform === 'win32' })
  const { createClient } = await import('@libsql/client')
  const raw = createClient({ url: `file:${dbFile}` })
  await raw.executeMultiple(sql)
  raw.close()
  ok('schema 建立完成')

  const { prisma } = await import('@/lib/db')
  const { CIRCUIT_DEFINITIONS } = await import('@/lib/control-types')
  const { encryptCode, fingerprintCode, maskCode } = await import('@/server/slot-password-service')
  const { taipeiDateString, taipeiToUtc } = await import('@/lib/time')

  // ── 種子資料 ──
  const org = await prisma.organization.create({ data: { slug: 'e2e', name: 'E2E' } })
  const venue = await prisma.venue.create({ data: { organizationId: org.id, slug: 'e2e-venue', name: 'E2E 場館', address: '-', phone: '-', siteCode: 'e2e001', openMinute: 480, closeMinute: 1320 } })
  const courtA = await prisma.court.create({ data: { venueId: venue.id, name: 'A 場', sortOrder: 1 } })
  await prisma.court.create({ data: { venueId: venue.id, name: 'B 場', sortOrder: 2 } })
  for (const [no, def] of Object.entries(CIRCUIT_DEFINITIONS)) {
    await prisma.circuit.create({
      data: {
        venueId: venue.id,
        circuitNumber: no,
        name: def.name,
        category: def.category,
        enabled: def.defaultEnabled,
        remoteControlEnabled: def.remoteControlEnabled,
        scheduleControlEnabled: def.scheduleControlEnabled,
        reservationAdvanceMinutes: def.category === 'RESERVATION_DYNAMIC' ? 5 : null,
        reservationDelayMinutes: def.category === 'RESERVATION_DYNAMIC' ? 5 : null,
      },
    })
  }
  const today = taipeiDateString()
  const start = taipeiToUtc(today, 20 * 60)
  const end = taipeiToUtc(today, 22 * 60)
  await prisma.reservation.create({ data: { courtId: courtA.id, startsAt: start, endsAt: end, status: 'BOOKED' } })
  const rule = await prisma.slotPasswordRule.create({ data: { venueId: venue.id } })
  const code = '583920'
  const openAt = new Date(Date.now() - 10 * 60_000)
  const expireAt = new Date(end.getTime() + 30 * 60_000)
  await prisma.slotPassword.create({
    data: { venueId: venue.id, ruleId: rule.id, slotDate: today, slotType: 'AFTERNOON', slotStartAt: start, slotEndAt: end, codeHash: fingerprintCode(code), codeCiphertext: encryptCode(code), maskedCode: maskCode(code), openAt, expireAt, status: 'ACTIVE', activeOrderCount: 1 },
  })
  ok('種子：1 場館（siteCode e2e001）、2 球場、18 迴路、A 場今晚 20–22 點預約、1 組時段密碼')

  // ── 平台 webhook：把 Gateway 的回報轉給真正的 /api/iot/webhook route handler ──
  const { POST: webhook } = await import('@/app/api/iot/webhook/route')
  const hook = createServer(async (req, res) => {
    let body = ''
    for await (const c of req) body += c
    const r = await webhook(new Request(`http://127.0.0.1${req.url}`, { method: 'POST', headers: req.headers as any, body }))
    res.writeHead(r.status, { 'content-type': 'application/json' }).end(await r.text())
  })
  hook.keepAliveTimeout = 65_000
  await new Promise<void>((r) => hook.listen(0, '127.0.0.1', () => r()))
  const hookUrl = `http://127.0.0.1:${(hook.address() as AddressInfo).port}/api/iot/webhook`

  const { startEmbeddedGateway } = await import('../services/iot-gateway/src/embedded')
  const gw = await startEmbeddedGateway({ webhookUrl: hookUrl, webhookSecret: 'e2e-webhook-secret', offlineAfterSec: 3 })
  process.env.IOT_GATEWAY_URL = gw.url
  process.env.IOT_PLATFORM_SECRET = gw.cfg.platformSecret
  process.env.IOT_WEBHOOK_SECRET = 'e2e-webhook-secret'
  ok(`Gateway ${gw.url}、平台 webhook ${hookUrl}`)

  const { EdgeAgent } = await import('../edge/simulator/src/agent')
  const { waitUntil } = await import('../edge/simulator/src/harness')
  let agent: InstanceType<typeof EdgeAgent> | null = null
  try {
    step('1. 平台組出場館計畫並推送')
    const { pushSitePlan } = await import('@/server/iot/sync')
    const first = await pushSitePlan(venue.id)
    assert.ok(first?.changed && first.rev === 1, `第一次推送應建立 rev 1：${JSON.stringify(first)}`)
    const again = await pushSitePlan(venue.id)
    assert.equal(again?.changed, false, '內容沒變不應遞增版本')
    ok('推送成功；重推內容相同時不遞增版本')

    step('2. 場館下載計畫')
    const { gateway } = await import('@/server/iot/gateway-client')
    const cred = await gateway.credentials('e2e001')
    agent = new EdgeAgent({ baseUrl: gw.url, siteId: 'e2e001', secret: cred.secret, heartbeatMs: 500, flushMs: 200, tickMs: 500, pollWaitSec: 3 })
    agent.start()
    await waitUntil(() => agent!.planRev === 1, 5_000, '場館下載計畫')
    const plan = agent.plan!
    assert.equal(plan.circuits.length, 16, 'M-7045 16 路（17、18 預留不下發）')
    const a1 = plan.timeline.filter((i) => i.circuit === '01')
    assert.ok(a1.some((i) => Date.parse(i.start) === start.getTime() - 5 * 60_000 && Date.parse(i.end) === end.getTime() + 5 * 60_000), 'A 場燈 19:55–22:05')
    assert.ok(!plan.timeline.some((i) => i.circuit === '03'), 'B 場沒有預約')
    assert.ok(plan.timeline.some((i) => i.circuit === '05' && i.reason === 'BUSINESS_HOURS'), '招牌依營業時間')
    assert.ok(plan.timeline.some((i) => i.circuit === '10' && i.reason === 'NIGHT'), '露營燈夜間時段')
    assert.equal(plan.circuits.find((c) => c.no === '12')?.kind, 'ALWAYS_ON')
    assert.equal(plan.circuits.find((c) => c.no === '09')?.maxOnMinutes, 180, '熱水器安全上限')
    assert.deepEqual(plan.doorCodes.map((c) => c.code), [code], '門禁密碼下發')
    ok(`計畫 rev ${plan.rev}：${plan.timeline.length} 段時段、${plan.doorCodes.length} 組密碼`)

    step('3. 後台手動開 B 場燈 30 分鐘')
    const { sendManualCircuitCommand } = await import('@/server/circuit-control')
    const key = `e2e-${Date.now()}`
    const cmd = await sendManualCircuitCommand({ circuitNumber: '03', targetState: 'ON', reason: 'E2E 測試', idempotencyKey: key, actor: 'e2e', hold: { mode: 'MINUTES', minutes: 30 } })
    assert.equal(cmd.status, 'SENT')
    await waitUntil(() => agent!.hw.relays[3] === 'ON', 5_000, '場館 B 燈開啟')
    await waitUntil(async () => (await prisma.controlCommand.findUnique({ where: { commandId: key } }))?.status === 'ACKED', 10_000, 'ControlCommand 變成 ACKED')
    await waitUntil(async () => (await prisma.circuit.findFirst({ where: { venueId: venue.id, circuitNumber: '03' } }))?.actualState === 'ON', 10_000, 'Circuit.actualState = ON')
    ok('SENT → 場館執行 → webhook → ACKED，實際狀態 ON')

    step('4. 場館輸入密碼開門')
    assert.equal(agent.enterCode(code), true)
    await waitUntil(async () => (await prisma.auditLog.count({ where: { action: 'DOOR_CODE_OK' } })) === 1, 10_000, 'AuditLog DOOR_CODE_OK')
    const log = await prisma.auditLog.findFirst({ where: { action: 'DOOR_CODE_OK' } })
    assert.ok(!JSON.stringify(log?.detail).includes(code), '稽核紀錄不含明碼')
    ok('開門事件寫入稽核紀錄（不含明碼）')

    step('5. 後台調閱場館 log')
    const { edgeSitesFor, parseLogRequest, requestEdgeLogs } = await import('@/server/iot/edge-logs')
    const admin = { tenant: 'main', venueId: null, username: 'e2e' } as any
    const sites = await edgeSitesFor(admin)
    assert.deepEqual(sites.map((s) => s.siteCode), ['e2e001'], '可調閱的場館')
    const nowIso = new Date().toISOString()
    const req = parseLogRequest({ files: ['edge', 'audit'], from: new Date(Date.now() - 3600_000).toISOString(), to: nowIso })
    assert.throws(() => parseLogRequest({ files: ['edge'], from: nowIso, to: new Date(Date.now() - 1000).toISOString() }), /早於/)
    const logReq = await requestEdgeLogs(admin, sites[0], req)
    await waitUntil(async () => (await gateway.logs('e2e001')).logs.find((l) => l.id === logReq.id)?.status === 'ACKED', 10_000, '場館上傳 log')
    const audit = await (await gateway.logFile('e2e001', logReq.id, 'audit')).text()
    assert.ok(audit.includes('door.code_ok') && !audit.includes(code), 'audit.log 有開門紀錄、不含明碼')
    await waitUntil(async () => (await prisma.auditLog.count({ where: { action: 'IOT_LOG_UPLOADED' } })) === 1, 10_000, 'AuditLog IOT_LOG_UPLOADED')
    assert.equal(await prisma.auditLog.count({ where: { action: 'IOT_LOG_REQUESTED', actor: 'admin:e2e' } }), 1)
    ok(`調閱 → 場館上傳 ${audit.split('\n').filter(Boolean).length} 行 audit.log → 平台可下載、稽核有紀錄`)

    step('6. 場館電腦離線')
    agent.setOffline(true)
    await waitUntil(async () => (await prisma.controlEvent.count({ where: { eventType: 'DEVICE_OFFLINE' } })) > 0, 15_000, 'ControlEvent DEVICE_OFFLINE')
    ok('平台收到離線通知')

    console.log('\n全部通過')
  } finally {
    await agent?.stop()
    await gw.close()
    await new Promise((r) => hook.close(() => r(null)))
    ;(hook as any).closeAllConnections?.()
    await prisma.$disconnect()
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {
      console.log(`  （Windows 仍鎖著暫存資料庫，請稍後自行刪除：${dir}）`)
    }
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('\n✘', e instanceof Error ? e.message : e)
    process.exit(1)
  },
)
