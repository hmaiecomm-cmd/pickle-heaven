import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import type { DeviceHealth, AnomalyType } from '@/lib/device-health'
import { determineHealth } from '@/lib/device-health'

export const dynamic = 'force-dynamic'

type Params = { circuit: string }

/**
 * GET /api/admin/devices/[circuit]/anomalies
 * 獲取特定迴路的異常列表
 *
 * 查詢參數：
 * - status: pending | acknowledged | resolved
 * - severity: warning | error | critical
 * - limit: 分頁大小（預設 50）
 * - offset: 分頁偏移（預設 0）
 */
export async function GET(req: NextRequest, { params }: { params: Params }) {
  try {
    const { circuit } = params
    const { searchParams } = new URL(req.url)

    const status = searchParams.get('status') || undefined
    const severity = searchParams.get('severity') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500)
    const offset = parseInt(searchParams.get('offset') || '0')

    // 驗證迴路編號格式
    if (!/^\d{2}$/.test(circuit)) {
      return NextResponse.json(
        { success: false, error: '無效的迴路編號' },
        { status: 400 }
      )
    }

    // 查詢異常列表
    const where: Record<string, any> = {
      circuit: { circuitNumber: circuit },
    }

    if (status) where.status = status
    if (severity) where.severity = severity

    const [anomalies, total] = await Promise.all([
      prisma.deviceAnomaly.findMany({
        where,
        include: { circuit: true },
        orderBy: { occurredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.deviceAnomaly.count({ where }),
    ])

    // 計算健康狀態
    const health: DeviceHealth = determineHealth(
      anomalies.map((a) => ({
        id: a.id,
        circuitId: a.circuitId,
        type: a.type as AnomalyType,
        occurredAt: a.occurredAt,
        lastReportedAt: a.lastReportedAt,
        severity: a.severity as 'warning' | 'error' | 'critical',
        status: a.status as 'pending' | 'acknowledged' | 'resolved',
        acknowledgedBy: a.acknowledgedBy || undefined,
        acknowledgedAt: a.acknowledgedAt || undefined,
        resolvedBy: a.resolvedBy || undefined,
        resolvedAt: a.resolvedAt || undefined,
        notes: a.notes || undefined,
      }))
    )

    return NextResponse.json({
      success: true,
      data: {
        circuit,
        health,
        anomalyCount: anomalies.filter((a) => a.status === 'pending').length,
        anomalies: anomalies.map((a) => ({
          id: a.id,
          type: a.type,
          severity: a.severity,
          status: a.status,
          occurredAt: a.occurredAt.toISOString(),
          lastReportedAt: a.lastReportedAt.toISOString(),
          acknowledgedBy: a.acknowledgedBy,
          acknowledgedAt: a.acknowledgedAt?.toISOString(),
          resolvedBy: a.resolvedBy,
          resolvedAt: a.resolvedAt?.toISOString(),
          notes: a.notes,
        })),
        pagination: {
          limit,
          offset,
          total,
        },
        lastUpdated: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/devices/[circuit]/anomalies]', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
