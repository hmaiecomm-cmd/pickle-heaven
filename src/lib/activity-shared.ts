/**
 * 活動（Activity / Session）前後端共用的型別、標籤與純函式。
 * 不可引用資料庫或 server-only 模組。
 *
 * 時間約定沿用 lib/time：日期為 Asia/Taipei 的 YYYY-MM-DD，分鐘自當地 00:00 起算，
 * 超過 1440 代表翌日（例如 23:00–翌日 01:00 為 1380–1500）。
 */
import { addDays, diffDays, formatMinute, taipeiWeekday, WEEKDAY_LABELS } from './time'

export type ActivityTypeKey = 'OPEN_PLAY' | 'BEGINNER' | 'LESSON' | 'SOCIAL' | 'OTHER'
export type PriceUnitKey = 'PER_PERSON' | 'PER_PAIR'

export const ACTIVITY_TYPE_LABEL: Record<ActivityTypeKey, string> = {
  OPEN_PLAY: 'Open Play',
  BEGINNER: '新手體驗',
  LESSON: '課程',
  SOCIAL: '交流活動',
  OTHER: '活動',
}

export const ACTIVITY_TYPE_OPTIONS = (Object.keys(ACTIVITY_TYPE_LABEL) as ActivityTypeKey[]).map((k) => ({
  value: k,
  label: ACTIVITY_TYPE_LABEL[k],
}))

/** 價格單位：顯示「NT$500／人」 */
export const PRICE_UNIT_LABEL: Record<PriceUnitKey, string> = { PER_PERSON: '人', PER_PAIR: '組' }
/** 下拉選單用的完整說明 */
export const PRICE_UNIT_OPTION_LABEL: Record<PriceUnitKey, string> = {
  PER_PERSON: '每人',
  PER_PAIR: '每組（2 人）',
}
export function seatsPerUnit(unit: PriceUnitKey): number {
  return unit === 'PER_PAIR' ? 2 : 1
}

/** 報名狀態（依時間與名額即時計算，不依賴排程更新的欄位） */
export type SignupState = 'OPEN' | 'FULL' | 'NOT_OPEN' | 'CLOSED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELLED'

export const SIGNUP_STATE_LABEL: Record<SignupState, string> = {
  OPEN: '報名中',
  FULL: '已額滿',
  NOT_OPEN: '尚未開放報名',
  CLOSED: '報名已截止',
  IN_PROGRESS: '進行中',
  ENDED: '已結束',
  CANCELLED: '已取消',
}

/** 「19:00–21:00」；跨午夜顯示「23:00–翌日 01:00」 */
export function activityTimeLabel(startMinute: number, endMinute: number): string {
  const s = startMinute >= 1440 ? `翌日 ${formatMinute(startMinute)}` : formatMinute(startMinute)
  const e = endMinute > 1440 ? `翌日 ${formatMinute(endMinute)}` : formatMinute(endMinute)
  return `${s}–${e}`
}

/** 「10/13（二）」 */
export function shortDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number)
  return `${m}/${d}（${WEEKDAY_LABELS[taipeiWeekday(dateStr)].slice(1)}）`
}

export interface ActivityCover {
  /** 上傳圖片的網址；null 時使用品牌預設封面 */
  src: string | null
  thumb: string | null
  focusX: number
  focusY: number
}

/** 前台顯示一個場次所需的資料 */
export interface ActivitySessionDTO {
  id: string
  activityId: string | null
  title: string
  type: ActivityTypeKey
  typeLabel: string
  levelLabel: string | null
  summary: string | null
  description: string | null
  requirements: string | null
  includes: string | null
  refundNote: string | null
  cover: ActivityCover
  date: string
  dateLabel: string
  startMinute: number
  endMinute: number
  timeLabel: string
  startAt: string
  endAt: string
  courtIds: string[]
  courtNames: string[]
  price: number
  priceUnit: PriceUnitKey
  unitLabel: string
  seatsPerUnit: number
  /** 一般報名可用的總名額（人） */
  capacity: number
  /** 剩餘名額（人）＝總名額 −（已確認＋未到期暫留） */
  remaining: number
  /** 這一筆最多可選幾個單位 */
  maxQuantity: number
  state: SignupState
  stateLabel: string
  /** 尚未開放時的開放時間文字，例如「10/6（一）13:00 開放報名」 */
  opensAtLabel: string | null
  closesAtLabel: string
  /** 目前登入者在這場的狀態 */
  mine: { status: 'IN_CART' | 'PENDING_PAYMENT' | 'CONFIRMED'; quantity: number; bookingId: string | null } | null
  watching: boolean
}

