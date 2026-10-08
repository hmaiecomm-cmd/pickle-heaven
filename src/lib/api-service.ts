// API 服務層 - 集中管理所有 API 呼叫
// Phase 1: 使用 MOCK 資料
// Phase 2: 替換為真實 API

import {
  Reservation,
  Event,
  Coach,
  Payment,
  Revenue,
  Invoice,
  Device,
  Expense,
  AIEvent,
  Member,
  MembershipTierRow,
  PriceRuleRow,
  SystemSettings,
  VenueSettingsPatch,
  AuditEntry,
  AiChatResult,
  AiActionPreview,
  SessionEvent,
  CoachInput,
  Court,
  FinancialSummary,
  RevenueByCourtByType,
} from './models'
import {
  MOCK_DATA,
  getDateRange,
  calculateFinancialMetrics,
  filterByDateRange,
} from './mock-data'

export interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: {
    page?: number
    pageSize?: number
    total?: number
    dateRange?: {
      from: string
      to: string
    }
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * 後台資料來源。已接資料庫的功能預設走真實 API（Phase 2）；
 * 設 NEXT_PUBLIC_ADMIN_SOURCE=mock 可整體退回 mock 資料（展示或離線開發用）。
 */
const ADMIN_LIVE = process.env.NEXT_PUBLIC_ADMIN_SOURCE !== 'mock'
const FINANCE_LIVE = ADMIN_LIVE

async function sendAdmin<T>(path: string, method: 'PATCH' | 'POST' | 'PUT' | 'DELETE', payload?: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => null)) as ApiResponse<T> | null
    if (!res.ok || !body?.success) {
      return {
        success: false,
        data: undefined as unknown as T,
        error: body?.error ?? { code: `HTTP_${res.status}`, message: res.status === 401 ? '請重新登入' : '伺服器錯誤' },
      }
    }
    return body
  } catch (error) {
    return { success: false, data: undefined as unknown as T, error: { code: 'NETWORK_ERROR', message: String(error) } }
  }
}

async function fetchAdmin<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' })
    const body = (await res.json().catch(() => null)) as ApiResponse<T> | null
    if (!res.ok || !body?.success) {
      return {
        success: false,
        data: undefined as unknown as T,
        error: body?.error ?? { code: `HTTP_${res.status}`, message: res.status === 401 ? '請重新登入' : '伺服器錯誤' },
      }
    }
    return body
  } catch (error) {
    return { success: false, data: undefined as unknown as T, error: { code: 'NETWORK_ERROR', message: String(error) } }
  }
}

/** JSON 的日期字串還原成 Date。 */
const toDate = (v: unknown): Date | undefined => (typeof v === 'string' ? new Date(v) : undefined)

const reviveInvoice = (i: Omit<Invoice, 'issueDate' | 'dueDate'> & { issueDate: string; dueDate: string }): Invoice => ({
  ...i,
  issueDate: toDate(i.issueDate) ?? new Date(),
  dueDate: toDate(i.dueDate) ?? new Date(),
})

