/**
 * 時段共用密碼（版本三）驗證 — 只在開發資料庫執行；建立獨立的測試場館，結束時全部刪除。
 *   npm run verify:slot-passwords
 *
 * LINE 發送以假的推播函式取代（記錄訊息內容），不會真的推播。
 */
import type { BookingStatus } from '@prisma/client'
import { prisma } from '../src/lib/db'
import { addDays, taipeiDateString, taipeiToUtc } from '../src/lib/time'
import { syncGrantForBooking } from '../src/server/door-access-grants'
import { recordPaymentFailure } from '../src/server/booking-service'
import {
  decryptCode,
  encryptCode,
  fingerprintCode,
  generateCode,
  isWeakCode,
  maskCode,
  verifyDoorCode,
} from '../src/server/slot-password-service'
import { generateUpcomingSlotPasswords, syncSlotPasswordsForBooking } from '../src/server/slot-password-integration'
import { NOT_BOUND_REASON, retryFailedSlotPasswordLogs } from '../src/server/slot-password-notification'

if (!/^libsql:\/\/pickle-heaven-dev-/.test(process.env.TURSO_DATABASE_URL ?? '')) {
  console.error('中止：只能在開發資料庫執行（請以 --env-file=.env --env-file=.env.local 執行）')
  process.exit(1)
}

