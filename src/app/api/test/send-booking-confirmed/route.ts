import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { notifyBookingConfirmed, pushMessages } from '@/lib/line'
import { taipeiToUtc } from '@/lib/time'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 測試預約成功通知
 * GET /api/test/send-booking-confirmed?code=PH-20261107-UJQB
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code') || 'PH-20261107-UJQB'

  try {
    const booking = await prisma.booking.findFirst({
      where: { code },
      include: {
        user: true,
        venue: true,
        items: { where: { status: 'ACTIVE' }, orderBy: { startsAt: 'asc' } },
        activityItems: { where: { status: 'ACTIVE' }, orderBy: { startsAt: 'asc' } },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: '找不到預約' }, { status: 404 })
    }

    if (!booking.user.lineUserId) {
      return NextResponse.json({ error: '使用者沒有 LINE User ID' }, { status: 400 })
    }

    let results = {
      bookingCode: booking.code,
      lineUserId: booking.user.lineUserId,
      status: booking.status,
      total: booking.total,
      items: [] as { type: string; ok: boolean; message: string }[],
    }

    // 場地預約通知（Flex Message）
    if (booking.items.length > 0) {
      const ok = await notifyBookingConfirmed(booking.user.lineUserId, {
        bookingId: booking.id,
        code: booking.code,
        venueName: booking.venue.name,
        venueAddress: booking.venue.address,
        playDate: booking.playDate,
        total: booking.total,
        items: booking.items.map((it) => {
          const base = taipeiToUtc(booking.playDate, 0).getTime()
          return {
            courtName: it.courtName,
            startMinute: Math.round((it.startsAt.getTime() - base) / 60_000),
            endMinute: Math.round((it.endsAt.getTime() - base) / 60_000),
          }
        }),
      })
      results.items.push({
        type: '場地預約通知（Flex Message）',
        ok,
        message: ok ? '✅ 已發送' : '❌ 發送失敗',
      })
    }

    // 活動報名通知（文字訊息）
    if (booking.activityItems.length > 0) {
      const { taipeiDateString, activityTimeLabel } = await import('@/lib/time')
      const lines = booking.activityItems.map((it) => {
        const d = taipeiDateString(it.startsAt)
        const base = taipeiToUtc(d, 0).getTime()
        const s = Math.round((it.startsAt.getTime() - base) / 60_000)
        const e = Math.round((it.endsAt.getTime() - base) / 60_000)
        return `・${it.title} ${d} ${activityTimeLabel(s, e)} × ${it.quantity}`
      })
      const ok = await pushMessages(booking.user.lineUserId, [
        {
          type: 'text',
          text: `【${booking.venue.name}】活動報名完成（訂單 ${booking.code}）\n${lines.join('\n')}`,
        },
      ])
      results.items.push({
        type: '活動報名通知（文字訊息）',
        ok,
        message: ok ? '✅ 已發送' : '❌ 發送失敗',
      })
    }

    const allOk = results.items.every((i) => i.ok)
    return NextResponse.json({
      ok: allOk,
      results,
      message: allOk
        ? '✅ 所有通知已發送到 LINE'
        : '⚠️ 部分通知發送失敗（使用者可能未加好友或 LINE API 故障）',
    })
  } catch (err) {
    console.error('[test/send-booking-confirmed]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'UNKNOWN' },
      { status: 500 }
    )
  }
}
