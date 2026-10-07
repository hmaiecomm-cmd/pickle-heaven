/**
 * 活動 × 場地預約整合的驗收測試（直接呼叫後端服務，對開發資料庫執行）。
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/test-activities.ts
 *
 * 會建立以「【自動測試】」開頭的活動、TEST_ 開頭的會員與測試訂單，結束時全部刪除。
 * 不要對正式庫執行。
 */
import sharp from 'sharp'
import { prisma } from '../src/lib/db'
import { addDays, taipeiDateString, taipeiToUtc, taipeiWeekday } from '../src/lib/time'
import { getAvailability, releaseExpiredHolds, getCart } from '../src/lib/availability'
import { saveActivity, previewActivity, applySessionEdit, cancelActivitySession } from '../src/server/activity-admin'
import { holdSeats, getSessionsForDate, getSessionDTO, seatsUsed, SignupError } from '../src/server/activity-service'
import {
  holdSlot,
  BookingError,
  createPendingBooking,
  markBookingPaid,
  expireStaleBookings,
  assertBookingPayable,
} from '../src/server/booking-service'
import { storeImage } from '../src/server/media'

const TAG = '【自動測試】'
const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}
async function expectError<T>(fn: () => Promise<T>): Promise<Error | null> {
  try {
    await fn()
    return null
  } catch (err) {
    return err as Error
  }
}