/** 活動卡片（週期活動合併成一張，列出近期可報名日期） */
export interface ActivityCardDTO {
  key: string
  activityId: string | null
  title: string
  type: ActivityTypeKey
  typeLabel: string
  levelLabel: string | null
  summary: string | null
  cover: ActivityCover
  sessions: ActivitySessionDTO[]
}

export /** 活動卡片：同一活動（系列）合併，列出近期場次 */
function groupIntoCards(sessions: ActivitySessionDTO[], perCard = 8): ActivityCardDTO[] {
  const map = new Map<string, ActivityCardDTO>()
  for (const s of sessions) {
    const key = s.activityId ?? `session:${s.id}`
    const card = map.get(key)
    if (card) {
      if (card.sessions.length < perCard) card.sessions.push(s)
      continue
    }
    map.set(key, {
      key,
      activityId: s.activityId,
      title: s.title,
      type: s.type,
      typeLabel: s.typeLabel,
      levelLabel: s.levelLabel,
      summary: s.summary ?? s.description,
      cover: s.cover,
      sessions: [s],
    })
  }
  return [...map.values()]
}

/* ─────────────────────────── 重複規則 ─────────────────────────── */

/** 一次最多建立的場次數，避免無上限產生資料 */
export const MAX_OCCURRENCES = 60
/** 系列最長跨度（天） */
export const MAX_SERIES_DAYS = 366

export interface RecurrenceRule {
  repeatKind: 'ONCE' | 'WEEKLY'
  /** 0=週日 … 6=週六 */
  weekdays: number[]
  intervalWeeks: number
  seriesStartDate: string
  seriesEndDate: string | null
  occurrenceCount: number | null
  skipDates: string[]
}

export interface OccurrencePlan {
  /** 依規則產生且未略過的日期 */
  dates: string[]
  /** 落在規則上、但被「跳過指定日期」排除的日期 */
  skipped: string[]
  error: string | null
}

/**
 * 依重複規則列出日期。
 * WEEKLY：以開始日期所在週（週日起算）為第 0 週，每隔 intervalWeeks 週的指定星期各一場；
 * 必須設定結束日期或重複次數。重複次數包含被跳過的日期（跳過不會自動往後補）。
 */
export function planOccurrences(rule: RecurrenceRule): OccurrencePlan {
  const skip = new Set(rule.skipDates)
  if (rule.repeatKind === 'ONCE') {
    if (skip.has(rule.seriesStartDate)) return { dates: [], skipped: [rule.seriesStartDate], error: null }
    return { dates: [rule.seriesStartDate], skipped: [], error: null }
  }

  const weekdays = [...new Set(rule.weekdays)].filter((d) => d >= 0 && d <= 6).sort()
  if (weekdays.length === 0) return { dates: [], skipped: [], error: '請選擇每週的星期' }
  if (!rule.seriesEndDate && !rule.occurrenceCount) return { dates: [], skipped: [], error: '請設定系列結束日期或重複次數' }
  const interval = Math.max(1, Math.min(8, Math.floor(rule.intervalWeeks || 1)))
  if (rule.seriesEndDate && diffDays(rule.seriesStartDate, rule.seriesEndDate) < 0) {
    return { dates: [], skipped: [], error: '結束日期不能早於開始日期' }
  }

  const anchorSunday = addDays(rule.seriesStartDate, -taipeiWeekday(rule.seriesStartDate))
  const dates: string[] = []
  const skipped: string[] = []
  let matched = 0

  for (let i = 0; i <= MAX_SERIES_DAYS; i++) {
    const d = addDays(rule.seriesStartDate, i)
    if (rule.seriesEndDate && diffDays(rule.seriesEndDate, d) > 0) break
    if (rule.occurrenceCount && matched >= rule.occurrenceCount) break
    const week = Math.floor(diffDays(anchorSunday, d) / 7)
    if (week % interval !== 0 || !weekdays.includes(taipeiWeekday(d))) continue
    matched++
    if (skip.has(d)) skipped.push(d)
    else dates.push(d)
    if (dates.length > MAX_OCCURRENCES) {
      return { dates: [], skipped: [], error: `一次最多建立 ${MAX_OCCURRENCES} 場，請縮短系列範圍或分批建立` }
    }
  }
  return { dates, skipped, error: null }
}

export function parseWeekdayList(s: string): number[] {
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
}

export function parseIdList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function describeRule(rule: Pick<RecurrenceRule, 'repeatKind' | 'weekdays' | 'intervalWeeks'>): string {
  if (rule.repeatKind === 'ONCE') return '單次活動'
  const days = [...rule.weekdays].sort().map((d) => WEEKDAY_LABELS[d].slice(1)).join('、')
  return rule.intervalWeeks > 1 ? `每 ${rule.intervalWeeks} 週的週${days}` : `每週${days}`
}
