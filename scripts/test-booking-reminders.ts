/**
 * 預約開打提醒驗收測試（對開發資料庫執行，不會真的發 LINE）。
 *
 *   npm run verify:reminders
 *
 * 建立 TEST_reminder_ 開頭的會員與訂單，結束時刪除。不要對正式庫執行。
 */
import { prisma } from '../src/lib/db'
import { buildReminderText, dueReminders, sendDueReminders, type ReminderLine } from '../src/server/booking-reminders'
import { taipeiToUtc } from '../src/lib/time'

const results: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return taipeiToUtc(date, h * 60 + m)
}
const line = (date: string, from: string, to: string, label = 'A 場'): ReminderLine => ({ label, startsAt: at(date, from), endsAt: at(date, to) })
const kinds = (lines: ReminderLine[], bookedAt: Date, now: Date) => dueReminders('b1', lines, bookedAt, now).map((r) => r.kind).join(',')

const EARLY = at('2026-11-01', '09:00')
const USER = 'TEST_reminder_會員'

async function cleanup() {
  const users = await prisma.user.findMany({ where: { displayName: USER }, select: { id: true } })
  const ids = users.map((u) => u.id)
  await prisma.notificationLog.deleteMany({ where: { userId: { in: ids } } })
  await prisma.booking.deleteMany({ where: { userId: { in: ids } } })
  await prisma.user.deleteMany({ where: { id: { in: ids } } })
}

