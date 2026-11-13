import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { getAdminUser } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

interface ScheduleUpdatePayload {
  circuitId?: string
  circuitNumber?: string // 01-18 迴路號
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
    id?: string
    startMinute: number
    endMinute: number
    weekdays?: string
    note?: string
  }>
}

function validateTimeRange(startMinute: number, endMinute: number): { valid: boolean; error?: string } {
  if (startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) {
    return { valid: false, error: '時間必須在 00:00-23:59 之間' }
  }
  if (startMinute >= endMinute) {
    return { valid: false, error: '開啟時間必須早於關閉時間' }
  }
  return { valid: true }
}

// 檢測時間衝突
function detectTimeConflicts(
  newStart: number,
  newEnd: number,
  existingSlots: Array<{ startMinute: number; endMinute: number }>
): { hasConflict: boolean; conflicts: string[] } {
  const conflicts: string[] = []

  for (const slot of existingSlots) {
    // 檢測是否重疊
    if (!(newEnd <= slot.startMinute || newStart >= slot.endMinute)) {
      const existingTime = `${String(Math.floor(slot.startMinute / 60)).padStart(2, '0')}:${String(slot.startMinute % 60).padStart(2, '0')}-${String(Math.floor(slot.endMinute / 60)).padStart(2, '0')}:${String(slot.endMinute % 60).padStart(2, '0')}`
      conflicts.push(`與現有時段 ${existingTime} 衝突`)
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}

export async function POST(request: NextRequest) {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 權限檢查：只有 ADMIN 和 SUPERVISOR 可修改排程
  if ((ctx as any).role !== 'ADMIN' && (ctx as any).role !== 'SUPERVISOR') {
    return NextResponse.json({ error: '無權限修改排程設定' }, { status: 403 })
  }

  try {
    const payload: ScheduleUpdatePayload = await request.json()
    const user = await getAdminUser()
    const modifiedBy = (user as any)?.username || 'system'

    // 查詢迴路
    let circuit
    if (payload.circuitId) {
      circuit = await prisma.circuit.findUnique({
        where: { id: payload.circuitId },
      })
    } else if (payload.circuitNumber) {
      circuit = await prisma.circuit.findUnique({
        where: { circuitNumber: payload.circuitNumber },
      })
    }

    if (!circuit) {
      return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
    }

    const circuitId = circuit.id

    // 查詢舊的排程設定用於審計
    const oldSchedules = await prisma.circuitSchedule.findMany({
      where: {
        circuitId,
        category: payload.category,
      },
    })

    // 更新預約動態控制
    if (payload.category === 'RESERVATION_DYNAMIC' && payload.reservationControl) {
      await prisma.circuit.update({
        where: { id: circuitId },
        data: {
          reservationAdvanceMinutes: payload.reservationControl.advanceMinutes,
          reservationDelayMinutes: payload.reservationControl.delayMinutes,
        },
      })
    }

    // 更新營業時間或夜間控制
    if ((payload.category === 'OPERATING_HOURS' || payload.category === 'NIGHT_AMBIENT') && payload.operatingHours) {
      const validation = validateTimeRange(payload.operatingHours.startMinute, payload.operatingHours.endMinute)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      // 刪除舊的主排程記錄
      await prisma.circuitSchedule.deleteMany({
        where: {
          circuitId,
          category: payload.category,
          note: null, // 只刪除預設時段，保留自訂時段
        },
      })

      // 新增主排程記錄
      const newSchedule = await prisma.circuitSchedule.create({
        data: {
          circuitId,
          category: payload.category,
          startMinute: payload.operatingHours.startMinute,
          endMinute: payload.operatingHours.endMinute,
          weekdays: payload.operatingHours.weekdays,
          modifiedBy,
          enabled: true,
        },
      })

      // 記錄審計日誌
      await prisma.circuitScheduleAudit.create({
        data: {
          scheduleId: newSchedule.id,
          circuitNumber: payload.circuitNumber || circuit.circuitNumber,
          category: payload.category,
          operation: oldSchedules.length > 0 ? 'UPDATE' : 'CREATE',
          previousValue: oldSchedules.length > 0 ? JSON.parse(JSON.stringify(oldSchedules[0])) : null,
          newValue: JSON.parse(JSON.stringify(newSchedule)),
          modifiedBy,
        },
      })
    }

    // 更新自訂時段（如果有）
    if (payload.customSlots && payload.customSlots.length > 0) {
      // 先檢測衝突
      const existingSlots = oldSchedules
        .filter(s => s.note && s.startMinute !== null && s.endMinute !== null) // 只檢查自訂時段
        .map(s => ({ startMinute: s.startMinute!, endMinute: s.endMinute! }))

      for (const slot of payload.customSlots) {
        const validation = validateTimeRange(slot.startMinute, slot.endMinute)
        if (!validation.valid) {
          return NextResponse.json(
            { error: `自訂時段驗證失敗: ${validation.error}` },
            { status: 400 }
          )
        }

        // 檢測與其他自訂時段的衝突
        const otherSlots = existingSlots.filter((_, idx) => {
          if (slot.id) {
            const oldIdx = oldSchedules.findIndex(os => os.id === slot.id)
            return idx !== oldIdx
          }
          return true
        })
        const conflict = detectTimeConflicts(slot.startMinute, slot.endMinute, otherSlots)
        if (conflict.hasConflict) {
          return NextResponse.json(
            { error: `時段衝突: ${conflict.conflicts.join('、')}` },
            { status: 400 }
          )
        }

        if (slot.id) {
          // 更新現有時段
          await prisma.circuitSchedule.update({
            where: { id: slot.id },
            data: {
              startMinute: slot.startMinute,
              endMinute: slot.endMinute,
              weekdays: slot.weekdays || '0,1,2,3,4,5,6',
              note: slot.note,
              modifiedBy,
            },
          })
        } else {
          // 新增自訂時段
          await prisma.circuitSchedule.create({
            data: {
              circuitId,
              category: payload.category || 'OPERATING_HOURS',
              startMinute: slot.startMinute,
              endMinute: slot.endMinute,
              weekdays: slot.weekdays || '0,1,2,3,4,5,6',
              note: slot.note,
              modifiedBy,
              enabled: true,
            },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule settings saved successfully',
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
  const circuitNumber = request.nextUrl.searchParams.get('circuitNumber')
  const category = request.nextUrl.searchParams.get('category')

  if (!circuitId && !circuitNumber) {
    return NextResponse.json({ error: 'circuitId or circuitNumber required' }, { status: 400 })
  }

  try {
    let circuit
    if (circuitId) {
      circuit = await prisma.circuit.findUnique({
        where: { id: circuitId },
        select: {
          id: true,
          reservationAdvanceMinutes: true,
          reservationDelayMinutes: true,
          category: true,
          schedules: {
            where: category ? { category } : undefined,
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    } else if (circuitNumber) {
      circuit = await prisma.circuit.findUnique({
        where: { circuitNumber },
        select: {
          id: true,
          reservationAdvanceMinutes: true,
          reservationDelayMinutes: true,
          category: true,
          schedules: {
            where: category ? { category } : undefined,
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    }

    if (!circuit) {
      return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
    }

    return NextResponse.json(circuit)
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
