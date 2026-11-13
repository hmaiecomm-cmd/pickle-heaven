import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'

interface PreviewPayload {
  circuitNumber: string
  category: string
  operatingHours?: {
    startMinute: number
    endMinute: number
    weekdays: string
  }
  customSlots?: Array<{
    startMinute: number
    endMinute: number
    weekdays?: string
  }>
}

export async function POST(request: NextRequest) {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const payload: PreviewPayload = await request.json()

    // 模擬下週 7 天的排程執行
    const preview: Array<{
      date: string
      dayOfWeek: string
      activeHours: Array<{ start: string; end: string }>
    }> = []

    const today = new Date()
    const weekdays = payload.operatingHours?.weekdays?.split(',').map(Number) || [0, 1, 2, 3, 4, 5, 6]

    // 顯示接下來 7 天
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)

      const dayOfWeek = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()]
      const dateStr = date.toISOString().split('T')[0]

      const activeHours: Array<{ start: string; end: string }> = []

      // 檢查該天是否在適用範圍內
      if (weekdays.includes(date.getDay())) {
        // 新增預設時段
        if (payload.operatingHours) {
          const startHour = Math.floor(payload.operatingHours.startMinute / 60)
          const startMin = payload.operatingHours.startMinute % 60
          const endHour = Math.floor(payload.operatingHours.endMinute / 60)
          const endMin = payload.operatingHours.endMinute % 60

          activeHours.push({
            start: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
            end: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
          })
        }

        // 新增自訂時段
        if (payload.customSlots) {
          for (const slot of payload.customSlots) {
            const slotWeekdays = (slot.weekdays || '0,1,2,3,4,5,6').split(',').map(Number)
            if (slotWeekdays.includes(date.getDay())) {
              const startHour = Math.floor(slot.startMinute / 60)
              const startMin = slot.startMinute % 60
              const endHour = Math.floor(slot.endMinute / 60)
              const endMin = slot.endMinute % 60

              activeHours.push({
                start: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
                end: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
              })
            }
          }
        }
      }

      preview.push({
        date: dateStr,
        dayOfWeek,
        activeHours: activeHours.sort((a, b) => a.start.localeCompare(b.start)),
      })
    }

    return NextResponse.json({
      circuit: payload.circuitNumber,
      category: payload.category,
      preview,
      note: '這是預覽模式，顯示接下來 7 天的排程執行情況',
    })
  } catch (error) {
    console.error('Schedule preview error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