async function main() {
  const one = [line('2026-11-10', '10:00', '11:00')]

  // 1. 前一天：前一天 20:00 起、當天 00:00 前
  check('前一天 19:59 不發', kinds(one, EARLY, at('2026-11-09', '19:59')) === '')
  check('前一天 20:00 發「前一天」', kinds(one, EARLY, at('2026-11-09', '20:00')) === 'DAY_BEFORE')
  check('前一天 23:59 排程延遲仍可補發', kinds(one, EARLY, at('2026-11-09', '23:59')) === 'DAY_BEFORE')
  check('當天 00:00 起不再發「明天」', kinds(one, EARLY, at('2026-11-10', '00:00')) === '')

  // 2. 前兩小時
  check('開打前 2 小時 1 分不發', kinds(one, EARLY, at('2026-11-10', '07:59')) === '')
  check('開打前 2 小時發「前兩小時」', kinds(one, EARLY, at('2026-11-10', '08:00')) === 'TWO_HOURS')
  check('已開打不發', kinds(one, EARLY, at('2026-11-10', '10:00')) === '')

  // 3. 提醒時間過後才付款不補發
  check('前一天 21:00 才訂：不補發前一天提醒', kinds(one, at('2026-11-09', '21:00'), at('2026-11-09', '21:15')) === '')
  check('前一天 21:00 才訂：仍有前兩小時提醒', kinds(one, at('2026-11-09', '21:00'), at('2026-11-10', '08:00')) === 'TWO_HOURS')
  check('開打前 1 小時才訂：不發前兩小時提醒', kinds(one, at('2026-11-10', '09:00'), at('2026-11-10', '09:15')) === '')

  // 4. 多時段
  const contiguous = [line('2026-11-10', '10:00', '11:00'), line('2026-11-10', '11:00', '12:00'), line('2026-11-10', '10:00', '11:00', 'B 場')]
  check('連續與重疊時段只提醒一次', dueReminders('b1', contiguous, EARLY, at('2026-11-10', '08:00')).length === 1)
  check('連續時段第二段不再提醒', kinds(contiguous, EARLY, at('2026-11-10', '09:30')) === 'TWO_HOURS' && kinds(contiguous, EARLY, at('2026-11-10', '10:30')) === '')
  const gap = [line('2026-11-10', '10:00', '11:00'), line('2026-11-10', '18:00', '19:00')]
  check('同一天分開的時段各提醒一次', kinds(gap, EARLY, at('2026-11-10', '16:00')) === 'TWO_HOURS')
  const dayBefore = dueReminders('b1', gap, EARLY, at('2026-11-09', '20:00'))
  check('前一天提醒列出當天所有時段', dayBefore.length === 1 && dayBefore[0].lines.length === 2)
  const twoDays = [line('2026-11-10', '10:00', '11:00'), line('2026-11-11', '10:00', '11:00')]
  check('跨日訂單各日分別提醒', kinds(twoDays, EARLY, at('2026-11-10', '20:00')) === 'DAY_BEFORE')

  // 5. 文字內容（台北時間）
  const text = buildReminderText('DAY_BEFORE', { id: 'b1', code: 'PH-TEST', address: '新店區' }, one)
  check('文字含日期、時段、編號與連結', text.includes('明天開打提醒') && text.includes('2026年11月10日') && text.includes('A 場 10:00–11:00') && text.includes('PH-TEST') && text.includes('/bookings/b1'), text.replace(/\n/g, ' / '))

  // 6. 實際查資料庫：只發已付款、可重跑不重複、失敗不重試
  await cleanup()
  const venue = await prisma.venue.findFirstOrThrow({ include: { courts: { take: 1 } } })
  const court = venue.courts[0]
  const friend = await prisma.user.create({ data: { displayName: USER, lineUserId: 'TEST_reminder_line_ok' } })
  const stranger = await prisma.user.create({ data: { displayName: USER, lineUserId: 'TEST_reminder_line_fail' } })
  const noLine = await prisma.user.create({ data: { displayName: USER, googleSub: 'TEST_reminder_google' } })

  const start = new Date(Date.now() + 90 * 60_000)
  const end = new Date(start.getTime() + 60 * 60_000)
  const paidAt = new Date(Date.now() - 24 * 3_600_000)
  const makeBooking = (userId: string, code: string, status: 'PAID' | 'PENDING' | 'CANCELLED', itemStatus = 'ACTIVE') =>
    prisma.booking.create({
      data: {
        code,
        userId,
        venueId: venue.id,
        playDate: '2026-11-10',
        status,
        subtotal: 500,
        total: 500,
        contactName: USER,
        contactPhone: '0900000000',
        paidAt,
        items: { create: { courtId: court.id, courtName: 'A 場', startsAt: start, endsAt: end, price: 500, rateName: '離峰', status: itemStatus } },
      },
    })
  const paid = await makeBooking(friend.id, 'TEST-REM-PAID', 'PAID')
  await makeBooking(friend.id, 'TEST-REM-PENDING', 'PENDING')
  await makeBooking(friend.id, 'TEST-REM-ITEMCANCEL', 'PAID', 'CANCELLED')
  await makeBooking(noLine.id, 'TEST-REM-NOLINE', 'PAID')
  const failing = await makeBooking(stranger.id, 'TEST-REM-FAIL', 'PAID')

  const sentTo: string[] = []
  const fakeSend = async (to: string) => {
    if (!to.startsWith('TEST_reminder_')) return true // 其他開發資料不算，也不發
    sentTo.push(to)
    return to.endsWith('_ok')
  }
  await sendDueReminders(new Date(), fakeSend)
  check('只發給已付款且有 LINE 的訂單', sentTo.length === 2 && sentTo.includes('TEST_reminder_line_ok') && sentTo.includes('TEST_reminder_line_fail'), sentTo.join(','))

  const logs = await prisma.notificationLog.findMany({ where: { userId: { in: [friend.id, stranger.id] } } })
  const ok = logs.find((l) => l.dedupeKey?.includes(paid.id))
  const bad = logs.find((l) => l.dedupeKey?.includes(failing.id))
  check('成功記為 SENT、失敗記為 FAILED', ok?.status === 'SENT' && Boolean(ok?.sentAt) && bad?.status === 'FAILED')

  sentTo.length = 0
  await sendDueReminders(new Date(), fakeSend)
  check('重跑不重複發送，失敗也不重試', sentTo.length === 0, sentTo.join(','))
}

main()
  .catch((err) => {
    console.error(err)
    results.push({ name: '例外', ok: false, detail: String(err) })
  })
  .finally(async () => {
    await cleanup()
    const ok = results.filter((r) => r.ok).length
    console.log(`\n通過 ${ok}／${results.length}`)
    process.exit(ok === results.length ? 0 : 1)
  })
