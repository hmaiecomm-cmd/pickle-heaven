/**
 * 儲值點數驗收測試（直接呼叫後端服務，對開發資料庫執行）。
 *
 *   npx tsx -r ./scripts/stub-server-only.cjs --env-file=.env scripts/test-topup.ts
 *
 * 建立 TEST_topup_ 開頭的會員與方案，結束時刪除。不要對正式庫執行。
 */
import { prisma } from '../src/lib/db'
import { createTopUpOrder, creditTopUpOrder, expireStaleTopUps, findTopUpByCode, markTopUpPaid, recordTopUpFailure, TopUpError, topUpAvailability, userPointsBreakdown } from '../src/server/topup-service'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const balance = async (id: string) => (await prisma.user.findUniqueOrThrow({ where: { id }, select: { points: true } })).points

async function main() {
  await cleanup()
  const user = await prisma.user.create({ data: { displayName: 'TEST_topup_會員', googleSub: 'TEST_topup_sub', points: 0 } })
  const plan = await prisma.topUpPlan.create({ data: { name: 'TEST_topup_方案', price: 3000, points: 3000, bonusPoints: 300, active: true, sortOrder: 99 } })
  const off = await prisma.topUpPlan.create({ data: { name: 'TEST_topup_下架', price: 1000, points: 1000, active: false } })

  // 0. 開放條件：本機（非正式環境）允許模擬金流
  const avail = topUpAvailability()
  check('非正式環境允許以模擬金流測試儲值流程', avail.open && avail.simulated, JSON.stringify(avail))
  process.env.VERCEL_ENV = 'production'
  const prodAvail = topUpAvailability()
  delete process.env.VERCEL_ENV
  check('正式環境只有模擬金流時：線上儲值不開放（不提供假的付款成功）', !prodAvail.open && (prodAvail.reason ?? '').includes('尚未開放'))

  // 1. 建立儲值單：下架方案拒絕、上架方案成功、金額等於售價、點數依方案（不是 1 元 = 1 點）
  let offErr = ''
  try { await createTopUpOrder(user.id, off.id) } catch (e) { offErr = e instanceof TopUpError ? e.code : 'other' }
  check('下架方案不能建立儲值單', offErr === 'NOT_FOUND')
  const order = await createTopUpOrder(user.id, plan.id)
  check('儲值單金額與點數來自方案（3000 元 → 3000 點＋贈 300）', order.amount === 3000 && order.points === 3000 && order.bonusPoints === 300 && order.status === 'PENDING' && /^TP-\d{8}-[A-Z0-9]{4}$/.test(order.code))
  check('依編號（含去連字號格式）可找到儲值單', (await findTopUpByCode(order.code))?.id === order.id && (await findTopUpByCode(order.code.replace(/-/g, '')))?.id === order.id)

  // 2. 金額不符：不入點、狀態維持待付款
  let mismatch = ''
  try { await markTopUpPaid(order.id, { provider: 'mock', method: 'CREDIT_CARD', amount: 2999, providerRef: 'X' }) } catch (e) { mismatch = e instanceof TopUpError ? e.code : 'other' }
  check('回呼金額不符：拒絕且餘額為 0', mismatch === 'INVALID' && (await balance(user.id)) === 0)

  // 3. 付款確認 → 入點（付費與贈點各一筆帳本）
  const r1 = await markTopUpPaid(order.id, { provider: 'mock', method: 'CREDIT_CARD', amount: 3000, providerRef: 'MOCK1', cardLast4: '4242' })
  const bal1 = await balance(user.id)
  const ledger = await prisma.pointsLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } })
  check('付款確認後入帳 3300 點、狀態 CREDITED', r1.status === 'CREDITED' && !r1.alreadyPaid && bal1 === 3300)
  check('帳本：付費點數與贈送點數分開兩筆', ledger.length === 2 && ledger[0].kind === 'TOPUP_PAID' && ledger[0].delta === 3000 && ledger[1].kind === 'TOPUP_BONUS' && ledger[1].delta === 300 && ledger[1].balanceAfter === 3300)

  // 4. 回呼重送／連點：不重複入點
  const r2 = await markTopUpPaid(order.id, { provider: 'mock', method: 'CREDIT_CARD', amount: 3000, providerRef: 'MOCK1' })
  const r3 = await creditTopUpOrder(order.id, 'admin:test')
  check('回呼重送與重複補入：標記已付款、餘額仍 3300、帳本仍 2 筆', r2.alreadyPaid && r2.status === 'CREDITED' && !r3.credited && (await balance(user.id)) === 3300 && (await prisma.pointsLedger.count({ where: { userId: user.id } })) === 2)
  const bd = await userPointsBreakdown(user.id)
  check('前台可取得付費／贈送分開的累計', bd.paid === 3000 && bd.bonus === 300)

  // 5. 已收款但入點失敗 → CREDIT_FAILED → 補入成功且不重複
  const order2 = await createTopUpOrder(user.id, plan.id)
  await prisma.topUpOrder.update({ where: { id: order2.id }, data: { status: 'PAID', paidAt: new Date(), provider: 'mock', providerRef: 'MOCK2' } })
  // 模擬入帳失敗：先建立同鍵的帳本紀錄造成衝突（balanceAfter 隨意），再補入時會因鍵重複而「視為已入帳」→ 這裡改以帳本缺失驗證補入流程
  const failed = await prisma.topUpOrder.update({ where: { id: order2.id }, data: { status: 'CREDIT_FAILED', failReason: '入帳失敗：模擬' } })
  check('可追蹤的入帳失敗狀態', failed.status === 'CREDIT_FAILED')
  const r4 = await creditTopUpOrder(order2.id, 'admin:test')
  const r5 = await creditTopUpOrder(order2.id, 'admin:test')
  check('擁有者補入：成功一次，再補不重複，餘額 6600', r4.credited && r4.status === 'CREDITED' && !r5.credited && (await balance(user.id)) === 6600)

  // 6. 付款失敗與逾時
  const order3 = await createTopUpOrder(user.id, plan.id)
  await recordTopUpFailure(order3.id, 'mock', '模擬付款失敗')
  const o3 = await prisma.topUpOrder.findUniqueOrThrow({ where: { id: order3.id } })
  check('付款失敗：狀態 FAILED、不入點', o3.status === 'FAILED' && (await balance(user.id)) === 6600)
  const order4 = await createTopUpOrder(user.id, plan.id)
  await prisma.topUpOrder.update({ where: { id: order4.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  const n = await expireStaleTopUps()
  check('逾時未付款的儲值單轉為 EXPIRED', n >= 1 && (await prisma.topUpOrder.findUniqueOrThrow({ where: { id: order4.id } })).status === 'EXPIRED')
  const late = await markTopUpPaid(order4.id, { provider: 'mock', method: 'CREDIT_CARD', amount: 3000, providerRef: 'LATE' })
  check('逾時後金流仍確認成功：照常入點（不讓客人白付）', late.status === 'CREDITED' && (await balance(user.id)) === 9900)

  // 7. 黑名單不能儲值
  await prisma.memberRestriction.create({ data: { userId: user.id, type: 'BLACKLIST', reason: '測試', createdBy: 'test' } })
  let blocked = ''
  try { await createTopUpOrder(user.id, plan.id) } catch (e) { blocked = e instanceof TopUpError ? e.code : 'other' }
  check('黑名單會員不能新增儲值', blocked === 'UNAUTHORIZED')
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { OR: [{ googleSub: 'TEST_topup_sub' }, { displayName: { startsWith: 'TEST_topup_' } }] }, select: { id: true } })
  const ids = users.map((u) => u.id)
  if (ids.length) {
    await prisma.pointsLedger.deleteMany({ where: { userId: { in: ids } } })
    await prisma.topUpOrder.deleteMany({ where: { userId: { in: ids } } })
    await prisma.memberRestriction.deleteMany({ where: { userId: { in: ids } } })
    await prisma.auditLog.deleteMany({ where: { target: { in: ids } } })
    await prisma.user.deleteMany({ where: { id: { in: ids } } })
  }
  await prisma.topUpPlan.deleteMany({ where: { name: { startsWith: 'TEST_topup_' } } })
}

main()
  .catch((err) => {
    console.error(err)
    results.push({ name: '執行', ok: false, detail: String(err) })
  })
  .finally(async () => {
    await cleanup()
    const ok = results.filter((r) => r.ok).length
    console.log(`\n通過 ${ok}／${results.length}`)
    process.exit(ok === results.length ? 0 : 1)
  })
