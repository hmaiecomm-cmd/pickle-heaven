import type { PriceRule } from '@prisma/client'
import { isWeekend } from './time'

export interface ResolvedRate {
  name: string
  kind: 'PEAK' | 'OFFPEAK'
  price: number
}

const FALLBACK: ResolvedRate = { name: '離峰', kind: 'OFFPEAK', price: 600 }

/**
 * 依日期與時段起始分鐘決定費率。
 * 規則比對順序：dayType 精確者優先（WEEKEND/WEEKDAY > ALL），其次 priority 大者優先。
 */
export function resolveRate(dateStr: string, startMinute: number, rules: PriceRule[]): ResolvedRate {
  const weekend = isWeekend(dateStr)
  const dayType = weekend ? 'WEEKEND' : 'WEEKDAY'

  const matched = rules
    .filter((r) => r.dayType === dayType || r.dayType === 'ALL')
    .filter((r) => startMinute >= r.startMinute && startMinute < r.endMinute)
    .sort((a, b) => {
      const specificity = (r: PriceRule) => (r.dayType === 'ALL' ? 0 : 1)
      return specificity(b) - specificity(a) || b.priority - a.priority
    })

  const rule = matched[0]
  if (!rule) return FALLBACK
  return { name: rule.name, kind: rule.kind as 'PEAK' | 'OFFPEAK', price: rule.price }
}

/** 折價券試算 */
export function applyVoucher(
  subtotal: number,
  voucher: { type: 'AMOUNT' | 'PERCENT'; value: number; minSpend: number } | null,
): number {
  if (!voucher) return 0
  if (subtotal < voucher.minSpend) return 0
  if (voucher.type === 'AMOUNT') return Math.min(voucher.value, subtotal)
  // PERCENT：value = 90 代表 9 折
  const pct = Math.max(0, Math.min(100, voucher.value))
  return Math.round((subtotal * (100 - pct)) / 100)
}

/** 取消退款比例：依開打前剩餘時間遞減（回補為點數） */
export function refundRatio(hoursBeforeStart: number): number {
  if (hoursBeforeStart >= 72) return 1
  if (hoursBeforeStart >= 48) return 0.8
  if (hoursBeforeStart >= 24) return 0.5
  return 0
}

export const REFUND_POLICY_ROWS = [
  { window: '開打前 72 小時以上', ratio: '100%' },
  { window: '開打前 48–72 小時', ratio: '80%' },
  { window: '開打前 24–48 小時', ratio: '50%' },
  { window: '開打前 24 小時內', ratio: '不予退款' },
]
