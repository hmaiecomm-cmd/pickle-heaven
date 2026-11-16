import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { circuit: string; id: string }

/**
 * POST /api/admin/devices/[circuit]/anomalies/[id]/acknowledge
 * 確認異常（標記為已確認）
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { circuit, id } = params
    const body = await req.json()
    const { acknowledgedBy, notes } = body

    if (!acknowledgedBy) {
      return NextResponse.json(
        { success: false, error: '缺少 acknowledgedBy 字段' },
        { status: 400 }
      )
    }

    // 查詢異常並驗證迴路編號
    const anomaly = await prisma.deviceAnomaly.findFirst({
      where: {
        id,
        circuit: { circuitNumber: circuit },
      },
    })

    if (!anomaly) {
      return NextResponse.json(
        { success: false, error: '異常不存在' },
        { status: 404 }
      )
    }

    if (anomaly.status === 'acknowledged') {
      return NextResponse.json(
        { success: false, error: '異常已被確認' },
        { status: 400 }
      )
    }

    // 更新異常狀態
    const updated = await prisma.deviceAnomaly.update({
      where: { id },
      data: {
        status: 'acknowledged',
        acknowledgedBy,
        acknowledgedAt: new Date(),
        notes: notes || anomaly.notes,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        acknowledgedBy: updated.acknowledgedBy,
        acknowledgedAt: updated.acknowledgedAt?.toISOString(),
        notes: updated.notes,
      },
    })
  } catch (error) {
    console.error('[POST /api/admin/devices/[circuit]/anomalies/[id]/acknowledge]', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
