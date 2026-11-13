import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ruleId = request.nextUrl.searchParams.get('ruleId')
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

  try {
    const where = ruleId ? { ruleId } : {}

    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.automationLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })
  } catch (error) {
    console.error('Failed to fetch automation logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if ((ctx as any).role !== 'OWNER' && (ctx as any).role !== 'MANAGER') {
    return NextResponse.json({ error: '無權限記錄執行日誌' }, { status: 403 })
  }

  try {
    const payload = await request.json()

    const log = await prisma.automationLog.create({
      data: {
        ruleId: payload.ruleId,
        venueId: payload.venueId || 'default',
        triggeredAt: new Date(payload.triggeredAt || Date.now()),
        result: payload.result,
        action: payload.action,
        errorMessage: payload.errorMessage,
        affectedCircuits: payload.affectedCircuits,
      },
    })

    return NextResponse.json({ success: true, log }, { status: 201 })
  } catch (error) {
    console.error('Failed to create automation log:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
