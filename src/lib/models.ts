// TypeScript 数据模型 - 集中定义所有业务对象

export type ReservationType = 'COURT' | 'EVENT' | 'COACH'
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'
export type CoachStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'WARNING'
export type AIEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Member {
  id: string
  name: string
  email: string
  phone: string
  membershipLevel: 'BASIC' | 'PREMIUM' | 'VIP'
  joinDate: Date
  lastVisit: Date
  totalSpent: number
  avatar?: string
  /** 真實 API 附帶 */
  bookingCount?: number
  points?: number
  recentBookings?: { code: string; name: string; amount: number; status: string; date: Date }[]
}

/** 場地費率規則（對應資料庫 PriceRule，前台計價用） */
export interface PriceRuleRow {
  id: string
  venueId: string
  venueName: string
  name: string
  kind: 'PEAK' | 'OFFPEAK'
  dayType: 'ALL' | 'WEEKDAY' | 'WEEKEND'
  startMinute: number
  endMinute: number
  price: number
  priority: number
}

/** 場館可編輯設定（對應資料庫 Venue） */
export interface VenueSettings {
  id: string
  name: string
  address: string
  phone: string
  description: string
  notice: string
  policy: string
  openMinute: number
  closeMinute: number
  slotMinutes: number
  bookAheadDays: number
  holdMinutes: number
  timezone: string
  active: boolean
}

export type VenueSettingsPatch = Partial<Pick<VenueSettings, 'name' | 'address' | 'phone' | 'description' | 'notice' | 'policy' | 'openMinute' | 'closeMinute' | 'bookAheadDays' | 'holdMinutes'>>

export interface SystemSettings {
  organization: { name: string } | null
  venues: VenueSettings[]
  payment: { provider: string; providerLabel: string; providers: { key: string; label: string; configured: boolean }[] }
  integrations: { key: string; label: string; configured: boolean }[]
  system: { environment: string; region: string | null; database: string; adminSource: 'live' | 'mock' }
  rules: { paymentWindowMinutes: number; refundPolicy: { window: string; ratio: string }[] }
  warnings: { level: 'danger' | 'warning'; message: string }[]
}

export interface AiActionPreview {
  actionType: string
  title: string
  items: string[]
  impact: string
}

export interface AiChatResult {
  reply: string
  period?: { from: Date; to: Date }
  sources: string[]
  notes: string[]
  actions: AiActionPreview[]
  toolsUsed: string[]
  model: string
  usage: { inputTokens: number; outputTokens: number }
  refused?: boolean
}

export interface AuditEntry {
  id: string
  actor: string
  action: string
  target?: string
  detail: Record<string, unknown> | null
  createdAt: Date
}

export interface MembershipTierRow {
  level: 'BASIC' | 'PREMIUM' | 'VIP'
  label: string
  discountPct: number
}

export interface Court {
  id: string
  name: string
  venueId: string
  capacity: number
  pricePerHour: number
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  /** 沒有對應裝置時為 undefined */
  lights?: DeviceStatus
  fans?: DeviceStatus
  door?: DeviceStatus
}

export interface ReservationItem {
  id: string
  courtId?: string
  eventId?: string
  coachId?: string
  type: ReservationType
  name: string
  startTime: Date
  endTime: Date
  price: number
  playerCount: number
}

export interface Reservation {
  id: string
  bookingCode: string
  memberId: string
  member?: Member
  items: ReservationItem[]
  type: ReservationType
  status: ReservationStatus
  paymentStatus: PaymentStatus
  totalAmount: number
  qrCode?: string
  checkedInAt?: Date
  createdAt: Date
  updatedAt: Date
  notes?: string
}

export interface Event {
  id: string
  name: string
  description: string
  venueId: string
  type: 'TOURNAMENT' | 'SOCIAL' | 'TRAINING' | 'OTHER'
  status: EventStatus
  startTime: Date
  endTime: Date
  courtId?: string
  capacity: number
  enrolled: number
  price: number
  image?: string
}

export interface Coach {
  id: string
  name: string
  email: string
  phone: string
  status: CoachStatus
  specialties: string[]
  hourlyRate: number
  availability: {
    dayOfWeek: number // 0-6
    startTime: string // HH:mm
    endTime: string // HH:mm
  }[]
  image?: string
  bio?: string
}

export type SessionEventStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'FULL' | 'LOCKED' | 'PLAYING' | 'COMPLETED' | 'CANCELLED'

