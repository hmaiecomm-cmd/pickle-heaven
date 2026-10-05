import { computeSessionTimes, upcomingOccurrences } from '../src/lib/session-schedule.ts'
import { zonedParts } from '../src/lib/timezone.ts'

const tz = 'Asia/Taipei'
const fmt = (d: Date) => {
  const p = zonedParts(d, tz)
  const wd = ['日', '一', '二', '三', '四', '五', '六'][p.weekday]
  return `${p.month}/${p.day}（${wd}）${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

const rule = {
  timezone: tz,
  startMinute: 12 * 60,
  endMinute: 14 * 60,
  bookingOpenDaysBefore: 7,
  bookingOpenHourOffset: 1,
  cancellationMode: 'PREVIOUS_DAY_MIDNIGHT' as const,
}

// 規格範例：2026-09-29 是週二
const t = computeSessionTimes(zonedParts(new Date('2026-09-29T00:00:00+08:00'), tz), rule)

console.log('【規格範例驗證】球敘：週二 12:00–14:00')
console.log('  開打      ', fmt(t.startAt), '→ 結束', fmt(t.endAt))
console.log('  報名開放  ', fmt(t.bookingOpenAt), '  應為「前一週二 13:00」')
console.log('  取消截止  ', fmt(t.cancelDeadline), '  應為「週一 00:00」')
console.log('  產生名單  ', fmt(t.finalizeAt), '  應與取消截止相同')

const ok =
  fmt(t.startAt) === '9/29（二）12:00' &&
  fmt(t.bookingOpenAt) === '9/22（二）13:00' &&
  fmt(t.cancelDeadline) === '9/28（一）00:00'
console.log(ok ? '\n✅ 與規格完全相符' : '\n❌ 與規格不符')

console.log('\n【跨日光節約時間測試】同樣規則套用到 America/New_York')
const ny = { ...rule, timezone: 'America/New_York' }
const beforeDst = computeSessionTimes(zonedParts(new Date('2026-10-27T12:00:00-04:00'), 'America/New_York'), ny)
const afterDst = computeSessionTimes(zonedParts(new Date('2026-11-10T12:00:00-05:00'), 'America/New_York'), ny)
const fmtNy = (d: Date) => {
  const p = zonedParts(d, 'America/New_York')
  return `${p.month}/${p.day} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}
console.log('  DST 期間場次開打 ', fmtNy(beforeDst.startAt), '／取消截止', fmtNy(beforeDst.cancelDeadline))
console.log('  DST 結束後場次   ', fmtNy(afterDst.startAt), '／取消截止', fmtNy(afterDst.cancelDeadline))
console.log('  兩者當地時間都應是 12:00 開打、前一日 00:00 截止')

console.log('\n【週期產生】接下來 4 週')
for (const o of upcomingOccurrences(new Date('2026-09-22T00:00:00+08:00'), 2, 4, rule)) {
  console.log('  ', fmt(o.startAt), ' 報名開放', fmt(o.bookingOpenAt))
}
