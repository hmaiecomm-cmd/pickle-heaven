/**
 * 財務指標一致性與對帳驗證（只在開發資料庫執行；測試資料在結束時全部刪除）
 *   npm run verify:finance
 */
import { prisma } from '../src/lib/db'
import { taipeiDateString } from '../src/lib/time'
import { allocateCollected, collectedBookings, collectedOf, dailySeries, financeTotals, revenueByCourt } from '../src/server/finance-metrics'
import { dailyClose, reconcileIssues } from '../src/server/finance-reconcile'
import { overview, todayPeriod } from '../src/app/admin/reports/report-data'

if (!/^libsql:\/\/pickle-heaven-dev-/.test(process.env.TURSO_DATABASE_URL ?? '')) {
  console.error('中止：只能在開發資料庫執行')
  process.exit(1)
}

let passed = 0
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  if (ok) passed++
  else failed++
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? `（${extra}）` : ''}`)
}

const tag = `fintest-${Date.now()}`
const ids = { users: [] as string[], bookings: [] as string[], topups: [] as string[] }

async function main() {
  const venue = await prisma.venue.findFirst({ where: { active: true }, select: { id: true } })
  const court = await prisma.court.findFirst({ select: { id: true, name: true } })
  if (!venue || !court) throw new Error('開發資料庫缺少場館或場地')
  const today = taipeiDateString()
  const period = todayPeriod()
  const before = await financeTotals(period)
  const beforeIssues = new Map((await reconcileIssues()).map((g) => [g.key, g.items.length]))

  const user = await prisma.user.create({ data: { displayName: `${tag}-會員` } })
  ids.users.push(user.id)
  const at = new Date()

  type Spec = { status: 'PAID' | 'CANCELLED' | 'REFUND_PENDING'; total: number; pay?: { amount: number; status: 'SUCCESS' | 'REFUNDED' }; refund?: { cash: number; status: string }; noItems?: boolean }
  const make = async (label: string, s: Spec) => {
    const b = await prisma.booking.create({
      data: {
        code: `${tag}-${label}`,
        userId: user.id,
        venueId: venue.id,
        playDate: today,
        subtotal: s.total,
        total: s.total,
        contactName: '測試',
        contactPhone: '0900000000',
        status: s.status,
        paidAt: at,
        ...(s.noItems ? {} : { items: { create: { courtId: court.id, courtName: court.name, startsAt: at, endsAt: new Date(at.getTime() + 3_600_000), price: s.total, rateName: '測試' } } }),
      },
    })
    ids.bookings.push(b.id)
    if (s.pay) await prisma.payment.create({ data: { bookingId: b.id, provider: 'mock', amount: s.pay.amount, status: s.pay.status, paidAt: at } })
    if (s.refund)
      await prisma.refund.create({
        data: { bookingId: b.id, idempotencyKey: `${tag}-${label}`, status: s.refund.status, method: 'ORIGINAL', cashAmount: s.refund.cash, pointsAmount: 0, reason: '測試', cancelItems: false, createdBy: 'tester', completedAt: ['SUCCEEDED', 'MANUAL_DONE'].includes(s.refund.status) ? at : null },
      })
    return b
  }

  // A 正常付款 600；B 付款後取消並全額退款 400；C 付款 300 部分退款 100；
  // D 待退款 250；E 已付款但沒有付款紀錄 500；F 已取消有收款沒退款 200；G 實付與應付不符（應 700 付 650）
  await make('A', { status: 'PAID', total: 600, pay: { amount: 600, status: 'SUCCESS' } })
  await make('B', { status: 'CANCELLED', total: 400, pay: { amount: 400, status: 'REFUNDED' }, refund: { cash: 400, status: 'SUCCEEDED' } })
  await make('C', { status: 'PAID', total: 300, pay: { amount: 300, status: 'SUCCESS' }, refund: { cash: 100, status: 'MANUAL_DONE' } })
  await make('D', { status: 'REFUND_PENDING', total: 250, pay: { amount: 250, status: 'SUCCESS' } })
  await make('E', { status: 'PAID', total: 500 })
  await make('F', { status: 'CANCELLED', total: 200, pay: { amount: 200, status: 'SUCCESS' } })
  await make('G', { status: 'PAID', total: 700, pay: { amount: 650, status: 'SUCCESS' } })
  // H 待退款、時段已釋放（沒有任何明細）150
  await make('H', { status: 'REFUND_PENDING', total: 150, pay: { amount: 150, status: 'SUCCESS' }, noItems: true })

  const plan = await prisma.topUpPlan.findFirst({ select: { id: true, name: true } })
  if (plan) {
    const tp = await prisma.topUpOrder.create({ data: { code: `${tag}-T`, userId: user.id, planId: plan.id, planName: plan.name, amount: 1000, points: 1100, status: 'CREDITED', paidAt: at } })
    ids.topups.push(tp.id)
  }

  const after = await financeTotals(period)
  const d = (k: 'collected' | 'refunded' | 'net' | 'orders' | 'topup') => after[k] - before[k]

  console.log('── 指標定義')
  check('實收 = 成功付款加總（A600+B400+C300+D250+F200+G650+H150）', d('collected') === 2550, `${d('collected')}`)
  check('退款 = 已完成現金退款（B400+C100）', d('refunded') === 500, `${d('refunded')}`)
  check('淨實收 = 實收 − 退款', d('net') === 2050, `${d('net')}`)
  check('成立訂單 = 期間內付款的訂單數（8 筆）', d('orders') === 8, `${d('orders')}`)
  if (plan) check('儲值實收另列（1000），不併入實收', d('topup') === 1000, `${d('topup')}`)
  else console.log('⏭️ 開發庫沒有儲值方案，略過儲值測試')

  console.log('── 各頁數字一致')
  const series = await dailySeries(period.from, period.to, period)
  check('營運總覽趨勢圖加總 = 實收', series.reduce((s, x) => s + x.collected, 0) === after.collected)
  check('趨勢圖退款加總 = 退款', series.reduce((s, x) => s + x.refunded, 0) === after.refunded)
  check('趨勢圖訂單數加總 = 成立訂單', series.reduce((s, x) => s + x.orders, 0) === after.orders)
  const close = await dailyClose(today)
  check('日結實收 = 營運總覽實收', close.totals.collected === after.collected)
  check('日結各管道加總 = 日結實收', close.byChannel.reduce((s, c) => s + c.amount, 0) === close.totals.collected)
  const rows = await collectedBookings(period)
  check('收入與退款明細加總 = 實收', rows.reduce((s, b) => s + collectedOf(b), 0) === after.collected)
  const lines = rows.flatMap((b) => allocateCollected(b))
  check('明細分攤後加總 = 實收（含無明細訂單）', lines.reduce((s, l) => s + l.amount, 0) === after.collected)
  check('無明細訂單列為「無明細」一行', lines.some((l) => l.label.startsWith('無明細') && l.amount === 150))
  const o = await overview(period)
  check('營運概況卡片 = 統一算法', o.collected === after.collected && o.refunded === after.refunded)
  const byCourt = await revenueByCourt(period)
  check('各場地收益加總 = 實收（與「依球場」同一算法）', byCourt.reduce((s, c) => s + c.amount, 0) === after.collected)

  console.log('── 對帳')
  const issues = new Map((await reconcileIssues()).map((g) => [g.key, g.items]))
  const has = (key: string, label: string) => (issues.get(key) ?? []).some((i) => i.code === `${tag}-${label}`)
  check('D 列入「待退款」', has('refund-pending', 'D'))
  check('H 列入「待退款」', has('refund-pending', 'H'))
  check('E 列入「已付款但無付款紀錄」', has('paid-no-payment', 'E'))
  check('F 列入「已取消有收款沒退款」', has('cancelled-not-refunded', 'F'))
  check('G 列入「金額不符」', has('amount-mismatch', 'G'))
  check('A、B、C 正常，不在任何對帳清單', !['A', 'B', 'C'].some((l) => [...issues.keys()].some((k) => has(k, l))))
  const extra = [...issues].reduce((s, [k, v]) => s + v.length - (beforeIssues.get(k) ?? 0), 0)
  check('對帳新增項目剛好 5 筆', extra === 5, `${extra}`)
}

main()
  .catch((e) => {
    failed++
    console.error('❌ 執行錯誤', e)
  })
  .finally(async () => {
    await prisma.refund.deleteMany({ where: { bookingId: { in: ids.bookings } } })
    await prisma.payment.deleteMany({ where: { bookingId: { in: ids.bookings } } })
    await prisma.bookingItem.deleteMany({ where: { bookingId: { in: ids.bookings } } })
    await prisma.booking.deleteMany({ where: { id: { in: ids.bookings } } })
    await prisma.topUpOrder.deleteMany({ where: { id: { in: ids.topups } } })
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } })
    console.log(`\n清除測試資料：訂單 ${ids.bookings.length} 筆、儲值 ${ids.topups.length} 筆、會員 ${ids.users.length} 位`)
    console.log(`結果：${passed} 通過，${failed} 失敗`)
    process.exit(failed ? 1 : 0)
  })
