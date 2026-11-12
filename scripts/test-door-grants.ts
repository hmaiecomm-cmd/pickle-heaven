/**
 * 門禁授權邏輯驗證（只在開發資料庫執行；測試資料在結束時全部刪除）
 *   npm run verify:door
 */
import { prisma } from '../src/lib/db'
import { can } from '../src/lib/admin-permissions'
import {
  ACCESS_BUFFER_AFTER_MINUTES,
  ACCESS_BUFFER_BEFORE_MINUTES,
  DoorGrantError,
  createManualGrant,
  grantPhase,
  revokeGrant,
  syncGrantForBooking,
} from '../src/server/door-access-grants'

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
async function expectError(name: string, fn: () => Promise<unknown>, msg: RegExp) {
  try {
    await fn()
    check(name, false, '沒有擋下')
  } catch (e) {
    check(name, e instanceof DoorGrantError && msg.test(e.message), e instanceof Error ? e.message : String(e))
  }
}

const tag = `doortest-${Date.now()}`
const created = { users: [] as string[], bookings: [] as string[], restrictions: [] as string[] }

async function makeBooking(userId: string, venueId: string, court: { id: string; name: string }, startOffsetMin: number, hours: number) {
  const start = new Date(Date.now() + startOffsetMin * 60_000)
  start.setSeconds(0, 0)
  const end = new Date(start.getTime() + hours * 3_600_000)
  const b = await prisma.booking.create({
    data: {
      code: `${tag}-${created.bookings.length}`,
      userId,
      venueId,
      playDate: start.toISOString().slice(0, 10),
      subtotal: 500,
      total: 500,
      contactName: '測試',
      contactPhone: '0900000000',
      status: 'PAID',
      paidAt: new Date(),
      items: { create: { courtId: court.id, courtName: court.name, startsAt: start, endsAt: end, price: 500, rateName: '測試' } },
    },
  })
  created.bookings.push(b.id)
  return { booking: b, start, end }
}

