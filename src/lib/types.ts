/** 前後端共用型別 */

/** 時段格狀態 */
export type SlotState =
  | 'AVAILABLE'     // 可預約
  | 'SELECTED'      // 已選取（自己的購物車）
  | 'HELD'          // 他人暫扣
  | 'BOOKED'        // 已預約
  | 'BLOCKED'       // 維護中
  | 'PAST'          // 已過時
  | 'CLOSED'        // 未開放

export const SLOT_STATE_LABEL: Record<SlotState, string> = {
  AVAILABLE: '可預約',
  SELECTED: '已選取',
  HELD: '他人暫扣',
  BOOKED: '已預約',
  BLOCKED: '維護中',
  PAST: '已過時',
  CLOSED: '未開放',
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
  }
  date: string
  courts: CourtDTO[]
  times: TimeRowDTO[]
  /** cells[timeIndex][courtIndex] */
  cells: SlotState[][]
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
}

export interface CartDTO {
  items: CartItemDTO[]
  subtotal: number
  /** 最早到期的暫扣時間，前端倒數用 */
  expiresAt: string | null
}

export interface SessionUser {
  id: string
  displayName: string
  pictureUrl: string | null
  phone: string | null
  points: number
  role: 'USER' | 'STAFF' | 'ADMIN'
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