let passed = 0
let failed = 0
function check(name: string, ok: boolean, extra = '') {
  if (ok) passed++
  else failed++
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? `（${extra}）` : ''}`)
}

const tag = `slotpw-${Date.now()}`
const sent: { to: string; text: string }[] = []
let lineDown = false
const fakeSend = async (to: string, messages: unknown[]) => {
  if (lineDown) return false
  sent.push({ to, text: (messages[0] as { text: string }).text })
  return true
}
const codeIn = (text: string) => text.match(/門禁密碼：(\d{6})/)?.[1] ?? null
const lastCodeFor = (lineUserId: string) => codeIn([...sent].reverse().find((m) => m.to === lineUserId)?.text ?? '')

let venueId = ''
let courtId = ''
const userIds: string[] = []
let seq = 0

async function makeUser(withLine: boolean) {
  const u = await prisma.user.create({
    data: { displayName: `${tag}-會員${userIds.length}`, phone: '0911000000', lineUserId: withLine ? `U${tag}${userIds.length}` : null },
  })
  userIds.push(u.id)
  return u
}

/** dateStr 台北日期、start/end 為台北分鐘數 */
async function makeBooking(userId: string, dateStr: string, start: number, end: number, status: BookingStatus = 'PAID') {
  const startsAt = taipeiToUtc(dateStr, start)
  const endsAt = taipeiToUtc(dateStr, end)
  return prisma.booking.create({
    data: {
      code: `${tag}-${seq++}`,
      userId,
      venueId,
      playDate: dateStr,
      subtotal: 500,
      total: 500,
      contactName: '測試',
      contactPhone: '0900000000',
      status,
      paidAt: status === 'PAID' ? new Date() : null,
      items: { create: { courtId, courtName: '測試場', startsAt, endsAt, price: 500, rateName: '測試' } },
    },
  })
}

async function pay(bookingId: string) {
  await syncGrantForBooking(bookingId)
  return syncSlotPasswordsForBooking(bookingId, { send: fakeSend })
}

async function cancel(bookingId: string, status: BookingStatus = 'CANCELLED') {
  await prisma.booking.update({ where: { id: bookingId }, data: { status } })
  await prisma.bookingItem.updateMany({ where: { bookingId }, data: { status: 'CANCELLED' } })
  await syncGrantForBooking(bookingId)
  return syncSlotPasswordsForBooking(bookingId, { send: fakeSend })
}

const slotOf = async (bookingId: string) =>
  (await prisma.bookingSlotPassword.findFirst({ where: { bookingId }, include: { slotPassword: true } }))?.slotPassword ?? null

async function main() {
  const base = await prisma.venue.findFirst({ select: { organizationId: true } })
  if (!base) throw new Error('開發資料庫缺少場館')
  const venue = await prisma.venue.create({
    data: { organizationId: base.organizationId, slug: tag, name: '測試森林匹克球', address: '測試地址', phone: '02-0000-0000', active: false },
  })
  venueId = venue.id
  courtId = (await prisma.court.create({ data: { venueId, name: '測試場' } })).id
  await prisma.slotPasswordRule.create({
    data: { venueId, generationMode: 'SPLIT_DAY', passwordOpenTime: '10_MIN_BEFORE', passwordExpireTime: '30_MIN_AFTER', generateAheadDays: 30 },
  })

  const day = addDays(taipeiDateString(), 3)
  const [u1, u2, u3] = [await makeUser(true), await makeUser(true), await makeUser(false)]

  console.log('── 六位數密碼')
  const codes = Array.from({ length: 3000 }, () => generateCode())
  check('12. 一律為六位數字', codes.every((c) => /^\d{6}$/.test(c)))
  check('12. 支援前導零（3000 組中出現 0 開頭）', codes.some((c) => c.startsWith('0')))
  check('排除簡單密碼', isWeakCode('000000') && isWeakCode('111111') && isWeakCode('123456') && isWeakCode('654321') && isWeakCode('121212') && !isWeakCode('004281'))
  check('不會產生簡單密碼', codes.every((c) => !isWeakCode(c)))
  check('遮罩只顯示最後兩位', maskCode('004281') === '****81')
  check('密文可還原、指紋固定', decryptCode(encryptCode('004281')) === '004281' && fingerprintCode('004281') === fingerprintCode('004281'))

  console.log('── 付款與共用')
  const a = await makeBooking(u1.id, day, 9 * 60, 10 * 60)
  const ra = await pay(a.id)
  const slotA = await slotOf(a.id)
  check('1. 第一筆付款建立時段密碼', ra.added.length === 1 && !!slotA && slotA.activeOrderCount === 1 && slotA.slotType === 'MORNING')
  const b = await makeBooking(u2.id, day, 10 * 60, 11 * 60)
  await pay(b.id)
  const slotB = await slotOf(b.id)
  check('2. 同時段第二筆沿用原密碼', slotB?.id === slotA?.id && slotB?.codeHash === slotA?.codeHash && slotB?.activeOrderCount === 2)
  const c1 = lastCodeFor(u1.lineUserId!)
  const c2 = lastCodeFor(u2.lineUserId!)
  check('3. 兩筆訂單收到同一組 LINE 密碼', !!c1 && c1 === c2, `${c1 ? maskCode(c1) : '無'}`)
  const msg = sent.find((m) => m.to === u1.lineUserId)?.text ?? ''
  check('LINE 內容含場館、時段、開放／失效時間、共用說明、訂單編號', ['場館：測試森林匹克球', '預約時段：09:00～10:00', '開放時間', '失效時間', '共用密碼', `訂單編號：${a.code}`].every((t) => msg.includes(t)))
  const code = c1!
  const at1005 = taipeiToUtc(day, 10 * 60 + 5)
  check('有效訂單在開放時間內可開門', (await verifyDoorCode(venueId, code, at1005)).ok)

  console.log('── 取消')
  await cancel(a.id)
  const afterA = await prisma.slotPassword.findUniqueOrThrow({ where: { id: slotA!.id } })
  check('4. 一筆取消，密碼仍有效（不刪除、不換碼）', afterA.codeHash === slotA!.codeHash && afterA.activeOrderCount === 1 && afterA.status !== 'LOCKED')
  check('5. 另一筆有效訂單仍可使用密碼', (await verifyDoorCode(venueId, code, at1005)).ok)
  await cancel(b.id)
  const afterB = await prisma.slotPassword.findUniqueOrThrow({ where: { id: slotA!.id } })
  check('6. 全部取消後時段 LOCKED', afterB.status === 'LOCKED' && afterB.activeOrderCount === 0)
  const v7 = await verifyDoorCode(venueId, code, at1005)
  check('7. LOCKED 時輸入舊密碼失敗', !v7.ok && v7.reason === 'LOCKED', v7.ok ? '' : v7.reason)

  console.log('── 退款')
  const c = await makeBooking(u1.id, day, 14 * 60, 15 * 60)
  const d = await makeBooking(u2.id, day, 15 * 60, 16 * 60)
  await pay(c.id)
  await pay(d.id)
  const slotPm = await slotOf(c.id)
  await cancel(d.id, 'REFUND_PENDING')
  const pmAfter = await prisma.slotPassword.findUniqueOrThrow({ where: { id: slotPm!.id } })
  check('8. 退款不刪除仍有顧客使用的時段密碼', pmAfter.codeHash === slotPm!.codeHash && pmAfter.activeOrderCount === 1 && pmAfter.status !== 'LOCKED')

  console.log('── 付款失敗')
  const e = await makeBooking(u1.id, day, 14 * 60, 15 * 60, 'PENDING')
  const before = sent.length
  await recordPaymentFailure(e.id, 'test', '測試：卡片被拒')
  await syncSlotPasswordsForBooking(e.id, { send: fakeSend })
  const eLinks = await prisma.bookingSlotPassword.count({ where: { bookingId: e.id } })
  const pmCount = (await prisma.slotPassword.findUniqueOrThrow({ where: { id: slotPm!.id } })).activeOrderCount
  check('9. 付款失敗不產生密碼、不計入有效訂單、不發 LINE', eLinks === 0 && pmCount === 1 && sent.length === before)

  console.log('── 改期')
  const f = await makeBooking(u2.id, day, 9 * 60, 10 * 60)
  await pay(f.id)
  const oldSlot = await slotOf(f.id)
  const day2 = addDays(day, 1)
  await prisma.bookingItem.updateMany({ where: { bookingId: f.id }, data: { startsAt: taipeiToUtc(day2, 14 * 60), endsAt: taipeiToUtc(day2, 15 * 60) } })
  const rf = await syncSlotPasswordsForBooking(f.id, { send: fakeSend })
  const newSlot = await slotOf(f.id)
  const oldAfter = await prisma.slotPassword.findUniqueOrThrow({ where: { id: oldSlot!.id } })
  const fLinks = await prisma.bookingSlotPassword.count({ where: { bookingId: f.id } })
  check('10. 改期後舊時段移除、新時段加入', fLinks === 1 && newSlot!.id !== oldSlot!.id && newSlot!.slotDate === day2 && newSlot!.activeOrderCount === 1 && oldAfter.activeOrderCount === 0 && oldAfter.status === 'LOCKED')
  check('10. 改期只發送新時段密碼', rf.sent === 1 && sent[sent.length - 1].text.includes(`預約日期：${day2.replace(/-/g, '/')}`))
  const lockedRetry = await prisma.slotPasswordLog.count({ where: { bookingId: f.id, slotPasswordId: oldSlot!.id, sendStatus: { not: 'SENT' } } })
  check('改期後舊時段不再重試發送', lockedRetry === 0)

  console.log('── 批次')
  const g = await makeBooking(u1.id, addDays(day, 2), 9 * 60, 10 * 60)
  const run1 = await generateUpcomingSlotPasswords({ venueId, send: fakeSend })
  const slots1 = await prisma.slotPassword.count({ where: { venueId } })
  const run2 = await generateUpcomingSlotPasswords({ venueId, send: fakeSend })
  const slots2 = await prisma.slotPassword.count({ where: { venueId } })
  const gSlot = await slotOf(g.id)
  check('11. 批次為已付款訂單補產生密碼', run1.added >= 1 && !!gSlot)
  check('11. 重複執行批次不會產生第二組密碼', run2.added === 0 && slots1 === slots2)
  const pend = await makeBooking(u1.id, addDays(day, 2), 10 * 60, 11 * 60, 'PENDING')
  await generateUpcomingSlotPasswords({ venueId, send: fakeSend })
  check('批次不會讓未付款訂單取得密碼', (await prisma.bookingSlotPassword.count({ where: { bookingId: pend.id } })) === 0)

  console.log('── LINE')
  const h = await makeBooking(u3.id, addDays(day, 2), 9 * 60, 10 * 60)
  const sentBefore = sent.length
  await pay(h.id)
  const hLog = await prisma.slotPasswordLog.findFirst({ where: { bookingId: h.id } })
  check('13. 未綁定 LINE：不發送到其他通道，記錄原因', sent.length === sentBefore && hLog?.sendStatus === 'FAILED' && hLog.failureReason === NOT_BOUND_REASON)
  lineDown = true
  const i = await makeBooking(u2.id, addDays(day, 2), 10 * 60, 11 * 60)
  await pay(i.id)
  const iLog = await prisma.slotPasswordLog.findFirst({ where: { bookingId: i.id } })
  lineDown = false
  const retry = await retryFailedSlotPasswordLogs({ send: fakeSend })
  const iLog2 = await prisma.slotPasswordLog.findFirst({ where: { bookingId: i.id } })
  check('14. LINE 失敗保留記錄，重試後成功', iLog?.sendStatus === 'FAILED' && iLog2?.sendStatus === 'SENT' && iLog2.retryCount === 1 && retry.sent >= 1)
  check('14. 未綁定 LINE 的記錄不會被自動重試', (await prisma.slotPasswordLog.findFirst({ where: { bookingId: h.id } }))?.retryCount === 0)

  console.log('── 開放與失效時間')
  const pmCode = lastCodeFor(u1.lineUserId!) // 最後發給 u1 的是批次的 g（day+2 上午）
  const gs = await prisma.slotPassword.findUniqueOrThrow({ where: { id: gSlot!.id } })
  const gCode = decryptCode(gs.codeCiphertext)
  check('批次發送的密碼與時段一致', pmCode === gCode)
  const v15 = await verifyDoorCode(venueId, gCode, new Date(gs.openAt.getTime() - 60_000))
  check('15. 開放時間前不能開門', !v15.ok && v15.reason === 'NOT_OPEN', v15.ok ? '' : v15.reason)
  const v16 = await verifyDoorCode(venueId, gCode, new Date(gs.expireAt.getTime() + 60_000))
  check('16. 失效後不能開門', !v16.ok && v16.reason === 'EXPIRED', v16.ok ? '' : v16.reason)
  check('開放時間 = 最早預約前 10 分鐘', gs.openAt.getTime() === taipeiToUtc(addDays(day, 2), 9 * 60 - 10).getTime())
  check('失效時間 = 最晚預約結束後 30 分鐘', gs.expireAt.getTime() === taipeiToUtc(addDays(day, 2), 11 * 60 + 30).getTime())
  const wrong = await verifyDoorCode(venueId, gCode === '482719' ? '482718' : '482719', taipeiToUtc(addDays(day, 2), 9 * 60 + 30))
  check('錯誤密碼不能開門', !wrong.ok)
}

main()
  .catch((err) => {
    failed++
    console.error('❌ 執行錯誤', err)
  })
  .finally(async () => {
    if (venueId) {
      await prisma.slotPassword.deleteMany({ where: { venueId } })
      await prisma.doorAccessGrant.deleteMany({ where: { venueId } })
      await prisma.payment.deleteMany({ where: { booking: { venueId } } })
      await prisma.booking.deleteMany({ where: { venueId } })
      await prisma.slotPasswordRule.deleteMany({ where: { venueId } })
      await prisma.court.deleteMany({ where: { venueId } })
      await prisma.venue.delete({ where: { id: venueId } }).catch(() => {})
    }
    await prisma.auditLog.deleteMany({ where: { target: { startsWith: tag } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    console.log(`\n結果：${passed} 通過、${failed} 失敗（測試資料已刪除）`)
    process.exit(failed ? 1 : 0)
  })
