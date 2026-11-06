import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { pushMessages } from '@/lib/line'
import { buildReminderText } from '@/server/booking-reminders'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code') || 'PH-20261107-UJQB'
  const kind = searchParams.get('kind') || 'DAY_BEFORE'

  try {
    const booking = await prisma.booking.findFirst({
      where: { code },
      include: { user: true, venue: true, items: { where: { status: 'ACTIVE' } } },
    })

    if (!booking) {
      return NextResponse.json({ error: '找不到預約' }, { status: 404 })
    }

    if (!booking.user.lineUserId) {
      return NextResponse.json({ error: '使用者沒有 LINE User ID' }, { status: 400 })
    }

    const lines = booking.items.map((it) => ({
      label: it.courtName,
      startsAt: it.startsAt,
      endsAt: it.endsAt,
    }))

    const text = buildReminderText(kind as any, {
      id: booking.id,
      code: booking.code,
      address: booking.venue.address,
    }, lines)

    const ok = await pushMessages(booking.user.lineUserId, [
      { type: 'text', text }
    ])

    return NextResponse.json({
      ok,
      message: ok ? '✅ 提醒已發送到 LINE' : '❌ 發送失敗',
      bookingCode: booking.code,
      lineUserId: booking.user.lineUserId,
      reminderText: text,
    })
  } catch (err) {
    console.error('[test/send-reminder]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'UNKNOWN' },
      { status: 500 }
    )
  }
}