async function main() {
  if (!process.env.TURSO_DATABASE_URL?.includes('dev')) throw new Error('只能對開發資料庫執行')
  const venue = await prisma.venue.findFirstOrThrow({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { where: { active: true }, orderBy: { sortOrder: 'asc' } } } })
  if (venue.courts.length < 2) throw new Error('至少需要兩面啟用中的場地')
  const [c1, c2] = venue.courts
  const today = taipeiDateString()
  const D1 = addDays(today, 5)
  const D3 = addDays(today, 6)
  const users = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      prisma.user.upsert({ where: { lineUserId: `TEST_ACT_${i}` }, update: {}, create: { lineUserId: `TEST_ACT_${i}`, displayName: `測試球友${i}` } }),
    ),
  )
  const base = {
    type: 'OPEN_PLAY' as const,
    summary: '自動測試用',
    description: null,
    levelLabel: '新手友善',
    requirements: null,
    includes: null,
    refundNote: null,
    coverAssetId: null,
    coverFocusX: 50,
    coverFocusY: 50,
    price: 300,
    priceUnit: 'PER_PERSON' as const,
    capacity: 4,
    maxPerOrder: 4,
    repeatKind: 'ONCE' as const,
    weekdays: [] as number[],
    intervalWeeks: 1,
    seriesEndDate: null,
    occurrenceCount: null,
    skipDates: [] as string[],
    openDaysBefore: 30,
    openMinute: null,
    closeMinutesBefore: 60,
  }
  const actor = 'test:script'

  // 1. 單次活動 → 預約表與當日活動同步出現
  const a1 = await saveActivity({
    input: { ...base, title: `${TAG}單次 Open Play`, startMinute: 19 * 60, endMinute: 21 * 60, seriesStartDate: D1, courtIds: [c1.id, c2.id] },
    mode: 'publish',
    actor,
  })
  const s1 = a1.created[0]?.sessionId
  const avail = await getAvailability(venue.slug, D1, null)
  const row19 = avail.times.findIndex((t) => t.start === 19 * 60)
  const row20 = avail.times.findIndex((t) => t.start === 20 * 60)
  const evCells = [row19, row20].flatMap((r) => [0, 1].map((c) => avail.cellSessions[r]?.[c]))
  check('1. 單次活動同步到預約表（兩面場地、兩小時都標示同一場）', evCells.every((x) => x === s1), `cells=${evCells.join(',')}`)
  check('1. 單次活動同步到當日活動卡', (await getSessionsForDate(venue.id, D1, null)).some((s) => s.id === s1))

  // 2. 每週固定活動：獨立場次、分別報名
  const D2 = addDays(today, 3)
  const a2 = await saveActivity({
    input: { ...base, title: `${TAG}每週交流`, repeatKind: 'WEEKLY', weekdays: [taipeiWeekday(D2)], occurrenceCount: 3, startMinute: 10 * 60, endMinute: 12 * 60, seriesStartDate: D2, courtIds: [c2.id] },
    mode: 'publish',
    actor,
  })
  const ids2 = a2.created.map((c) => c.sessionId)
  const r2a = await holdSeats({ userId: users[0].id, cartToken: 'T-CART-0', sessionId: ids2[0], quantity: 1 })
  const r2b = await holdSeats({ userId: users[0].id, cartToken: 'T-CART-0', sessionId: ids2[1], quantity: 2 })
  const used2 = await seatsUsed(ids2)
  check('2. 每週活動建立 3 個獨立場次', new Set(ids2).size === 3, ids2.length + ' 場')
  check('2. 各場次名額分開計算', used2.get(ids2[0]) === 1 && used2.get(ids2[1]) === 2 && (used2.get(ids2[2]) ?? 0) === 0 && r2a.registrationId !== r2b.registrationId)

  // 3. 多面場地不重複計算名額
  await holdSeats({ userId: users[1].id, cartToken: 'T-CART-1', sessionId: s1, quantity: 2 })
  await holdSeats({ userId: users[2].id, cartToken: 'T-CART-2', sessionId: s1, quantity: 2 })
  const dto1 = await getSessionDTO(s1, null)
  const full = await expectError(() => holdSeats({ userId: users[3].id, cartToken: 'T-CART-3', sessionId: s1, quantity: 1 }))
  check('3. 兩面場地的活動名額只算一份（4 人額滿）', dto1?.remaining === 0 && dto1.capacity === 4 && full instanceof SignupError, `remaining=${dto1?.remaining}`)

  // 4. 活動時段不能被一般訂場買走；其他場地照常
  const taken = await expectError(() => holdSlot('T-CART-9', venue.slug, D1, c1.id, 19 * 60))
  const otherOk = await holdSlot('T-CART-9', venue.slug, D1, c1.id, 17 * 60).then(() => true, () => false)
  check('4. 活動時段一般訂場被後端擋下', taken instanceof BookingError && (taken as BookingError).code === 'SLOT_TAKEN', taken?.message)
  check('4. 未被活動使用的時段仍可預約', otherOk)

  // 5. 衝突場次被阻擋，既有訂單不受覆蓋
  const booked = await prisma.reservation.create({
    data: { courtId: c1.id, startsAt: taipeiToUtc(D3, 10 * 60), endsAt: taipeiToUtc(D3, 11 * 60), status: 'BOOKED', note: TAG },
  })
  const conflictInput = { ...base, title: `${TAG}衝突測試`, startMinute: 10 * 60, endMinute: 12 * 60, seriesStartDate: D3, courtIds: [c1.id] }
  const pv = await previewActivity(conflictInput)
  const blocked = await expectError(() => saveActivity({ input: conflictInput, mode: 'publish', actor }))
  const still = await prisma.reservation.findUnique({ where: { id: booked.id } })
  check('5. 預覽列出衝突日期與原因', pv.rows[0]?.status === 'CONFLICT' && pv.rows[0].conflicts[0]?.reason === '已有場地預約訂單', pv.rows[0]?.conflicts.map((c) => c.reason).join())
  check('5. 未排除衝突不能發布，既有訂單保留', blocked !== null && still?.status === 'BOOKED', blocked?.message)

  // 6. 圖片上傳後列表與詳情都能顯示
  const img = await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 113, g: 60, b: 222 } } }).jpeg().toBuffer()
  const asset = await storeImage(new File([new Uint8Array(img)], 'test.jpg', { type: 'image/jpeg' }), actor)
  await prisma.activity.update({ where: { id: a1.activityId }, data: { coverAssetId: asset.id } })
  const withCover = await getSessionDTO(s1, null)
  const listCover = (await getSessionsForDate(venue.id, D1, null)).find((s) => s.id === s1)?.cover
  let served = 'skip'
  try {
    const res = await fetch(`http://localhost:3000${withCover?.cover.thumb}`)
    served = `${res.status} ${res.headers.get('content-type')}`
  } catch {
    served = 'dev server 未啟動'
  }
  check('6. 上傳的封面出現在詳情與列表（縮圖可讀取）', withCover?.cover.src === `/media/${asset.id}` && listCover?.thumb === `/media/${asset.id}?size=thumb`, served)

  // 7. 未到報名時間不能提前購買
  const a7 = await saveActivity({
    input: { ...base, title: `${TAG}尚未開放`, openDaysBefore: 1, startMinute: 14 * 60, endMinute: 15 * 60, seriesStartDate: D1, courtIds: [c2.id] },
    mode: 'publish',
    actor,
  })
  const early = await expectError(() => holdSeats({ userId: users[0].id, cartToken: 'T-CART-0', sessionId: a7.created[0].sessionId, quantity: 1 }))
  check('7. 未開放報名不能加入購物車', early instanceof SignupError && (early as SignupError).code === 'NOT_OPEN', early?.message)

  // 8. 多人搶最後名額不超賣
  const a8 = await saveActivity({
    input: { ...base, title: `${TAG}搶名額`, capacity: 1, startMinute: 16 * 60, endMinute: 17 * 60, seriesStartDate: D3, courtIds: [c2.id] },
    mode: 'publish',
    actor,
  })
  const s8 = a8.created[0].sessionId
  const race = await Promise.allSettled(users.slice(0, 5).map((u, i) => holdSeats({ userId: u.id, cartToken: `T-RACE-${i}`, sessionId: s8, quantity: 1 })))
  const wins = race.filter((r) => r.status === 'fulfilled').length
  check('8. 五人同時搶 1 個名額只有 1 人成功', wins === 1 && (await seatsUsed([s8])).get(s8) === 1, `成功 ${wins} 人`)

  // 9. 暫留到期後釋放名額
  await prisma.sessionRegistration.updateMany({ where: { sessionId: s8, status: 'PENDING' }, data: { holdExpiresAt: new Date(Date.now() - 1000) } })
  const freed = (await seatsUsed([s8])).get(s8) ?? 0
  await releaseExpiredHolds()
  const loser = race.findIndex((r) => r.status === 'rejected')
  const retry = await holdSeats({ userId: users[loser].id, cartToken: `T-RACE-${loser}`, sessionId: s8, quantity: 1 }).then(() => true, () => false)
  const expiredCount = await prisma.sessionRegistration.count({ where: { sessionId: s8, status: 'EXPIRED' } })
  check('9. 暫留逾時即不佔名額，並標記為 EXPIRED 後可由他人報名', freed === 0 && expiredCount === 1 && retry)

  // 10. 修改單場不會改到整個系列
  await applySessionEdit({ sessionId: ids2[1], scope: 'ONE', changes: { price: 450 } }, { confirmAffected: true, actor })
  const prices = await prisma.session.findMany({ where: { id: { in: ids2 } }, orderBy: { startAt: 'asc' }, select: { price: true } })
  check('10. 只改本場：只有第 2 場變成 450', prices.map((p) => p.price).join(',') === '300,450,300', prices.map((p) => p.price).join(','))
  await applySessionEdit({ sessionId: ids2[1], scope: 'FOLLOWING', changes: { capacity: 6 } }, { confirmAffected: true, actor })
  const caps = await prisma.session.findMany({ where: { id: { in: ids2 } }, orderBy: { startAt: 'asc' }, select: { capacity: true } })
  check('10. 本場及後續：第 2、3 場名額改為 6，第 1 場不變', caps.map((c) => c.capacity).join(',') === '4,6,6', caps.map((c) => c.capacity).join(','))

  // 11. 已取消場次不能繼續付款
  const cartToken = 'T-CART-PAY'
  await holdSeats({ userId: users[4].id, cartToken, sessionId: ids2[2], quantity: 1 })
  const pending = await createPendingBooking(users[4].id, cartToken, { contactName: '測試', contactPhone: '0912345678' })
  await cancelActivitySession(ids2[2], '自動測試取消', actor)
  const payBlocked = await expectError(() => assertBookingPayable(pending.bookingId))
  const signupBlocked = await expectError(() => holdSeats({ userId: users[5].id, cartToken: 'T-CART-5', sessionId: ids2[2], quantity: 1 }))
  const occ = await prisma.reservation.count({ where: { sessionId: ids2[2] } })
  const bk = await prisma.booking.findUnique({ where: { id: pending.bookingId } })
  check('11. 取消場次後：待付款訂單取消、不能付款、不能再報名、場地釋放', payBlocked !== null && signupBlocked instanceof SignupError && occ === 0 && bk?.status === 'CANCELLED', `訂單=${bk?.status}`)

  // 額外：重複付款回呼只處理一次；逾時後付款且名額已滿 → 不直接成功
  const cart2 = 'T-CART-DUP'
  await holdSeats({ userId: users[5].id, cartToken: cart2, sessionId: ids2[0], quantity: 1 })
  const b2 = await createPendingBooking(users[5].id, cart2, { contactName: '測試', contactPhone: '0912345678' })
  const info = { provider: 'mock', method: 'CREDIT_CARD' as const, amount: b2.total, providerRef: `MOCK-T-${Date.now()}` }
  const [p1, p2] = await Promise.all([markBookingPaid(b2.bookingId, info), markBookingPaid(b2.bookingId, info)])
  const pays = await prisma.payment.count({ where: { bookingId: b2.bookingId, status: { in: ['SUCCESS', 'REFUNDED'] } } })
  check('付款回呼重送只成立一次、只記一筆收款', pays === 1 && [p1, p2].filter((p) => !p.alreadyPaid).length === 1, `收款 ${pays} 筆`)

  const a12 = await saveActivity({
    input: { ...base, title: `${TAG}逾時付款`, capacity: 1, startMinute: 13 * 60, endMinute: 14 * 60, seriesStartDate: D3, courtIds: [c2.id] },
    mode: 'publish',
    actor,
  })
  const s12 = a12.created[0].sessionId
  await holdSeats({ userId: users[0].id, cartToken: 'T-LATE-0', sessionId: s12, quantity: 1 })
  const late = await createPendingBooking(users[0].id, 'T-LATE-0', { contactName: '測試', contactPhone: '0912345678' })
  await prisma.booking.update({ where: { id: late.bookingId }, data: { expiresAt: new Date(Date.now() - 1000) } })
  await prisma.sessionRegistration.updateMany({ where: { bookingId: late.bookingId }, data: { holdExpiresAt: new Date(Date.now() - 1000) } })
  await expireStaleBookings()
  await holdSeats({ userId: users[1].id, cartToken: 'T-LATE-1', sessionId: s12, quantity: 1 })
  const lateRes = await markBookingPaid(late.bookingId, { provider: 'mock', method: 'CREDIT_CARD', amount: late.total, providerRef: `MOCK-LATE-${Date.now()}` })
  const lateBk = await prisma.booking.findUnique({ where: { id: late.bookingId } })
  check('逾時後才付款且名額已被取走：不成立、自動退款', Boolean(lateRes.conflict) && (lateBk?.status === 'CANCELLED' || lateBk?.status === 'REFUND_PENDING') && ((await seatsUsed([s12])).get(s12) ?? 0) === 1, `${lateRes.conflict}／訂單=${lateBk?.status}`)

  // 購物車同時有場地與活動
  const mixed = await getCart('T-CART-1')
  check('購物車區分活動報名品項（含數量、單價、小計）', mixed.activityItems.length === 1 && mixed.activityItems[0].quantity === 2 && mixed.activityItems[0].amount === 600)
}

