import { addDays, taipeiDateString, taipeiToUtc, taipeiWeekday } from './time'

export type FinanceRange = 'today' | 'week' | 'month' | 'quarter' | 'year'
export const FINANCE_RANGES: FinanceRange[] = ['today', 'week', 'month', 'quarter', 'year']

export function isFinanceRange(v: unknown): v is FinanceRange {
  return typeof v === 'string' && (FINANCE_RANGES as string[]).includes(v)
}

/**
 * 把期間代號換成 UTC 區間，一律以 Asia/Taipei 的日界線計算。
 * 與 mock-data 的 getDateRange 邏輯一致（週從週日起算），但不受伺服器時區影響。
 */
export function resolveFinanceRange(range: FinanceRange, today = taipeiDateString()): { from: Date; to: Date } {
  const [y, m] = today.split('-').map(Number)
  let fromStr = today
  if (range === 'week') fromStr = addDays(today, -taipeiWeekday(today))
  else if (range === 'month') fromStr = `${y}-${String(m).padStart(2, '0')}-01`
  else if (range === 'quarter') fromStr = `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
  else if (range === 'year') fromStr = `${y}-01-01`
  return { from: taipeiToUtc(fromStr, 0), to: taipeiToUtc(today, 1440) }
}
