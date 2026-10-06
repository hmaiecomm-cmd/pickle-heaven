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
  Receipt,
  Expense,
  Device,
  AIEvent,
  Member,
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
export async function getCourts(): Promise<ApiResponse<Court[]>> {
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
export async function getReceipts(): Promise<ApiResponse<Receipt[]>> {
  try {
    return {
      success: true,
      data: MOCK_DATA.receipts,
      meta: {
        total: MOCK_DATA.receipts.length,
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

// ============ EXPENSES ============
export async function getExpenses(
  filters?: {
    category?: string
    status?: string
  },
): Promise<ApiResponse<Expense[]>> {
  try {
    let expenses = [...MOCK_DATA.expenses]

    if (filters?.category) {
      expenses = expenses.filter((e) => e.category === filters.category)
    }
    if (filters?.status) {
      expenses = expenses.filter((e) => e.status === filters.status)
    }

    return {
      success: true,
      data: expenses,
      meta: {
        total: expenses.length,
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

// ============ DEVICES ============
export async function getDevices(): Promise<ApiResponse<Device[]>> {
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

// ============ OCR SCAN (Mock) ============
export async function postOCRScan(
  file: File,
): Promise<ApiResponse<{ status: string; fields: Record<string, string> }>> {
  return {
    success: true,
    data: {
      status: 'DRAFT',
      fields: {
        date: new Date().toISOString().split('T')[0],
        amount: '5000',
        vendor: 'Mock Vendor',
        category: 'MAINTENANCE',
      },
    },
  }
}
