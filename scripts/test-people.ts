/**
 * 人員管理驗收測試（直接呼叫後端服務，對開發資料庫執行）。
 *
 *   npx tsx -r ./scripts/stub-server-only.cjs --env-file=.env scripts/test-people.ts
 *
 * 建立 TEST_people_ 開頭的會員與測試資料，結束時全部刪除。不要對正式庫執行。
 */
import { prisma } from '../src/lib/db'
import { isUniqueViolation } from '../src/server/occupancy'
import { adminAdjustPoints, PointsError } from '../src/server/points-ledger'
import { assertNotRestricted, RestrictedError } from '../src/server/member-restrictions'
import { assertBookingPayable, BookingError } from '../src/server/booking-service'
import { getMemberDetail, listPeople } from '../src/server/people-admin'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const SUB = 'TEST_people_google_sub'
const stamp = Date.now().toString(36)

async function main() {
  await cleanup()
  const venue = await prisma.venue.findFirstOrThrow({ select: { id: true } })

  // 1. 首次登入建立會員；同一 Google 帳號不重複建立（googleSub 唯一）
  const user = await prisma.user.create({ data: { displayName: 'TEST_people_會員', googleSub: SUB, email: 'test-people@example.com', lastLoginAt: new Date() } })
  let dup = false
  try {
    await prisma.user.create({ data: { displayName: 'TEST_people_重複', googleSub: SUB } })
  } catch (err) {
    dup = isUniqueViolation(err)
  }
  check('同一 Google 帳號不會建立第二個會員', dup)
  const again = await prisma.user.findUnique({ where: { googleSub: SUB } })
  check('再次登入以 googleSub 找到同一位會員', again?.id === user.id)

  // 2. 點數帳本：加點、同鍵重送不重複、扣超過餘額失敗且餘額不變
  const k1 = `test:${stamp}:add`
  const a = await adminAdjustPoints({ userId: user.id, delta: 50, reason: '測試加點', actor: 'admin:test', idempotencyKey: k1 })
  check('加 50 點：前 0 → 後 50', a.balanceBefore === 0 && a.balanceAfter === 50 && !a.duplicate)
  const b = await adminAdjustPoints({ userId: user.id, delta: 50, reason: '測試加點', actor: 'admin:test', idempotencyKey: k1 })
  const bal1 = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).points
  check('同一 idempotencyKey 重送：標記重複、餘額仍 50', b.duplicate && bal1 === 50)
  let neg = false
  try {
    await adminAdjustPoints({ userId: user.id, delta: -80, reason: '測試扣點', actor: 'admin:test', idempotencyKey: `test:${stamp}:deduct` })
  } catch (err) {
    neg = err instanceof PointsError
  }
  const bal2 = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).points
  const ledger = await prisma.pointsLedger.findMany({ where: { userId: user.id } })
  check('扣 80 點被拒（餘額不足）、餘額仍 50、帳本僅 1 筆', neg && bal2 === 50 && ledger.length === 1 && ledger[0].balanceAfter === 50)
  const c = await adminAdjustPoints({ userId: user.id, delta: -20, reason: '測試扣點', actor: 'admin:test', idempotencyKey: `test:${stamp}:deduct2` })
  check('扣 20 點：前 50 → 後 30', c.balanceBefore === 50 && c.balanceAfter === 30)

  // 3. 黑名單：擋新預約／舊訂單付款；解除後恢復
  const booking = await prisma.booking.create({
    data: { code: `TESTP${stamp.toUpperCase().slice(-5)}`, userId: user.id, venueId: venue.id, playDate: '2030-01-01', subtotal: 100, total: 100, contactName: 'T', contactPhone: '0900000000', status: 'PENDING', expiresAt: new Date(Date.now() + 600_000) },
  })
  await assertBookingPayable(booking.id)
  check('未受限時待付款訂單可付款', true)
  const restriction = await prisma.memberRestriction.create({ data: { userId: user.id, type: 'BLACKLIST', reason: '測試黑名單', internalNote: '內部備註', createdBy: 'admin:test' } })
  let blocked = false
  try {
    await assertNotRestricted(user.id, 'BOOKING')
  } catch (err) {
    blocked = err instanceof RestrictedError
  }
  check('黑名單後 assertNotRestricted(BOOKING) 拒絕', blocked)
  let payBlocked: string | null = null
  try {
    await assertBookingPayable(booking.id)
  } catch (err) {
    payBlocked = err instanceof BookingError ? err.code : 'other'
  }
  check('黑名單後既有待付款訂單不能付款（舊 session／購物車同樣生效）', payBlocked === 'UNAUTHORIZED', String(payBlocked))
  const paidBefore = await prisma.booking.count({ where: { userId: user.id } })
  check('黑名單不刪除會員既有訂單', paidBefore === 1)
  const list = await listPeople({ tab: 'blacklist', q: 'TEST_people', role: '', status: '', sort: 'joined', page: 1 })
  check('人員列表「黑名單」分頁列出此會員並顯示受限', list.rows.some((r) => r.id === user.id && r.status === 'restricted'))
  const detail1 = await getMemberDetail(user.id)
  check('會員詳情標示受限並帶出內部備註', detail1?.user.restricted === true && detail1.user.blacklist?.internalNote === '內部備註')

  await prisma.memberRestriction.update({ where: { id: restriction.id }, data: { revokedAt: new Date(), revokedBy: 'admin:test', revokeReason: '測試解除' } })
  await assertNotRestricted(user.id, 'BOOKING')
  await assertBookingPayable(booking.id)
  const list2 = await listPeople({ tab: 'blacklist', q: 'TEST_people', role: '', status: '', sort: 'joined', page: 1 })
  check('解除後可再付款與預約、黑名單分頁不再列出', !list2.rows.some((r) => r.id === user.id))

  // 4. 使用券：發放紀錄與前台同步資料
  await prisma.voucher.create({ data: { code: `TPV${stamp.toUpperCase().slice(-6)}`, title: '離峰券 2 小時', type: 'AMOUNT', value: 0, userId: user.id, ticketKind: 'OFFPEAK', units: 2, courtIds: '', issuedBy: 'admin:test', issueReason: '[issue:test] 測試發券' } })
  const detail2 = await getMemberDetail(user.id)
  const v = detail2?.vouchers[0]
  check('票券以離峰券／時數／可使用呈現', v?.kind === '離峰券' && v.units === 2 && v.state === '可使用' && v.courts === '全部場地')
  check('點數帳本在詳情頁含 3 筆（加、拒絕不記、扣）', detail2?.ledger.length === 2 && detail2.ledger[0].balanceAfter === 30)

  // 5. 搜尋與篩選
  const byMail = await listPeople({ tab: 'all', q: 'test-people@example', role: '', status: '', sort: 'joined', page: 1 })
  check('以 Email 搜尋找到會員', byMail.rows.some((r) => r.id === user.id))
  const coachList = await listPeople({ tab: 'coaches', q: 'TEST_people', role: '', status: '', sort: 'joined', page: 1 })
  check('未標記教練時不出現在教練分頁', !coachList.rows.some((r) => r.id === user.id))
  await prisma.user.update({ where: { id: user.id }, data: { isCoach: true } })
  const coachList2 = await listPeople({ tab: 'coaches', q: 'TEST_people', role: '', status: '', sort: 'joined', page: 1 })
  check('標記教練後出現在教練分頁且角色含教練', coachList2.rows.some((r) => r.id === user.id && r.roles.includes('教練')))
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { OR: [{ googleSub: SUB }, { displayName: { startsWith: 'TEST_people_' } }] }, select: { id: true } })
  const ids = users.map((u) => u.id)
  if (ids.length === 0) return
  await prisma.pointsLedger.deleteMany({ where: { userId: { in: ids } } })
  await prisma.voucher.deleteMany({ where: { userId: { in: ids } } })
  await prisma.memberRestriction.deleteMany({ where: { userId: { in: ids } } })
  await prisma.booking.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
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
