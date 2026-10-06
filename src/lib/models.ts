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
}

export interface Court {
  id: string
  name: string
  venueId: string
  capacity: number
  pricePerHour: number
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  lights: DeviceStatus
  fans: DeviceStatus
  door: DeviceStatus
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
}

export interface Revenue {
  id: string
  date: Date
  courtId?: string
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
