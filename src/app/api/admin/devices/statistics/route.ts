import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/devices/statistics
 * 获取异常统计数据（用于仪表板）
 *
 * 查询参数：
 * - days: 统计天数（预设 7）
 * - circuitId: 特定迴路（可选）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 90)
    const circuitId = searchParams.get('circuitId') || undefined

    const since = new Date()
    since.setDate(since.getDate() - days)

    // 基础查询条件
    const where: Record<string, any> = {
      occurredAt: { gte: since },
    }

    if (circuitId) {
      where.circuit = { circuitNumber: circuitId }
    }

    // 获取异常统计数据
    const [
      totalAnomalies,
      byStatus,
      bySeverity,
      byType,
      dailyTrend,
      topAffectedCircuits,
    ] = await Promise.all([
      // 总异常数
      prisma.deviceAnomaly.count({ where }),

      // 按状态分组
      prisma.deviceAnomaly.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),

      // 按严重程度分组
      prisma.deviceAnomaly.groupBy({
        by: ['severity'],
        where,
        _count: { id: true },
      }),

      // 按异常类型分组
      prisma.deviceAnomaly.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // 日期趋势
      prisma.deviceAnomaly.groupBy({
        by: ['occurredAt'],
        where,
        _count: { id: true },
      }),

      // 受影响最多的迴路
      circuitId
        ? []
        : prisma.deviceAnomaly.groupBy({
            by: ['circuitId'],
            where,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 5,
          }),
    ])

    // 格式化统计数据
    const statsData = {
      period: {
        since: since.toISOString(),
        until: new Date().toISOString(),
        days,
      },

      summary: {
        total: totalAnomalies,
        resolved: byStatus.find((s) => s.status === 'resolved')?._count.id || 0,
        acknowledged: byStatus.find((s) => s.status === 'acknowledged')?._count.id || 0,
        pending: byStatus.find((s) => s.status === 'pending')?._count.id || 0,
      },

      bySeverity: bySeverity.map((s) => ({
        severity: s.severity,
        count: s._count.id,
        percentage: ((s._count.id / totalAnomalies) * 100).toFixed(1),
      })),

      byType: byType.slice(0, 10).map((t) => ({
        type: t.type,
        count: t._count.id,
        percentage: ((t._count.id / totalAnomalies) * 100).toFixed(1),
      })),

      // 按日期聚合趋势
      dailyTrend: aggregateDailyTrend(dailyTrend, days),

      // 受影响的迴路
      topAffected:
        topAffectedCircuits.length > 0
          ? topAffectedCircuits.map((c) => ({
              circuitId: c.circuitId,
              anomalyCount: c._count.id,
            }))
          : [],
    }

    return NextResponse.json({
      success: true,
      data: statsData,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/admin/devices/statistics]', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}

/**
 * 聚合每日趋势（填充缺失日期）
 */
function aggregateDailyTrend(
  rawData: Array<{ occurredAt: Date; _count: { id: number } }>,
  days: number
) {
  const map = new Map<string, number>()

  // 用数据填充 map
  for (const item of rawData) {
    const date = item.occurredAt.toISOString().split('T')[0]
    map.set(date, (map.get(date) || 0) + item._count.id)
  }

  // 生成完整的日期范围
  const result = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    result.push({
      date: dateStr,
      count: map.get(dateStr) || 0,
    })
  }

  return result
}
