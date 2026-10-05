/**
 * 以 IANA 時區名稱進行換算的工具。
 *
 * 既有的 time.ts 以固定 +480 分鐘處理台北時區；台灣沒有日光節約時間，
 * 用於場地預定沒有問題。但球敘（Session）是多場館 / 多時區的 SaaS 模型，
 * 取消截止等規則必須以各場館自己的時區計算，因此改用 Intl 取得真實偏移量，
 * 這樣才能正確處理有日光節約時間的地區。
 *
 * 慣例：資料庫一律存 UTC，只有在顯示與business rule 計算時才換算。
 */

export const DEFAULT_TIMEZONE = 'Asia/Taipei'

export type ZonedParts = {
  year: number
  month: number // 1-12
  day: number // 1-31
  hour: number
  minute: number
  second: number
  /// 0=週日 … 6=週六
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    formatterCache.set(timeZone, f)
  }
  return f
}

/** 取得某個 UTC 時間點在指定時區的年月日時分與星期。 */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

/** 指定時區在該時間點與 UTC 的偏移量（分鐘，東經為正）。 */
export function offsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - date.getTime()) / 60_000)
}

/**
 * 把「某時區的牆上時間」轉成 UTC。
 *
 * 偏移量本身取決於時間點（日光節約），所以先以估計值換算，
 * 再用換算結果重新取得偏移量修正一次，即可收斂。
 */
export function zonedToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  minuteOfDay = 0,
): Date {
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const naive = Date.UTC(year, month - 1, day, hour, minute)

  let guess = new Date(naive - offsetMinutes(new Date(naive), timeZone) * 60_000)
  // 若估計時落在偏移量切換的邊界，再修正一次
  const refined = new Date(naive - offsetMinutes(guess, timeZone) * 60_000)
  if (refined.getTime() !== guess.getTime()) guess = refined

  return guess
}

/** 該時區當日的 00:00（回傳 UTC 時間點）。 */
export function startOfZonedDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone)
  return zonedToUtc(timeZone, p.year, p.month, p.day, 0)
}

/** 以該時區為準，在日期上加減天數後的當日 00:00。 */
export function addZonedDays(date: Date, timeZone: string, days: number): Date {
  const p = zonedParts(date, timeZone)
  return zonedToUtc(timeZone, p.year, p.month, p.day + days, 0)
}

/** 該時區的 YYYY-MM-DD 字串。 */
export function zonedDateString(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** 從 base 起算，下一個落在指定星期的日期（含當天）在該時區的 00:00。 */
export function nextWeekdayStart(base: Date, timeZone: string, weekday: number): Date {
  const p = zonedParts(base, timeZone)
  const delta = (weekday - p.weekday + 7) % 7
  return zonedToUtc(timeZone, p.year, p.month, p.day + delta, 0)
}
