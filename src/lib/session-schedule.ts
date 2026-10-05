import {
  addZonedDays,
  nextWeekdayStart,
  zonedParts,
  zonedToUtc,
  type ZonedParts,
} from './timezone'

/**
 * 由範本設定推算一場球敘的各個生命週期時間戳。
 *
 * 這些時間一旦算好就寫進 sessions 資料表，之後全由排程比對時間戳推進狀態，
 * 不會為任何一場球敘建立獨立的計時器。
 */

export type CancellationMode = 'PREVIOUS_DAY_MIDNIGHT' | 'HOURS_BEFORE_START' | 'CUSTOM_TIMESTAMP'

export type ScheduleRule = {
  timezone: string
  /// 一日之中的分鐘數，12:00 為 720
  startMinute: number
  endMinute: number
  bookingOpenDaysBefore: number
  /// 相對於 startMinute 的小時位移；規格預設 +1（週二 12:00 的場，前一週二 13:00 開放）
  bookingOpenHourOffset: number
  cancellationMode: CancellationMode
  cancellationHoursBefore?: number | null
  customCancelDeadline?: Date | null
}

export type SessionTimes = {
  startAt: Date
  endAt: Date
  bookingOpenAt: Date
  cancelDeadline: Date
  /// 規格：finalize 與取消截止同時發生（產生最終名單並鎖定）
  finalizeAt: Date
}

/** 以場館時區，針對某個日期（該時區的年月日）推算所有時間戳。 */
export function computeSessionTimes(dayInZone: ZonedParts, rule: ScheduleRule): SessionTimes {
  const { timezone: tz } = rule
  const { year, month, day } = dayInZone

  const startAt = zonedToUtc(tz, year, month, day, rule.startMinute)
  // endMinute 若小於 startMinute 視為跨日
  const endAt =
    rule.endMinute > rule.startMinute
      ? zonedToUtc(tz, year, month, day, rule.endMinute)
      : zonedToUtc(tz, year, month, day + 1, rule.endMinute)

  const bookingOpenAt = zonedToUtc(
    tz,
    year,
    month,
    day - rule.bookingOpenDaysBefore,
    rule.startMinute + rule.bookingOpenHourOffset * 60,
  )

  let cancelDeadline: Date
  switch (rule.cancellationMode) {
    case 'HOURS_BEFORE_START':
      cancelDeadline = new Date(startAt.getTime() - (rule.cancellationHoursBefore ?? 24) * 3_600_000)
      break
    case 'CUSTOM_TIMESTAMP':
      if (!rule.customCancelDeadline) {
        throw new Error('cancellationMode 為 CUSTOM_TIMESTAMP 時必須提供 customCancelDeadline')
      }
      cancelDeadline = rule.customCancelDeadline
      break
    case 'PREVIOUS_DAY_MIDNIGHT':
    default:
      // 前一日 00:00（場館時區）。週二 12:00 的場 → 週一 00:00
      cancelDeadline = addZonedDays(startAt, tz, -1)
      break
  }

  return { startAt, endAt, bookingOpenAt, cancelDeadline, finalizeAt: cancelDeadline }
}

/**
 * 產生某個週期性範本接下來 N 週的場次時間。
 *
 * 只產生有限數量（範本的 generateWeeksAhead），再由排程定期補足，
 * 避免一次產生無上限的未來場次。
 */
export function upcomingOccurrences(
  from: Date,
  weekday: number,
  weeks: number,
  rule: ScheduleRule,
): SessionTimes[] {
  const firstDay = nextWeekdayStart(from, rule.timezone, weekday)
  const out: SessionTimes[] = []

  for (let i = 0; i < weeks; i++) {
    const dayStart = addZonedDays(firstDay, rule.timezone, i * 7)
    const times = computeSessionTimes(zonedParts(dayStart, rule.timezone), rule)
    // 已經開打過的場次不再產生
    if (times.startAt.getTime() >= from.getTime()) out.push(times)
  }

  return out
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'] as const

/**
 * 解析範本的重複星期（"2,4" → [2, 4]）。
 * 舊範本的 weekdays 是空字串，沿用單一的 weekday 欄位。
 */
export function parseWeekdays(weekdays: string, fallback: number): number[] {
  const days = [...new Set(
    weekdays
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => isWeekday(n)),
  )].sort((a, b) => a - b)
  return days.length > 0 ? days : [fallback]
}

function isWeekday(n: number) {
  return Number.isInteger(n) && n >= 0 && n <= 6
}

/** 序列化成資料庫欄位用的字串。 */
export function formatWeekdays(days: number[]): string {
  return [...new Set(days)].filter(isWeekday).sort((a, b) => a - b).join(',')
}

/** 給人看的重複說明：「每天」、「每週二、四」。 */
export function describeWeekdays(days: number[]): string {
  if (days.length === 7) return '每天'
  return `每週${days.map((d) => WEEKDAY_NAMES[d]).join('、')}`
}
