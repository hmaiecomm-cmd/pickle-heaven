import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rules = await prisma.automationRule.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('Failed to fetch automation rules:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if ((ctx as any).role !== 'OWNER' && (ctx as any).role !== 'MANAGER') {
    return NextResponse.json({ error: '無權限創建規則' }, { status: 403 })
  }

  try {
    const payload = await request.json()
    const user = (ctx as any).username || 'system'

    // 驗證必要欄位
    if (!payload.name || !payload.triggerType || !payload.circuitNumbers || !payload.actionType) {
      return NextResponse.json(
        { error: '缺少必要欄位：name, triggerType, circuitNumbers, actionType' },
        { status: 400 }
      )
    }

    const rule = await prisma.automationRule.create({
      data: {
        venueId: payload.venueId || 'default',
        name: payload.name,
        enabled: payload.enabled || false,
        triggerType: payload.triggerType,
        triggerConfig: typeof payload.triggerConfig === 'string' ? payload.triggerConfig : JSON.stringify(payload.triggerConfig || {}),
        circuitNumbers: payload.circuitNumbers,
        actionType: payload.actionType,
        actionConfig: typeof payload.actionConfig === 'string' ? payload.actionConfig : JSON.stringify(payload.actionConfig || {}),
        priority: payload.priority || 5,
        exceptDates: payload.exceptDates,
        weekdays: payload.weekdays || '0,1,2,3,4,5,6',
        note: payload.note,
        createdBy: user,
        modifiedBy: user,
      },
    })

    return NextResponse.json({ success: true, rule }, { status: 201 })
  } catch (error) {
    console.error('Failed to create automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
