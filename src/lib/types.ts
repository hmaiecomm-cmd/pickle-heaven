/** 前後端共用型別 */
import type { ActivitySessionDTO } from './activity-shared'

/** 時段格狀態 */
export type SlotState =
  | 'AVAILABLE'     // 可預約
  | 'SELECTED'      // 已選取（自己的購物車）
  | 'HELD'          // 他人暫扣
  | 'BOOKED'        // 已預約
  | 'BLOCKED'       // 人工封場
  | 'MAINTENANCE'   // 清潔／維護排程封場
  | 'PAST'          // 已結束（今日已結束的時段整列隱藏，此狀態只在保險情況出現）
  | 'STARTED'       // 已開始、尚未結束：依預約截止規則不開放線上預約
  | 'CUTOFF'        // 尚未開始但已超過預約截止時間
  | 'CLOSED'        // 未開放
  | 'EVENT'         // 活動場次使用中（cellSessions 指向場次）
  | 'RESERVED'      // 場館保留（活動草稿保留等），不開放預約

export const SLOT_STATE_LABEL: Record<SlotState, string> = {
  AVAILABLE: '可預約',
  SELECTED: '已選取',
  HELD: '他人暫扣',
  BOOKED: '已預約',
  BLOCKED: '封場',
  MAINTENANCE: '清潔維護・暫不開放',
  PAST: '已結束',
  STARTED: '已開始',
  CUTOFF: '已截止',
  CLOSED: '未開放',
  EVENT: '活動場次',
  RESERVED: '活動占用・不開放租借',
}

export interface CourtDTO {
  id: string
  name: string
  indoor: boolean
  /// 室外球場是否有雨棚
  covered: boolean
  surface: string | null
}

/** 場地環境標籤：室內 / 室外・有棚 / 室外 */
export function courtEnvLabel(court: { indoor: boolean; covered: boolean }): string {
  if (court.indoor) return '室內'
  return court.covered ? '室外・有棚' : '室外'
}

export interface TimeRowDTO {
  /** 自午夜起算分鐘 */
  start: number
  end: number
  /** "10:00–11:00" */
  label: string
  /** 尖峰 / 離峰 */
  rateName: string
  kind: 'PEAK' | 'OFFPEAK'
  price: number
  /** 跨午夜的時段（屬於前一天營業日），顯示時標示「翌日」 */
  nextDay: boolean
}

export interface AvailabilityDTO {
  venue: {
    id: string
    slug: string
    name: string
    address: string
    phone: string
    notice: string | null
    policy: string | null
    slotMinutes: number
    holdMinutes: number
    bookAheadDays: number
    /** 開打前幾分鐘截止線上預約 */
    bookingCutoffMinutes: number
  }
  date: string
  /** 伺服器時間（場館時區判斷用），前端以此為準，不依裝置時間 */
  serverNow: string
  /** 今日已結束而被整列隱藏的時段數 */
  hiddenEndedRows: number
  /** 這一天的時段全部結束 */
  allEnded: boolean
  /** 「查看明天」要切換的日期 */
  nextDate: string
  courts: CourtDTO[]
  times: TimeRowDTO[]
  /** cells[timeIndex][courtIndex] */
  cells: SlotState[][]
  /** EVENT 格對應的場次 id（其餘為 null），cellSessions[timeIndex][courtIndex] */
  cellSessions: (string | null)[][]
  /** 當日活動場次（含沒有佔用場地的場次） */
  events: ActivitySessionDTO[]
  /** 產生時間（ISO），前端用以判斷資料新鮮度 */
  generatedAt: string
}

/** 購物車項目（伺服器端暫扣後回傳） */
export interface CartItemDTO {
  reservationId: string
  courtId: string
  courtName: string
  date: string
  start: number
  end: number
  timeLabel: string
  rateName: string
  price: number
  /** 暫扣到期時間 ISO */
  expiresAt: string
  /** 已無法結帳的原因（已開始、已截止），有值時需移除才能結帳 */
  invalid: string | null
}

/** 購物車中的活動報名（已暫留名額） */
export interface CartActivityItemDTO {
  registrationId: string
  sessionId: string
  title: string
  typeLabel: string
  date: string
  dateLabel: string
  timeLabel: string
  courtNames: string[]
  quantity: number
  unitLabel: string
  unitPrice: number
  amount: number
  expiresAt: string
  invalid: string | null
}

export interface CartDTO {
  items: CartItemDTO[]
  activityItems: CartActivityItemDTO[]
  subtotal: number
  /** 最早到期的暫扣時間，前端倒數用 */
  expiresAt: string | null
  /** 已失效（已開始／已截止）的項目數，大於 0 時不能結帳 */
  invalidCount: number
}

export interface SessionUser {
  id: string
  displayName: string
  pictureUrl: string | null
  phone: string | null
  points: number
  role: 'USER' | 'STAFF' | 'ADMIN'
  /** 帳戶目前受限（黑名單）：可瀏覽與查看本人資料，不能新增預約、報名、消費 */
  restricted: boolean
}

export interface ApiError {
  error: string
  /** 機器可讀代碼，前端據此顯示對應處理 */
  code?:
    | 'UNAUTHORIZED'
    | 'SLOT_TAKEN'
    | 'HOLD_EXPIRED'
    | 'CART_EMPTY'
    | 'INVALID_INPUT'
    | 'NOT_FOUND'
    | 'PAYMENT_FAILED'
    | 'BOOKING_CLOSED'
  /** 被搶走的時段，前端可據此標紅 */
  conflicts?: { courtId: string; start: number }[]
}
