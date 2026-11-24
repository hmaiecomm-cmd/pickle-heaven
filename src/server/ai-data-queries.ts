import 'server-only'
import { prisma } from '@/lib/db'
import type { Permission } from '@/lib/admin-permissions'

/**
 * AI 助理的資料查詢函數 — Phase 3 擴展
 * 只支援唯讀查詢，所有結果都過濾敏感資訊
 */

export interface QueryResult {
  success: boolean
  data?: unknown
  error?: string
  note?: string
}

/**
 * 查詢最近的預約
 */
export async function queryRecentBookings(
  venueId: string,
  limit: number = 5,
  hasPermission: boolean = false
): Promise<QueryResult> {
  if (!hasPermission) {
    return { success: false, error: '沒有查詢預約的權限' }
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: { venueId },
      select: {
        id: true,
        code: true,
        playDate: true,
        status: true,
        contactName: true,
        total: true,
      },
      orderBy: { playDate: 'desc' },
      take: limit,
    })

    return {
      success: true,
      data: {
        count: bookings.length,
        bookings: bookings.map((b) => ({
          預約代碼: b.code,
          日期: b.playDate,
          狀態: b.status,
          客人: b.contactName,
          金額: b.total,
        })),
      },
      note: `查到 ${bookings.length} 筆預約`,
    }
  } catch (err) {
    return {
      success: false,
      error: `查詢失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
    }
  }
}

/**
 * 查詢場館摘要信息
 */
export async function queryVenueSummary(
  venueId: string,
  hasPermission: boolean = false
): Promise<QueryResult> {
  if (!hasPermission) {
    return { success: false, error: '沒有查詢場館信息的權限' }
  }

  try {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0]

    const bookingCount = await prisma.booking.count({
      where: { venueId },
    })

    const todayBooking = await prisma.booking.count({
      where: {
        venueId,
        playDate: dateStr,
      },
    })

    const totalRevenue = await prisma.booking.aggregate({
      where: { venueId, status: { in: ['COMPLETED', 'PAID'] } },
      _sum: { total: true },
    })

    return {
      success: true,
      data: {
        總預約數: bookingCount,
        今日預約: todayBooking,
        累計收入: totalRevenue._sum.total || 0,
      },
      note: '場館摘要信息已取得',
    }
  } catch (err) {
    return {
      success: false,
      error: `查詢失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
    }
  }
}

/**
 * 查詢活躍會員數（基於預約記錄）
 */
export async function queryMemberStats(
  venueId: string,
  hasPermission: boolean = false
): Promise<QueryResult> {
  if (!hasPermission) {
    return { success: false, error: '沒有查詢會員的權限' }
  }

  try {
    const activeMembers = await prisma.booking.findMany({
      where: { venueId },
      select: { userId: true },
      distinct: ['userId'],
      take: 100,
    })

    const totalBookings = await prisma.booking.count({
      where: { venueId },
    })

    return {
      success: true,
      data: {
        活躍會員數: activeMembers.length,
        總預約數: totalBookings,
        平均預約數: Math.round(totalBookings / Math.max(activeMembers.length, 1)),
      },
      note: '會員統計基於預約記錄',
    }
  } catch (err) {
    return {
      success: false,
      error: `查詢失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
    }
  }
}

/**
 * 查詢指定日期的預約狀態
 */
export async function queryBookingsByDate(
  venueId: string,
  dateStr: string,
  hasPermission: boolean = false
): Promise<QueryResult> {
  if (!hasPermission) {
    return { success: false, error: '沒有查詢預約的權限' }
  }

  // 簡單的日期驗證
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { success: false, error: '日期格式應為 YYYY-MM-DD' }
  }

  try {
    const bookings = await prisma.booking.findMany({
      where: { venueId, playDate: dateStr },
      select: {
        id: true,
        code: true,
        status: true,
        contactName: true,
        total: true,
      },
      orderBy: { playDate: 'asc' },
    })

    const statusSummary = {
      已完成: bookings.filter((b) => b.status === 'COMPLETED').length,
      待確認: bookings.filter((b) => b.status === 'PENDING').length,
      已取消: bookings.filter((b) => b.status === 'CANCELLED').length,
    }

    return {
      success: true,
      data: {
        日期: dateStr,
        總預約數: bookings.length,
        狀態統計: statusSummary,
        預約列表: bookings.slice(0, 5).map((b) => ({
          代碼: b.code,
          客人: b.contactName,
          金額: b.total,
          狀態: b.status,
        })),
      },
      note: `${dateStr} 共有 ${bookings.length} 筆預約`,
    }
  } catch (err) {
    return {
      success: false,
      error: `查詢失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
    }
  }
}
