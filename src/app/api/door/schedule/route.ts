import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, PermissionError } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import {
  createAccessSchedule,
  listAccessSchedules,
  getAccessSchedule,
  updateAccessSchedule,
  cancelAccessSchedule,
  DoorScheduleError,
} from '@/server/door-access-schedule-service'

/**
 * GET /api/door/schedule
 * 查詢排程清單
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission('access.remote')
    const doorId = req.nextUrl.searchParams.get('doorId')
    const status = req.nextUrl.searchParams.get('status') as string | null

    if (!doorId) {
      return NextResponse.json({ error: '缺少 doorId 參數' }, { status: 400 })
    }

    // 驗證用戶有權存取該場館
    const venue = await prisma.venue.findFirst({ where: { active: true }, select: { id: true } })
    if (!venue) {
      return NextResponse.json({ error: '場館不存在' }, { status: 404 })
    }

    const schedules = await listAccessSchedules(venue.id, doorId, {
      status: status as any,
    })

    return NextResponse.json(schedules)
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }
    console.error('[door-schedule] GET error:', err)
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 })
  }
}

/**
 * POST /api/door/schedule
 * 建立排程
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission('access.remote')
    const body = await req.json()

    const venue = await prisma.venue.findFirst({ where: { active: true }, select: { id: true } })
    if (!venue) {
      return NextResponse.json({ error: '場館不存在' }, { status: 404 })
    }

    const schedule = await createAccessSchedule({
      venueId: venue.id,
      doorId: body.doorId || 'main-entrance',
      scheduleName: body.scheduleName,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      reason: body.reason,
      notes: body.notes,
      createdBy: ctx.username,
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }
    if (err instanceof DoorScheduleError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[door-schedule] POST error:', err)
    return NextResponse.json({ error: '建立失敗' }, { status: 500 })
  }
}

/**
 * PUT /api/door/schedule/:id
 * 更新排程
 */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requirePermission('access.remote')
    const scheduleId = req.nextUrl.pathname.split('/').pop()
    const body = await req.json()

    if (!scheduleId) {
      return NextResponse.json({ error: '缺少排程 ID' }, { status: 400 })
    }

    const schedule = await updateAccessSchedule(scheduleId, body)
    return NextResponse.json(schedule)
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }
    if (err instanceof DoorScheduleError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[door-schedule] PUT error:', err)
    return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  }
}

/**
 * DELETE /api/door/schedule/:id
 * 取消排程
 */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requirePermission('access.remote')
    const scheduleId = req.nextUrl.pathname.split('/').pop()
    const { reason } = await req.json()

    if (!scheduleId) {
      return NextResponse.json({ error: '缺少排程 ID' }, { status: 400 })
    }

    const schedule = await cancelAccessSchedule(scheduleId, ctx.username, reason || '管理者取消')
    return NextResponse.json(schedule)
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }
    if (err instanceof DoorScheduleError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[door-schedule] DELETE error:', err)
    return NextResponse.json({ error: '取消失敗' }, { status: 500 })
  }
}
