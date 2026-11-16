import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

type Params = { circuit: string; id: string }

/**
 * POST /api/admin/devices/[circuit]/anomalies/[id]/resolve
 * 解決異常（標記為已解決）
 */
export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { circuit, id } = await params
    const body = await req.json()
    const { resolvedBy, notes } = body

    if (!resolvedBy) {
      return NextResponse.json(
        { success: false, error: '缺少 resolvedBy 字段' },
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

    if (anomaly.status === 'resolved') {
      return NextResponse.json(
        { success: false, error: '異常已被解決' },
        { status: 400 }
      )
    }

    // 更新異常狀態
    const updated = await prisma.deviceAnomaly.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedBy,
        resolvedAt: new Date(),
        notes: notes || anomaly.notes,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        resolvedBy: updated.resolvedBy,
        resolvedAt: updated.resolvedAt?.toISOString(),
        notes: updated.notes,
      },
    })
  } catch (error) {
    console.error('[POST /api/admin/devices/[circuit]/anomalies/[id]/resolve]', error)
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    )
  }
}
