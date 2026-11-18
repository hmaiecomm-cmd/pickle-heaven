import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * 獲取活躍的行銷橫幕
 * GET /api/marketing/banners?page=HOMEPAGE
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || 'HOMEPAGE'
    const venueSlug = searchParams.get('venue')

    // 查詢活躍的橫幕
    const where: any = {
      active: true,
      deletedAt: null,
      displayPages: { in: [page, 'ALL'] },
    }

    // 如果指定場館，只查詢該場館的橫幕
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
    const banners = await prisma.marketingBanner.findMany({
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
        subtitle: true,
        description: true,
        imageAssetId: true,
        buttonText: true,
        buttonUrl: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    })

    return NextResponse.json({ data: banners }, { status: 200 })
  } catch (error) {
    console.error('[marketing/banners] 錯誤:', error)
    return NextResponse.json({ error: '無法獲取橫幕數據' }, { status: 500 })
  }
}
