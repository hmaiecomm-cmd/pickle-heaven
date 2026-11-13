import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

interface ScheduleUpdatePayload {
  circuitId: string
  category: string
  operatingHours?: {
    startMinute: number
    endMinute: number
    weekdays: string
  }
  nightAmbience?: {
    startMinute: number
    endMinute: number
    weekdays: string
  }
  reservationControl?: {
    advanceMinutes: number
    delayMinutes: number
  }
  customSlots?: Array<{
    startMinute: number
    endMinute: number
    weekdays?: string
    note?: string
  }>
}

export async function POST(request: NextRequest) {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const payload: ScheduleUpdatePayload = await request.json()

    // 根據分類更新 Circuit 記錄
    const circuit = await prisma.circuit.findUnique({
      where: { id: payload.circuitId },
    })

    if (!circuit) {
      return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
    }

    // 更新預約相關的字段
    if (payload.category === 'RESERVATION_DYNAMIC' && payload.reservationControl) {
      await prisma.circuit.update({
        where: { id: payload.circuitId },
        data: {
          reservationAdvanceMinutes: payload.reservationControl.advanceMinutes,
          reservationDelayMinutes: payload.reservationControl.delayMinutes,
        },
      })
    }

    // 注：營業時間、夜間排程的完整實現需要創建新的模型表
    // 目前在 Demo 模式下只保存了預約控制的數值

    return NextResponse.json({
      success: true,
      message: 'Schedule settings saved',
      circuit,
    })
  } catch (error) {
    console.error('Schedule update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const circuitId = request.nextUrl.searchParams.get('circuitId')
  if (!circuitId) {
    return NextResponse.json({ error: 'circuitId required' }, { status: 400 })
  }

  try {
    const circuit = await prisma.circuit.findUnique({
      where: { id: circuitId },
      select: {
        reservationAdvanceMinutes: true,
        reservationDelayMinutes: true,
        category: true,
      },
    })

    if (!circuit) {
      return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
    }

    return NextResponse.json(circuit)
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
