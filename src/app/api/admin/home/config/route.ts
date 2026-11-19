import { NextResponse } from 'next/server'
import { getAdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import type { EditorState } from '@/app/admin/home/editor-types'

export async function GET() {
  try {
    const ctx = await getAdminContext()
    if (!ctx || !can(ctx.role, 'settings')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    // 取得或建立 HomePageConfig
    let config = await prisma.homePageConfig.findFirst()

    if (!config) {
      // 建立預設配置
      config = await prisma.homePageConfig.create({
        data: {
          draftConfig: JSON.stringify({
            theme: 'purple',
            hero: {
              title: '在森林裡，打出你的節奏。',
              subtitle: '大新店森林匹克球',
              description: '來大新店森林匹克球，享受揮拍的暢快，也享受相聚的時光。線上預約場地、報名球友集合場次。',
              buttonText: '立即預約',
              buttonLink: '/booking',
            },
            sections: {
              plans: { title: '今天，你想怎麼玩？', description: '揪朋友一起開打，或加入一場新的相遇。', visible: true, selectedSessionIds: [] },
              coaching: { title: '第一球，到下一個突破。', description: '找到適合你的練習節奏，讓每次上場都有新收穫。', visible: true, coaches: [] },
              story: { title: '森林裡的球場，生活裡的主場。', description: '揮拍、交流，也讓自己慢下來。', visible: true },
              visit: { title: '下一站，大新店森林匹克球。', description: '', visible: true },
              invite: { title: '下一場，約在森林裡。', description: '帶上想動一動的心情，來一場屬於你的匹克球時光。', visible: true },
            },
          } as EditorState),
          theme: 'PURPLE'
        }
      })
    }

    // 解析 draftConfig
    let draftConfig: EditorState
    try {
      draftConfig = JSON.parse(config.draftConfig)
    } catch {
      // 若無法解析，使用預設
      draftConfig = {
        theme: 'purple',
        hero: {
          title: '在森林裡，打出你的節奏。',
          subtitle: '大新店森林匹克球',
          description: '來大新店森林匹克球，享受揮拍的暢快，也享受相聚的時光。線上預約場地、報名球友集合場次。',
          buttonText: '立即預約',
          buttonLink: '/booking',
        },
        sections: {
          plans: { title: '今天，你想怎麼玩？', description: '揪朋友一起開打，或加入一場新的相遇。', visible: true, selectedSessionIds: [] },
          coaching: { title: '第一球，到下一個突破。', description: '找到適合你的練習節奏，讓每次上場都有新收穫。', visible: true, coaches: [] },
          story: { title: '森林裡的球場，生活裡的主場。', description: '揮拍、交流，也讓自己慢下來。', visible: true },
          visit: { title: '下一站，大新店森林匹克球。', description: '', visible: true },
          invite: { title: '下一場，約在森林裡。', description: '帶上想動一動的心情，來一場屬於你的匹克球時光。', visible: true },
        },
      }
    }

    // 若 coaching.coaches 為空，補上現有教練
    if (draftConfig.sections.coaching.coaches.length === 0) {
      const coaches = await prisma.coach.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { name: 'asc' }
      })
      draftConfig.sections.coaching.coaches = coaches.map(c => ({
        id: c.id,
        name: c.name,
        specialties: (Array.isArray(c.specialties) ? c.specialties : []) as string[],
        bio: c.bio || '',
        hourlyRate: c.hourlyRate,
        photoId: undefined
      }))
    }

    return NextResponse.json({ success: true, data: draftConfig })
  } catch (error) {
    console.error('[home/config] 錯誤:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得配置失敗' },
      { status: 500 }
    )
  }
}