async function main() {
  const venue = await prisma.venue.findFirst({ where: { active: true }, select: { id: true } })
  const court = await prisma.court.findFirst({ select: { id: true, name: true } })
  if (!venue || !court) throw new Error('開發資料庫缺少場館或場地')

  const user = await prisma.user.create({ data: { displayName: `${tag}-會員`, phone: '0911222333' } })
  created.users.push(user.id)

  console.log('── 預約自動授權')
  const { booking, start, end } = await makeBooking(user.id, venue.id, court, 120, 2)
  check('付款訂單同步 → 建立授權', (await syncGrantForBooking(booking.id)) === 'created')
  let g = await prisma.doorAccessGrant.findUnique({ where: { bookingId: booking.id } })
  check(
    `期間 = 開始前 ${ACCESS_BUFFER_BEFORE_MINUTES} 分 ～ 結束後 ${ACCESS_BUFFER_AFTER_MINUTES} 分`,
    !!g && g.validFrom.getTime() === start.getTime() - ACCESS_BUFFER_BEFORE_MINUTES * 60_000 && g.validUntil.getTime() === end.getTime() + ACCESS_BUFFER_AFTER_MINUTES * 60_000,
  )
  check('授權對象為訂單會員', g?.userId === user.id && g?.holderName === user.displayName)
  check('尚未到時間 → 狀態「尚未生效」', !!g && grantPhase(g) === 'UPCOMING')
  check('重複同步 → 不變', (await syncGrantForBooking(booking.id)) === 'unchanged')

  console.log('── 取消與恢復')
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } })
  await prisma.bookingItem.updateMany({ where: { bookingId: booking.id }, data: { status: 'CANCELLED' } })
  check('訂單取消 → 自動撤銷', (await syncGrantForBooking(booking.id)) === 'revoked')
  g = await prisma.doorAccessGrant.findUnique({ where: { bookingId: booking.id } })
  check('撤銷人為系統、原因為訂單取消', g?.revokedBy === 'system' && g?.revokeReason === '訂單已取消／退款')
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'PAID' } })
  await prisma.bookingItem.updateMany({ where: { bookingId: booking.id }, data: { status: 'ACTIVE' } })
  check('系統撤銷後訂單恢復付款 → 授權恢復', (await syncGrantForBooking(booking.id)) === 'updated')

  console.log('── 管理者撤銷')
  g = await prisma.doorAccessGrant.findUnique({ where: { bookingId: booking.id } })
  await expectError('撤銷未填原因 → 擋下', () => revokeGrant(g!.id, '  ', 'tester'), /原因/)
  await revokeGrant(g!.id, '測試撤銷', 'tester')
  check('管理者撤銷後再同步 → 不自動恢復', (await syncGrantForBooking(booking.id)) === 'unchanged')
  await expectError('重複撤銷 → 擋下', () => revokeGrant(g!.id, '再一次', 'tester'), /已經撤銷/)
  const auditCount = await prisma.auditLog.count({ where: { action: { startsWith: 'DOOR_' }, OR: [{ target: booking.code }, { target: user.displayName }] } })
  check('每次變更都寫入操作紀錄', auditCount >= 4, `${auditCount} 筆`)

  console.log('── 期間隨明細變動')
  const multi = await makeBooking(user.id, venue.id, court, 300, 1)
  const later = new Date(multi.end.getTime() + 3_600_000)
  await prisma.bookingItem.create({ data: { bookingId: multi.booking.id, courtId: court.id, courtName: court.name, startsAt: multi.end, endsAt: later, price: 500, rateName: '測試' } })
  await syncGrantForBooking(multi.booking.id)
  g = await prisma.doorAccessGrant.findUnique({ where: { bookingId: multi.booking.id } })
  check('兩個時段 → 期間涵蓋到最後一個時段', g?.validUntil.getTime() === later.getTime() + ACCESS_BUFFER_AFTER_MINUTES * 60_000)
  await prisma.bookingItem.updateMany({ where: { bookingId: multi.booking.id, startsAt: multi.end }, data: { status: 'CANCELLED' } })
  check('取消其中一個時段 → 期間縮短', (await syncGrantForBooking(multi.booking.id)) === 'updated')

  console.log('── 黑名單')
  const bad = await prisma.user.create({ data: { displayName: `${tag}-黑名單`, phone: '0922333444' } })
  created.users.push(bad.id)
  const r = await prisma.memberRestriction.create({ data: { userId: bad.id, type: 'BLACKLIST', reason: '測試', createdBy: 'tester' } })
  created.restrictions.push(r.id)
  const badBooking = await makeBooking(bad.id, venue.id, court, 120, 1)
  await syncGrantForBooking(badBooking.booking.id)
  check('黑名單會員付款 → 不建立授權', !(await prisma.doorAccessGrant.findUnique({ where: { bookingId: badBooking.booking.id } })))

  console.log('── 手動授權驗證')
  const base = { venueId: venue.id, holderName: `${tag}-清潔`, holderPhone: null, note: null }
  const h = (n: number) => new Date(Date.now() + n * 3_600_000)
  await expectError('結束早於開始 → 擋下', () => createManualGrant({ ...base, validFrom: h(3), validUntil: h(2) }, 'tester'), /晚於/)
  await expectError('結束時間已過 → 擋下', () => createManualGrant({ ...base, validFrom: h(-5), validUntil: h(-1) }, 'tester'), /已經過去/)
  await expectError('超過 366 天 → 擋下', () => createManualGrant({ ...base, validFrom: h(1), validUntil: h(24 * 400) }, 'tester'), /366/)
  await expectError('黑名單會員 → 擋下', () => createManualGrant({ ...base, userId: bad.id, validFrom: h(1), validUntil: h(2) }, 'tester'), /黑名單/)
  await expectError('沒有姓名 → 擋下', () => createManualGrant({ ...base, holderName: ' ', validFrom: h(1), validUntil: h(2) }, 'tester'), /姓名/)
  const m = await createManualGrant({ ...base, validFrom: h(-1), validUntil: h(2) }, 'tester')
  check('非會員手動授權成功、目前有效', m.source === 'MANUAL' && m.userId === null && grantPhase(m) === 'ACTIVE')
  const mm = await createManualGrant({ ...base, holderName: '', userId: user.id, validFrom: h(1), validUntil: h(2) }, 'tester')
  check('會員手動授權 → 自動帶入會員姓名', mm.holderName === user.displayName && mm.userId === user.id)

  console.log('── 權限（後端檢查）')
  check('擁有者、管理員可以建立與撤銷門禁授權', can('OWNER', 'access.grant') && can('MANAGER', 'access.grant'))
  check('營運人員、只讀人員可以查看門禁但不能授權', can('OPERATOR', 'access') && can('VIEWER', 'access') && !can('OPERATOR', 'access.grant') && !can('VIEWER', 'access.grant'))
  check('櫃台人員看不到門禁', !can('FRONTDESK', 'access') && !can('FRONTDESK', 'access.grant'))
}

main()
  .catch((e) => {
    failed++
    console.error('❌ 執行錯誤', e)
  })
  .finally(async () => {
    const grants = await prisma.doorAccessGrant.deleteMany({ where: { OR: [{ bookingId: { in: created.bookings } }, { holderName: { startsWith: tag } }, { userId: { in: created.users } }] } })
    await prisma.auditLog.deleteMany({ where: { action: { startsWith: 'DOOR_' }, OR: [{ target: { startsWith: tag } }, { actor: 'tester' }] } })
    await prisma.bookingItem.deleteMany({ where: { bookingId: { in: created.bookings } } })
    await prisma.booking.deleteMany({ where: { id: { in: created.bookings } } })
    await prisma.memberRestriction.deleteMany({ where: { id: { in: created.restrictions } } })
    await prisma.user.deleteMany({ where: { id: { in: created.users } } })
    console.log(`\n清除測試資料：授權 ${grants.count} 筆、訂單 ${created.bookings.length} 筆、會員 ${created.users.length} 位`)
    console.log(`結果：${passed} 通過，${failed} 失敗`)
    process.exit(failed ? 1 : 0)
  })
