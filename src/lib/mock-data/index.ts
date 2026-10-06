// 模拟数据主入口 - SYSTEM_MODE=MOCK

import { mockCourts } from './courts'
import { mockMembers } from './members'
import { mockReservations } from './reservations'
import { mockEvents } from './events'
import { mockCoaches } from './coaches'
import { mockPayments } from './payments'
import { mockRevenue } from './revenue'
import { mockInvoices } from './invoices'
import { mockReceipts } from './receipts'
import { mockExpenses } from './expenses'
import { mockDevices } from './devices'
import { mockAIEvents } from './ai-events'

export const MOCK_DATA = {
  courts: mockCourts,
  members: mockMembers,
  reservations: mockReservations,
  events: mockEvents,
  coaches: mockCoaches,
  payments: mockPayments,
  revenue: mockRevenue,
  invoices: mockInvoices,
  receipts: mockReceipts,
  expenses: mockExpenses,
  devices: mockDevices,
  aiEvents: mockAIEvents,
}

// 辅助函数：按日期范围筛选
export function filterByDateRange<T extends { createdAt?: Date; date?: Date; submittedAt?: Date }>(
  items: T[],
  from: Date,
  to: Date,
): T[] {
  return items.filter((item) => {
    const itemDate = item.createdAt || item.date || item.submittedAt
    return itemDate && itemDate >= from && itemDate <= to
  })
}

// 辅助函数：获取今日、本周、本月的日期范围
export function getDateRange(range: 'today' | 'week' | 'month' | 'quarter' | 'year'): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)

  let from = new Date(now)

  switch (range) {
    case 'today':
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      break
    case 'week':
      const day = now.getDay()
      from.setDate(now.getDate() - day)
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      break
    case 'month':
      from.setDate(1)
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)
      break
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3)
      from.setMonth(quarter * 3, 1)
      from.setHours(0, 0, 0, 0)
      to.setMonth((quarter + 1) * 3, 0)
      to.setHours(23, 59, 59, 999)
      break
    case 'year':
      from.setMonth(0, 1)
      from.setHours(0, 0, 0, 0)
      to.setMonth(11, 31)
      to.setHours(23, 59, 59, 999)
      break
  }

  return { from, to }
}

// 辅助函数：计算财务指标
export function calculateFinancialMetrics(
  revenues: number[],
  expenses: number[],
): {
  grossRevenue: number
  totalExpenses: number
  netRevenue: number
  operatingProfit: number
  profitMargin: number
} {
  const grossRevenue = revenues.reduce((a, b) => a + b, 0)
  const totalExpenses = expenses.reduce((a, b) => a + b, 0)
  const netRevenue = grossRevenue - totalExpenses
  const operatingProfit = netRevenue // 简化版本，实际需要扣除其他成本
  const profitMargin = grossRevenue > 0 ? (operatingProfit / grossRevenue) * 100 : 0

  return {
    grossRevenue,
    totalExpenses,
    netRevenue,
    operatingProfit,
    profitMargin: Math.round(profitMargin * 100) / 100,
  }
}

export * from './courts'
export * from './members'
export * from './reservations'
export * from './events'
export * from './coaches'
export * from './payments'
export * from './revenue'
export * from './invoices'
export * from './receipts'
export * from './expenses'
export * from './devices'
export * from './ai-events'
