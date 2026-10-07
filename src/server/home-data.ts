import { CoachStatus, RegistrationStatus, SessionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getUpcomingSessions } from './activity-service'
import { zonedParts } from '@/lib/timezone'

/**
 * 首頁用的營運資料，全部來自資料庫既有設定；任何一項讀取失敗都回傳空值，
 * 首頁改顯示對應的備援文案，不會整頁出錯。
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
const pad = (n: number) => String(n).padStart(2, '0')
export const minuteLabel = (m: number) => (m >= 1440 ? '24:00' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`)

export interface HomeSession {
  id: string
  title: string
  dateLabel: string
  timeLabel: string
  price: number
  /** 開放報名時的剩餘正取名額；其他狀態為 null */
  spotsLeft: number | null
  statusLabel: string
}

export interface HomePriceRow {
  label: string
  timeLabel: string
  price: number
}

export interface HomeCoach {
  id: string
  name: string
  specialties: string[]
  hourlyRate: number
  bio: string | null
}

export interface HomeData {
  venue: { openLabel: string; slotMinutes: number; bookAheadDays: number; address: string | null; phone: string | null } | null
  prices: HomePriceRow[]
  minPrice: number | null
  sessions: HomeSession[]
  coaches: HomeCoach[]
}

const DAY_LABEL = { ALL: '每日', WEEKDAY: '平日', WEEKEND: '假日' } as const
const KIND_LABEL = { PEAK: '尖峰', OFFPEAK: '離峰' } as const

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[home] 讀取${label}失敗`, err)
    return fallback
  }
}

export async function getHomeData(): Promise<HomeData> {
  const now = new Date()

  const venue = await safe(
    '場館',
    () =>
      prisma.venue.findFirst({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, address: true, phone: true, openMinute: true, closeMinute: true, slotMinutes: true, bookAheadDays: true, timezone: true },
      }),
    null,
  )

  const [rules, sessions, coaches] = await Promise.all([
    venue
      ? safe(
          '費率',
          () => prisma.priceRule.findMany({ where: { venueId: venue.id }, orderBy: [{ dayType: 'asc' }, { startMinute: 'asc' }] }),
          [],
        )
      : Promise.resolve([]),
    venue ? safe('活動', () => getUpcomingSessions(venue.id, null, { limit: 3 }), []) : Promise.resolve([]),
    safe(
      '教練',
      () =>
        prisma.coach.findMany({
          where: { status: CoachStatus.ACTIVE },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, specialties: true, hourlyRate: true, bio: true },
        }),
      [],
    ),
  ])

  const prices: HomePriceRow[] = rules.map((r) => ({
    label: `${DAY_LABEL[r.dayType]}${KIND_LABEL[r.kind]}`,
    timeLabel: `${minuteLabel(r.startMinute)}–${minuteLabel(r.endMinute)}`,
    price: r.price,
  }))

  return {
    venue: venue
      ? {
          openLabel: `${minuteLabel(venue.openMinute)}–${minuteLabel(venue.closeMinute)}`,
          slotMinutes: venue.slotMinutes,
          bookAheadDays: venue.bookAheadDays,
          address: venue.address.trim() || null,
          phone: venue.phone.trim() || null,
        }
      : null,
    prices,
    minPrice: prices.length ? Math.min(...prices.map((p) => p.price)) : null,
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      dateLabel: s.dateLabel,
      timeLabel: s.timeLabel,
      price: s.price,
      spotsLeft: s.state === 'OPEN' ? s.remaining : null,
      statusLabel: s.state === 'OPEN' ? `剩 ${s.remaining} 個名額` : s.state === 'NOT_OPEN' && s.opensAtLabel ? s.opensAtLabel : s.stateLabel,
    })),
    coaches: coaches.map((c) => ({
      ...c,
      specialties: Array.isArray(c.specialties) ? c.specialties.filter((x): x is string => typeof x === 'string') : [],
    })),
  }
}
