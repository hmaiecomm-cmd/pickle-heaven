import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const circuitNumber = request.nextUrl.searchParams.get('circuitNumber')
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

  if (!circuitNumber) {
    return NextResponse.json({ error: 'circuitNumber required' }, { status: 400 })
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.circuitScheduleAudit.findMany({
        where: { circuitNumber },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.circuitScheduleAudit.count({
        where: { circuitNumber },
      }),
    ])

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })
  } catch (error) {
    console.error('Audit log fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