async function cleanup() {
  const acts = await prisma.activity.findMany({ where: { title: { startsWith: TAG } }, select: { id: true, coverAssetId: true } })
  const sessions = await prisma.session.findMany({ where: { activityId: { in: acts.map((a) => a.id) } }, select: { id: true } })
  const sids = sessions.map((s) => s.id)
  const users = await prisma.user.findMany({ where: { lineUserId: { startsWith: 'TEST_ACT_' } }, select: { id: true } })
  const uids = users.map((u) => u.id)
  const bookings = await prisma.booking.findMany({ where: { userId: { in: uids } }, select: { id: true } })
  await prisma.reservation.deleteMany({ where: { OR: [{ sessionId: { in: sids } }, { note: TAG }, { cartToken: { startsWith: 'T-' } }, { bookingId: { in: bookings.map((b) => b.id) } }] } })
  await prisma.booking.deleteMany({ where: { id: { in: bookings.map((b) => b.id) } } })
  await prisma.notificationLog.deleteMany({ where: { OR: [{ sessionId: { in: sids } }, { userId: { in: uids } }] } })
  await prisma.session.deleteMany({ where: { id: { in: sids } } })
  await prisma.activity.deleteMany({ where: { id: { in: acts.map((a) => a.id) } } })
  await prisma.user.deleteMany({ where: { id: { in: uids } } })
  await prisma.mediaAsset.deleteMany({ where: { originalName: 'test.jpg', activities: { none: {} }, sessions: { none: {} } } })
  await prisma.auditLog.deleteMany({ where: { actor: { in: ['test:script', 'payment:mock', 'admin:test:script'] }, createdAt: { gte: new Date(Date.now() - 3600_000) } } })
}

main()
  .catch((err) => {
    console.error('測試中斷：', err)
    results.push({ name: '執行', ok: false, detail: String(err?.message ?? err) })
  })
  .finally(async () => {
    await cleanup().catch((err) => console.error('清理失敗', err))
    const failed = results.filter((r) => !r.ok)
    console.log(`\n通過 ${results.length - failed.length}／${results.length}`)
    await prisma.$disconnect()
    process.exit(failed.length ? 1 : 0)
  })
