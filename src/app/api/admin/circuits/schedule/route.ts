import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { circuitCommandBlocker } from '@/lib/circuit-guard'
import { CIRCUIT_DEFINITIONS, type CircuitNumber } from '@/lib/control-types'
import { CATEGORY_INFO } from '@/lib/venue-layout'

type Window = { startMinute: number; endMinute: number; weekdays?: string }
interface ScheduleUpdatePayload {
  circuitNumber?: string
  category?: string
  /** 營業時間迴路的主時段 */
  operatingHours?: Window
  /** 夜間迴路的主時段 */
  nightAmbience?: Window
  reservationControl?: { advanceMinutes: number; delayMinutes: number }
  /** 額外開啟時段；儲存時整組取代 */
  customSlots?: (Window & { note?: string })[]
}

const WEEKDAYS = /^[0-6](,[0-6])*$/
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function checkWindow(w: unknown, label: string): string | null {
  const x = w as Window
  if (!x || !Number.isInteger(x.startMinute) || !Number.isInteger(x.endMinute)) return `${label}格式錯誤`
  if (x.startMinute < 0 || x.startMinute > 1439 || x.endMinute < 1 || x.endMinute > 1440) return `${label}必須在 00:00–24:00 之間`
  if (x.startMinute >= x.endMinute) return `${label}開啟時間必須早於關閉時間`
  if (x.weekdays !== undefined && !WEEKDAYS.test(x.weekdays)) return `${label}星期格式錯誤`
  return null
}

/**
 * 儲存一個迴路「自己分類」的控制時間排程（整組取代並寫入稽核）。
 * 需要 device.automation；24 小時供電、預留、停用或不接受排程的迴路一律拒絕。
 */
export async function POST(request: NextRequest) {
  const ctx = await pagePermission('device.automation')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: '目前帳號沒有修改排程的權限' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as ScheduleUpdatePayload | null
  if (!payload?.circuitNumber) return NextResponse.json({ error: '缺少迴路編號' }, { status: 400 })
  const def = CIRCUIT_DEFINITIONS[payload.circuitNumber as CircuitNumber]
  const circuit = def ? await prisma.circuit.findUnique({ where: { circuitNumber: payload.circuitNumber } }) : null
  if (!def || !circuit) return NextResponse.json({ error: '找不到迴路' }, { status: 404 })

  const blocker = circuitCommandBlocker(circuit, 'SCHEDULE')
  if (blocker) return NextResponse.json({ error: blocker }, { status: 400 })
  const category = def.category
  if (payload.category && payload.category !== category) {
    return NextResponse.json({ error: `迴路 ${circuit.circuitNumber} 屬於「${CATEGORY_INFO[category].label}」，不可設定其他分類的排程` }, { status: 400 })
  }
  const modifiedBy = `admin:${ctx.username}`

  if (category === 'RESERVATION_DYNAMIC') {
    const r = payload.reservationControl
    if (!r || !Number.isInteger(r.advanceMinutes) || !Number.isInteger(r.delayMinutes) || r.advanceMinutes < 0 || r.advanceMinutes > 120 || r.delayMinutes < 0 || r.delayMinutes > 120) {
      return NextResponse.json({ error: '提前開啟與延遲關閉需為 0 到 120 的整數分鐘' }, { status: 400 })
    }
    if (payload.customSlots?.length) return NextResponse.json({ error: '預約動態控制不使用自訂時段' }, { status: 400 })
    await prisma.$transaction(async (tx) => {
      await tx.circuit.update({ where: { id: circuit.id }, data: { reservationAdvanceMinutes: r.advanceMinutes, reservationDelayMinutes: r.delayMinutes } })
      await tx.circuitScheduleAudit.create({
        data: {
          circuitNumber: circuit.circuitNumber,
          category,
          operation: 'UPDATE',
          previousValue: { advanceMinutes: circuit.reservationAdvanceMinutes, delayMinutes: circuit.reservationDelayMinutes },
          newValue: { advanceMinutes: r.advanceMinutes, delayMinutes: r.delayMinutes },
          modifiedBy,
        },
      })
    })
    return NextResponse.json({ success: true, message: '設定已保存' })
  }

  const main = category === 'OPERATING_HOURS' ? payload.operatingHours : payload.nightAmbience
  const mainErr = checkWindow(main, '主時段')
  if (mainErr) return NextResponse.json({ error: mainErr }, { status: 400 })
  const slots = payload.customSlots ?? []
  if (slots.length > 20) return NextResponse.json({ error: '自訂時段最多 20 個' }, { status: 400 })
  for (const [i, slot] of slots.entries()) {
    const err = checkWindow(slot, `自訂時段 ${i + 1} `)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    for (const other of slots.slice(0, i)) {
      if (slot.startMinute < other.endMinute && other.startMinute < slot.endMinute) {
        return NextResponse.json({ error: `自訂時段 ${hhmm(slot.startMinute)}–${hhmm(slot.endMinute)} 與 ${hhmm(other.startMinute)}–${hhmm(other.endMinute)} 重疊` }, { status: 400 })
      }
    }
  }

  const old = await prisma.circuitSchedule.findMany({ where: { circuitId: circuit.id, category } })
  const rows = [
    { startMinute: main!.startMinute, endMinute: main!.endMinute, weekdays: main!.weekdays ?? '0,1,2,3,4,5,6', note: null as string | null },
    ...slots.map((x) => ({ startMinute: x.startMinute, endMinute: x.endMinute, weekdays: x.weekdays ?? '0,1,2,3,4,5,6', note: (x.note ?? '').trim().slice(0, 60) || '自訂時段' })),
  ]
  await prisma.$transaction(async (tx) => {
    await tx.circuitSchedule.deleteMany({ where: { circuitId: circuit.id, category } })
    for (const r of rows) await tx.circuitSchedule.create({ data: { circuitId: circuit.id, category, ...r, enabled: true, modifiedBy } })
    await tx.circuitScheduleAudit.create({
      data: {
        circuitNumber: circuit.circuitNumber,
        category,
        operation: old.length > 0 ? 'UPDATE' : 'CREATE',
        previousValue: old.map((o) => ({ startMinute: o.startMinute, endMinute: o.endMinute, weekdays: o.weekdays, note: o.note })),
        newValue: rows,
        modifiedBy,
      },
    })
  })
  return NextResponse.json({ success: true, message: '設定已保存' })
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