/** 活動（直接使用球敘 Session） */
export interface SessionEvent {
  id: string
  title: string
  description: string
  startAt: Date
  endAt: Date
  bookingOpenAt: Date
  bookingCloseAt: Date
  capacity: number
  reservedCapacity: number
  confirmed: number
  waitlisted: number
  waitlistEnabled: boolean
  price: number
  status: SessionEventStatus
  venueName: string
  courtName: string | null
  templateTitle: string | null
  skillLevelMin: number | null
  skillLevelMax: number | null
}

export interface CoachSlotInput {
  dayOfWeek: number
  startMinute: number
  endMinute: number
}

export interface CoachInput {
  name: string
  phone: string
  email: string
  status: CoachStatus
  specialties: string[]
  hourlyRate: number
  bio: string
  availability: CoachSlotInput[]
}

export interface Payment {
  id: string
  reservationId: string
  amount: number
  status: PaymentStatus
  method: 'CREDIT_CARD' | 'LINE_PAY' | 'BANK_TRANSFER'
  transactionId?: string
  paidAt?: Date
  createdAt: Date
  /** 以下由真實 API 附帶，mock 資料沒有 */
  bookingCode?: string
  customerName?: string
  customerPhone?: string
  provider?: string
  failReason?: string
}

export interface Revenue {
  id: string
  date: Date
  courtId?: string
  /** 真實 API 附帶，避免以 id 對照 mock 球場 */
  courtName?: string
  type: ReservationType
  reservationId: string
  amount: number
  paymentMethod: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  memberId: string
  reservationId: string
  /** 真實 API 附帶 */
  memberName?: string
  bookingCode?: string
  issueDate: Date
  dueDate: Date
  amount: number
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  items: {
    description: string
    quantity: number
    unitPrice: number
    amount: number
  }[]
}

export interface Receipt {
  id: string
  receiptNumber: string
  paymentId: string
  amount: number
  issueDate: Date
  paymentMethod: string
  vendorName: string
  ocrData?: {
    status: 'DRAFT' | 'CONFIRMED'
    fields: Record<string, string>
    confidence: number
  }
}

export interface Expense {
  id: string
  expenseNumber: string
  category: 'MAINTENANCE' | 'SUPPLIES' | 'UTILITIES' | 'LABOR' | 'OTHER'
  amount: number
  status: ExpenseStatus
  submittedAt: Date
  approvedAt?: Date
  approvedBy?: string
  description: string
  receipt?: Receipt
  ocrData?: {
    status: 'DRAFT' | 'CONFIRMED'
    fields: Record<string, string>
  }
}

export interface Device {
  id: string
  name: string
  type: 'DOOR' | 'LIGHTS' | 'FANS' | 'CAMERA' | 'SPEAKER'
  courtId?: string
  status: DeviceStatus
  lastSeen: Date
  lastAction?: string
}

export interface AIEvent {
  id: string
  type: 'UNAUTHORIZED_ENTRY' | 'UNAUTHORIZED_USAGE' | 'NIGHT_INTRUSION' | 'DOOR_FORCED' | 'INVALID_QR' | 'CAMERA_OFFLINE' | 'DEVICE_OFFLINE' | 'PEOPLE_COUNT_MISMATCH'
  severity: AIEventSeverity
  courtId?: string
  description: string
  timestamp: Date
  resolved: boolean
  snapshot?: string
  detailedAnalysis?: string
}

export interface Session {
  id: string
  courtId: string
  startTime: Date
  endTime: Date
  playersDetected: number
  recording: {
    duration: number
    status: 'PENDING' | 'PROCESSING' | 'COMPLETE'
  }
}

export interface FinancialSummary {
  period: {
    from: Date
    to: Date
  }
  grossRevenue: number
  expenses: number
  netRevenue: number
  operatingProfit: number
  profitMargin: number // percentage
}

export interface RevenueByType {
  type: ReservationType
  amount: number
  count: number
  averagePrice: number
}

export interface RevenueByCourtByType {
  courtId: string
  courtName: string
  byType: RevenueByType[]
  total: number
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  dataSource?: string
  dataRange?: {
    from: Date
    to: Date
  }
}

export interface AISuggestion {
  id: string
  category: 'REVENUE' | 'OPERATIONS' | 'MAINTENANCE' | 'PRICING' | 'MEMBERSHIP'
  title: string
  description: string
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
  action?: string
  actionRequiresConfirm?: boolean
}
