/**
 * 台灣時區工具。
 * 台灣為 UTC+8 且無日光節約時間，因此以固定位移換算即可，
 * 不需引入時區資料庫，也避免伺服器所在時區造成的偏差。
 *
 * 約定：
 *  - 「日期字串」一律為 Asia/Taipei 當地的 YYYY-MM-DD
 *  - 「分鐘數」為自當地午夜起算的分鐘（600 = 10:00；1440 = 隔日 00:00）
 *  - 資料庫一律存 UTC 的 Date
 */

export const TAIPEI_OFFSET_MINUTES = 480
const MS_PER_MIN = 60_000
const MS_PER_DAY = 86_400_000

export const WEEKDAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const

/** 目前時間（可於測試中覆寫） */
export function now(): Date {
  return new Date()
}

/** 將 UTC Date 轉為台北當地時間的「假想 UTC」Date，方便取用 getUTC* */
function toTaipeiShifted(date: Date): Date {
  return new Date(date.getTime() + TAIPEI_OFFSET_MINUTES * MS_PER_MIN)
}

/** 台北當地日期字串 YYYY-MM-DD */
export function taipeiDateString(date: Date = now()): string {
  const d = toTaipeiShifted(date)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 台北當地自午夜起算的分鐘數 */
export function taipeiMinuteOfDay(date: Date = now()): number {
  const d = toTaipeiShifted(date)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** 台北當地星期（0 = 週日） */
export function taipeiWeekday(dateStr: string): number {
  const [y, m, d] = parseDateString(dateStr)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function isWeekend(dateStr: string): boolean {
  const w = taipeiWeekday(dateStr)
  return w === 0 || w === 6
}

/** 台北當地日期 + 分鐘 → UTC Date（存入資料庫用） */
export function taipeiToUtc(dateStr: string, minuteOfDay: number): Date {
  const [y, m, d] = parseDateString(dateStr)
  const base = Date.UTC(y, m - 1, d)
  return new Date(base + (minuteOfDay - TAIPEI_OFFSET_MINUTES) * MS_PER_MIN)
}

/** 日期字串加減天數 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = parseDateString(dateStr)
  const t = Date.UTC(y, m - 1, d) + days * MS_PER_DAY
  const nd = new Date(t)
  return `${nd.getUTCFullYear()}-${pad(nd.getUTCMonth() + 1)}-${pad(nd.getUTCDate())}`
}

/** 兩個日期字串相差天數（b - a） */
export function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = parseDateString(a)
  const [y2, m2, d2] = parseDateString(b)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / MS_PER_DAY)
}

/** 分鐘 → HH:mm（支援跨日，1500 → 01:00） */
export function formatMinute(minuteOfDay: number): string {
  const m = ((minuteOfDay % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** 時段區間文字：600,660 → "10:00–11:00" */
export function formatRange(start: number, end: number): string {
  return `${formatMinute(start)}–${formatMinute(end)}`
}

/** 日期字串 → 顯示用 "9/3（三）" */
export function formatDateLabel(dateStr: string): { md: string; weekday: string; day: string; month: string } {
  const [, m, d] = parseDateString(dateStr)
  const w = WEEKDAY_LABELS[taipeiWeekday(dateStr)]
  return { md: `${m}/${d}`, weekday: w, day: String(d), month: `${m}月` }
}

/** 完整中文日期：2026年9月3日（週三） */
export function formatDateFull(dateStr: string): string {
  const [y, m, d] = parseDateString(dateStr)
  return `${y}年${m}月${d}日（${WEEKDAY_LABELS[taipeiWeekday(dateStr)]}）`
}

/** 相對日期標籤：今天 / 明天 / 週三 */
export function relativeDayLabel(dateStr: string, today = taipeiDateString()): string {
  const diff = diffDays(today, dateStr)
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '後天'
  return WEEKDAY_LABELS[taipeiWeekday(dateStr)]
}

/** UTC Date → 台北 "9/3 10:00" */
export function formatDateTime(date: Date): string {
  const ds = taipeiDateString(date)
  const [, m, d] = parseDateString(ds)
  return `${m}/${d} ${formatMinute(taipeiMinuteOfDay(date))}`
}

/** 產生日期列（自今天起 n 天） */
export function dateRange(days: number, from = taipeiDateString()): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i))
}

/** 產生營業時段的起始分鐘陣列 */
export function slotStarts(openMinute: number, closeMinute: number, slotMinutes: number): number[] {
  const out: number[] = []
  for (let m = openMinute; m + slotMinutes <= closeMinute; m += slotMinutes) out.push(m)
  return out
}

function parseDateString(dateStr: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) throw new Error(`無效的日期格式：${dateStr}（應為 YYYY-MM-DD）`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function isValidDateString(dateStr: string): boolean {
  try {
    parseDateString(dateStr)
    return true
  } catch {
    return false
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
