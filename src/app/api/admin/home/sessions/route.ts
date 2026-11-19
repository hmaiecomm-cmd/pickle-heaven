import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { getUpcomingSessions } from '@/server/activity-service'
import { prisma } from '@/lib/db'

/**
 * 列出可用於首頁 OPEN PLAY 區塊的活動清單
 * 用於編輯器的活動選擇 UI
 */
export async function GET() {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    // 取得主要場館
    const venue = await prisma.venue.findFirst({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true }
    })

    if (!venue) {
      return NextResponse.json({ success: true, sessions: [] })
    }

    // 取得可用活動（往後 30 天）
    const sessions = await getUpcomingSessions(venue.id, null, { limit: 20 })

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        dateLabel: s.dateLabel,
        timeLabel: s.timeLabel,
        price: s.price,
        state: s.state,
        remaining: s.remaining,
        stateLabel: s.stateLabel,
      }))
    })
  } catch (error) {
    console.error('[home/sessions] 錯誤:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '取得清單失敗' },
      { status: 500 }
    )
  }
}