// ============ RESERVATIONS ============
export async function getReservations(
  filters?: {
    type?: string
    status?: string
    courtId?: string
    dateRange?: 'today' | 'week' | 'month'
  },
): Promise<ApiResponse<Reservation[]>> {
  try {
    let reservations = [...MOCK_DATA.reservations]

    if (filters?.type) {
      reservations = reservations.filter((r) => r.type === filters.type)
    }
    if (filters?.status) {
      reservations = reservations.filter((r) => r.status === filters.status)
    }

    return {
      success: true,
      data: reservations,
      meta: {
        total: reservations.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ EVENTS ============
export async function getEvents(
  filters?: {
    status?: string
    type?: string
  },
): Promise<ApiResponse<Event[]>> {
  try {
    let events = [...MOCK_DATA.events]

    if (filters?.status) {
      events = events.filter((e) => e.status === filters.status)
    }

    return {
      success: true,
      data: events,
      meta: {
        total: events.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ COACHES ============
export async function getCoaches(
  filters?: {
    status?: string
  },
): Promise<ApiResponse<Coach[]>> {
  if (ADMIN_LIVE) {
    const res = await fetchAdmin<Coach[]>('/api/admin/coaches')
    if (!res.success) return { ...res, data: [] }
    return { ...res, data: filters?.status ? res.data.filter((c) => c.status === filters.status) : res.data }
  }
  try {
    let coaches = [...MOCK_DATA.coaches]

    if (filters?.status) {
      coaches = coaches.filter((c) => c.status === filters.status)
    }

    return {
      success: true,
      data: coaches,
      meta: {
        total: coaches.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ MEMBERS ============
export async function getMembers(): Promise<ApiResponse<Member[]>> {
  if (ADMIN_LIVE) {
    type Raw = Omit<Member, 'joinDate' | 'lastVisit' | 'recentBookings'> & { joinDate: string; lastVisit: string; recentBookings?: { code: string; name: string; amount: number; status: string; date: string }[] }
    const res = await fetchAdmin<Raw[]>('/api/admin/members')
    if (!res.success) return { ...res, data: [] }
    return {
      ...res,
      data: res.data.map((m) => ({
        ...m,
        joinDate: toDate(m.joinDate) ?? new Date(),
        lastVisit: toDate(m.lastVisit) ?? new Date(),
        recentBookings: m.recentBookings?.map((b) => ({ ...b, date: toDate(b.date) ?? new Date() })),
      })),
    }
  }
  try {
    return {
      success: true,
      data: MOCK_DATA.members,
      meta: {
        total: MOCK_DATA.members.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ COURTS ============
/** 調整會員等級（Phase 2）。 */
export async function updateMemberLevel(id: string, level: Member['membershipLevel']): Promise<ApiResponse<{ id: string; membershipLevel: Member['membershipLevel'] }>> {
  if (!ADMIN_LIVE) return { success: true, data: { id, membershipLevel: level } }
  return sendAdmin(`/api/admin/members/${encodeURIComponent(id)}/level`, 'PATCH', { level })
}

/** 定價資料：場地費率規則與會員折扣（Phase 2）。 */
export async function getPricing(): Promise<ApiResponse<{ priceRules: PriceRuleRow[]; tiers: MembershipTierRow[] }>> {
  if (!ADMIN_LIVE) {
    return {
      success: true,
      data: {
        priceRules: [],
        tiers: [
          { level: 'BASIC', label: '一般', discountPct: 0 },
          { level: 'PREMIUM', label: '進階', discountPct: 10 },
          { level: 'VIP', label: 'VIP', discountPct: 20 },
        ],
      },
    }
  }
  return fetchAdmin('/api/admin/pricing')
}

/** 更新會員折扣（Phase 2）。 */
export async function updateMembershipTiers(tiers: { level: MembershipTierRow['level']; discountPct: number }[]): Promise<ApiResponse<MembershipTierRow[]>> {
  if (!ADMIN_LIVE) return { success: true, data: tiers.map((t) => ({ ...t, label: t.level })) }
  return sendAdmin('/api/admin/pricing/tiers', 'PUT', { tiers })
}

/** 活動清單：直接使用球敘（Phase 2）。scope：upcoming 尚未結束、past 已結束、all。 */
export async function getSessionEvents(scope: 'upcoming' | 'past' | 'all' = 'upcoming'): Promise<ApiResponse<SessionEvent[]>> {
  type Raw = Omit<SessionEvent, 'startAt' | 'endAt' | 'bookingOpenAt' | 'bookingCloseAt'> & { startAt: string; endAt: string; bookingOpenAt: string; bookingCloseAt: string }
  const res = await fetchAdmin<Raw[]>(`/api/admin/events?scope=${scope}`)
  if (!res.success) return { ...res, data: [] }
  return {
    ...res,
    data: res.data.map((e) => ({
      ...e,
      startAt: new Date(e.startAt),
      endAt: new Date(e.endAt),
      bookingOpenAt: new Date(e.bookingOpenAt),
      bookingCloseAt: new Date(e.bookingCloseAt),
    })),
  }
}

/** 新增教練（Phase 2）。 */
export async function createCoach(input: CoachInput): Promise<ApiResponse<Coach>> {
  return sendAdmin('/api/admin/coaches', 'POST', input)
}

/** 修改教練（部分欄位；提供 availability 時整組取代）。 */
export async function updateCoach(id: string, patch: Partial<CoachInput>): Promise<ApiResponse<Coach>> {
  return sendAdmin(`/api/admin/coaches/${encodeURIComponent(id)}`, 'PATCH', patch)
}

/** AI 管理助理對話（Phase 2，伺服器端呼叫 Claude）。history 只含文字。 */
export async function postAdminChat(history: { role: 'user' | 'assistant'; text: string }[]): Promise<ApiResponse<AiChatResult>> {
  const res = await sendAdmin<Omit<AiChatResult, 'period'> & { period?: { from: string; to: string } }>('/api/admin/ai/chat', 'POST', { messages: history })
  if (!res.success) return { ...res, data: undefined as unknown as AiChatResult }
  const p = res.data.period
  return { ...res, data: { ...res.data, period: p ? { from: new Date(p.from), to: new Date(p.to) } : undefined } }
}

/** 記錄擁有者對 AI 操作預覽的決定（只寫稽核紀錄，不執行）。 */
export async function recordAiDecision(decision: 'confirm' | 'decline', action: AiActionPreview): Promise<ApiResponse<{ recorded: boolean; executed: boolean }>> {
  return sendAdmin('/api/admin/ai/actions', 'POST', { decision, action })
}

/** 系統設定：場館、金流與整合狀態、系統資訊、安全提醒（Phase 2）。 */
export async function getSettings(): Promise<ApiResponse<SystemSettings>> {
  return fetchAdmin<SystemSettings>('/api/admin/settings')
}

/** 更新場館設定（部分欄位）。 */
export async function updateVenueSettings(id: string, patch: VenueSettingsPatch): Promise<ApiResponse<{ id: string; changed: string[] }>> {
  return sendAdmin(`/api/admin/settings/venue/${encodeURIComponent(id)}`, 'PATCH', patch)
}

/** 稽核紀錄，新到舊。 */
export async function getAuditLogs(opts?: { limit?: number; before?: Date }): Promise<ApiResponse<AuditEntry[]>> {
  const p = new URLSearchParams()
  if (opts?.limit) p.set('limit', String(opts.limit))
  if (opts?.before) p.set('before', opts.before.toISOString())
  const q = p.toString() ? `?${p}` : ''
  const res = await fetchAdmin<Array<Omit<AuditEntry, 'createdAt'> & { createdAt: string }>>(`/api/admin/audit${q}`)
  return res.success ? { ...res, data: res.data.map((a) => ({ ...a, createdAt: toDate(a.createdAt) ?? new Date() })) } : { ...res, data: [] }
}

export async function getCourts(): Promise<ApiResponse<Court[]>> {
  if (ADMIN_LIVE) {
    const res = await fetchAdmin<Court[]>('/api/admin/courts')
    return res.success ? res : { ...res, data: [] }
  }
  try {
    return {
      success: true,
      data: MOCK_DATA.courts,
      meta: {
        total: MOCK_DATA.courts.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ PAYMENTS ============
export async function getPayments(
  filters?: {
    status?: string
  },
): Promise<ApiResponse<Payment[]>> {
  if (FINANCE_LIVE) {
    const q = filters?.status ? `?status=${encodeURIComponent(filters.status)}` : ''
    const res = await fetchAdmin<Array<Omit<Payment, 'paidAt' | 'createdAt'> & { paidAt?: string; createdAt: string }>>(`/api/admin/payments${q}`)
    if (!res.success) return { ...res, data: [] }
    return {
      ...res,
      data: res.data.map((p) => ({ ...p, paidAt: toDate(p.paidAt), createdAt: toDate(p.createdAt) ?? new Date() })),
    }
  }
  try {
    let payments = [...MOCK_DATA.payments]

    if (filters?.status) {
      payments = payments.filter((p) => p.status === filters.status)
    }

    return {
      success: true,
      data: payments,
      meta: {
        total: payments.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ REVENUE ============
export async function getRevenue(
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'month',
): Promise<ApiResponse<Revenue[]>> {
  if (FINANCE_LIVE) {
    const res = await fetchAdmin<Array<Omit<Revenue, 'date'> & { date: string }>>(`/api/admin/finance/revenue?range=${dateRange}`)
    if (!res.success) return { ...res, data: [] }
    return { ...res, data: res.data.map((r) => ({ ...r, date: toDate(r.date) ?? new Date() })) }
  }
  try {
    const range = getDateRange(dateRange)
    const revenues = filterByDateRange(MOCK_DATA.revenue, range.from, range.to)

    return {
      success: true,
      data: revenues,
      meta: {
        total: revenues.length,
        dateRange: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ FINANCIAL SUMMARY ============
export async function getFinancialSummary(
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' = 'month',
): Promise<ApiResponse<FinancialSummary>> {
  if (FINANCE_LIVE) {
    const res = await fetchAdmin<Omit<FinancialSummary, 'period'> & { period: { from: string; to: string } }>(`/api/admin/finance/summary?range=${dateRange}`)
    if (!res.success) {
      return {
        ...res,
        data: { period: { from: new Date(), to: new Date() }, grossRevenue: 0, expenses: 0, netRevenue: 0, operatingProfit: 0, profitMargin: 0 },
      }
    }
    return { ...res, data: { ...res.data, period: { from: new Date(res.data.period.from), to: new Date(res.data.period.to) } } }
  }
  try {
    const range = getDateRange(dateRange)
    const revenues = filterByDateRange(MOCK_DATA.revenue, range.from, range.to)
    const expenses = filterByDateRange(MOCK_DATA.expenses, range.from, range.to)

    const revenueAmounts = revenues.map((r) => r.amount)
    const expenseAmounts = expenses.map((e) => e.amount)

    const { totalExpenses, ...metrics } = calculateFinancialMetrics(revenueAmounts, expenseAmounts)

    return {
      success: true,
      data: {
        period: { from: range.from, to: range.to },
        expenses: totalExpenses,
        ...metrics,
      },
      meta: {
        dateRange: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      },
    }
  } catch (error) {
    return {
      success: false,
      data: {
        period: { from: new Date(), to: new Date() },
        grossRevenue: 0,
        expenses: 0,
        netRevenue: 0,
        operatingProfit: 0,
        profitMargin: 0,
      },
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ INVOICES ============
export async function getInvoices(
  filters?: {
    status?: string
  },
): Promise<ApiResponse<Invoice[]>> {
  if (ADMIN_LIVE) {
    const q = filters?.status ? `?status=${encodeURIComponent(filters.status)}` : ''
    const res = await fetchAdmin<Parameters<typeof reviveInvoice>[0][]>(`/api/admin/invoices${q}`)
    return res.success ? { ...res, data: res.data.map(reviveInvoice) } : { ...res, data: [] }
  }
  try {
    let invoices = [...MOCK_DATA.invoices]

    if (filters?.status) {
      invoices = invoices.filter((i) => i.status === filters.status)
    }

    return {
      success: true,
      data: invoices,
      meta: {
        total: invoices.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ RECEIPTS ============
/** 變更發票狀態（Phase 2）。 */
export async function updateInvoiceStatus(id: string, status: Invoice['status']): Promise<ApiResponse<Invoice>> {
  const res = await sendAdmin<Parameters<typeof reviveInvoice>[0]>(`/api/admin/invoices/${encodeURIComponent(id)}/status`, 'PATCH', { status })
  return res.success ? { ...res, data: reviveInvoice(res.data) } : { ...res, data: undefined as unknown as Invoice }
}

// ============ EXPENSES ============
/** 費用清單（擁有者財務頁用；資料來自「費用與收據」API，只取財務彙總需要的欄位） */
export async function getExpenses(): Promise<ApiResponse<Expense[]>> {
  const res = await fetchAdmin<Array<{ id: string; expenseNumber: string; category: Expense['category']; amount: number; status: Expense['status']; description: string; submittedAt: string; approvedAt: string | null; approvedBy: string | null }>>('/api/admin/expenses')
  if (!res.success) return { ...res, data: [] }
  return {
    ...res,
    data: res.data.map((e) => ({ id: e.id, expenseNumber: e.expenseNumber, category: e.category, amount: e.amount, status: e.status, description: e.description, submittedAt: toDate(e.submittedAt) ?? new Date(), approvedAt: toDate(e.approvedAt ?? undefined) ?? undefined, approvedBy: e.approvedBy ?? undefined })),
  }
}

// ============ DEVICES ============
/** 變更球場營運狀態（Phase 2，寫入資料庫與稽核紀錄）。 */
export async function updateCourtStatus(id: string, status: Court['status']): Promise<ApiResponse<{ id: string; status: Court['status']; active: boolean }>> {
  if (!ADMIN_LIVE) return { success: true, data: { id, status, active: status === 'ACTIVE' } }
  return sendAdmin(`/api/admin/courts/${encodeURIComponent(id)}/status`, 'PATCH', { status })
}

export async function getDevices(): Promise<ApiResponse<Device[]>> {
  if (ADMIN_LIVE) {
    const res = await fetchAdmin<Array<Omit<Device, 'lastSeen'> & { lastSeen: string }>>('/api/admin/devices')
    if (!res.success) return { ...res, data: [] }
    return { ...res, data: res.data.map((d) => ({ ...d, lastSeen: toDate(d.lastSeen) ?? new Date() })) }
  }
  try {
    return {
      success: true,
      data: MOCK_DATA.devices,
      meta: {
        total: MOCK_DATA.devices.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ AI EVENTS ============
export async function getAIEvents(): Promise<ApiResponse<AIEvent[]>> {
  try {
    return {
      success: true,
      data: MOCK_DATA.aiEvents,
      meta: {
        total: MOCK_DATA.aiEvents.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      data: [],
      error: {
        code: 'FETCH_ERROR',
        message: String(error),
      },
    }
  }
}

// ============ AI CHAT (Mock) ============
export async function postAIChat(message: string, context?: string): Promise<ApiResponse<string>> {
  // Mock AI responses
  const mockResponses: Record<string, string> = {
    default:
      '根據目前的數據分析，您的營收趨勢良好。建議可以考慮在淡季時推出優惠活動以增加預約率。',
    revenue: '本月營收較上月增長 15%，主要來自 Court 預約。Event 部分有下降趨勢，建議檢視活動定價。',
    occupancy: '球場使用率目前為 72%，較上周下降 5%。建議可推廣周日的教練課程以增加使用率。',
  }

  let response = mockResponses.default
  if (message.toLowerCase().includes('營收')) response = mockResponses.revenue
  if (message.toLowerCase().includes('使用率')) response = mockResponses.occupancy

  return {
    success: true,
    data: response,
    meta: {
      dateRange: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
    },
  }
}

// ============ DEVICE CONTROL (Mock) ============
export async function postDeviceAction(
  deviceId: string,
  action: string,
): Promise<ApiResponse<{ deviceId: string; action: string; success: boolean }>> {
  return {
    success: true,
    data: {
      deviceId,
      action,
      success: true,
    },
  }
}


