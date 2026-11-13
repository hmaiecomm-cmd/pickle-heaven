import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rule = await prisma.automationRule.findUnique({
      where: { id },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Failed to fetch automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if ((ctx as any).role !== 'OWNER' && (ctx as any).role !== 'MANAGER') {
    return NextResponse.json({ error: '無權限修改規則' }, { status: 403 })
  }

  try {
    const payload = await request.json()
    const user = (ctx as any).username || 'system'

    const rule = await prisma.automationRule.update({
      where: { id },
      data: {
        name: payload.name,
        enabled: payload.enabled,
        triggerType: payload.triggerType,
        triggerConfig:
          typeof payload.triggerConfig === 'string' ? payload.triggerConfig : JSON.stringify(payload.triggerConfig),
        circuitNumbers: payload.circuitNumbers,
        actionType: payload.actionType,
        actionConfig:
          typeof payload.actionConfig === 'string' ? payload.actionConfig : JSON.stringify(payload.actionConfig),
        priority: payload.priority,
        exceptDates: payload.exceptDates,
        weekdays: payload.weekdays,
        paused: payload.paused,
        pauseReason: payload.pauseReason,
        note: payload.note,
        modifiedBy: user,
      },
    })

    return NextResponse.json({ success: true, rule })
  } catch (error) {
    console.error('Failed to update automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if ((ctx as any).role !== 'OWNER' && (ctx as any).role !== 'MANAGER') {
    return NextResponse.json({ error: '無權限刪除規則' }, { status: 403 })
  }

  try {
    await prisma.automationRule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete automation rule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
