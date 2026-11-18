import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * 獲取活躍的公告
 * GET /api/marketing/announcements?page=HOMEPAGE
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || 'HOMEPAGE'
    const venueSlug = searchParams.get('venue')

    // 查詢活躍的公告
    const where: any = {
      active: true,
      deletedAt: null,
      displayPages: { in: [page, 'ALL'] },
    }

    // 如果指定場館，只查詢該場館的公告
    if (venueSlug) {
      const venue = await prisma.venue.findUnique({
        where: { slug: venueSlug },
        select: { id: true },
      })
      if (venue) {
        where.venueId = venue.id
      }
    }

    // 檢查時間範圍
    const now = new Date()
    const announcements = await prisma.announcement.findMany({
      where: {
        ...where,
        OR: [
          { startAt: null }, // 沒有設置開始時間
          { startAt: { lte: now } }, // 已開始
        ],
        AND: [
          {
            OR: [
              { endAt: null }, // 沒有設置結束時間
              { endAt: { gte: now } }, // 尚未結束
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        type: true,
        color: true,
        pinned: true,
        imageAssetId: true,
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    })

    return NextResponse.json({ data: announcements }, { status: 200 })
  } catch (error) {
    console.error('[marketing/announcements] 錯誤:', error)
    return NextResponse.json({ error: '無法獲取公告數據' }, { status: 500 })
  }
}
