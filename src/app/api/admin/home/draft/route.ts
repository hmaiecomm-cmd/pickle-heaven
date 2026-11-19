import { NextRequest, NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const body = await request.json()
    console.log('[home/draft] 接收到數據:', JSON.stringify(body).substring(0, 200))

    // Phase 1: 處理教練資料
    if (body.sections?.coaching?.coaches && Array.isArray(body.sections.coaching.coaches)) {
      for (const coach of body.sections.coaching.coaches) {
        // 檢查教練是否已存在
        const existing = await prisma.coach.findUnique({
          where: { id: coach.id }
        }).catch(() => null)

        if (existing) {
          // 更新現有教練
          await prisma.coach.update({
            where: { id: coach.id },
            data: {
              name: coach.name,
              bio: coach.bio || null,
              hourlyRate: coach.hourlyRate,
              specialties: coach.specialties,
            }
          })
        } else {
          // 新建教練
          await prisma.coach.create({
            data: {
              id: coach.id,
              name: coach.name,
              bio: coach.bio || null,
              hourlyRate: coach.hourlyRate,
              specialties: coach.specialties,
              status: 'ACTIVE'
            }
          })
        }
      }
    }

    // 儲存草稿設定
    const homePageConfig = await prisma.homePageConfig.findFirst()
    if (homePageConfig) {
      await prisma.homePageConfig.update({
        where: { id: homePageConfig.id },
        data: {
          draftConfig: JSON.stringify(body),
          draftUpdatedAt: new Date()
        }
      })
    } else {
      await prisma.homePageConfig.create({
        data: {
          draftConfig: JSON.stringify(body),
          theme: body.theme || 'PURPLE'
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: body,
      message: '草稿已儲存'
    })
  } catch (error) {
    console.error('[home/draft] 錯誤:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存失敗'
      },
      { status: 500 }
    )
  }
}
