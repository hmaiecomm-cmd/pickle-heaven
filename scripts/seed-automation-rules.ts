import 'server-only'
import { prisma } from '@/lib/db'

export async function seedAutomationRules() {
  console.log('🌱 開始種子化自動化規則...')

  // 清除現有規則（開發環境）
  await prisma.automationRule.deleteMany({})
  await prisma.automationLog.deleteMany({})

  // 建立範例規則
  const rules = [
    {
      venueId: 'default',
      name: '預約結束後延遲關燈',
      enabled: false,
      triggerType: 'RESERVATION_END',
      triggerConfig: JSON.stringify({
        delayMinutes: 5,
        reservationTypes: ['BOOKED', 'EVENT'],
      }),
      circuitNumbers: '01,02,03,04',
      actionType: 'POWER_OFF',
      actionConfig: JSON.stringify({
        checkOccupancy: true,
        checkNextReservation: true,
      }),
      priority: 8,
      exceptDates: '',
      weekdays: '0,1,2,3,4,5,6',
      note: '預約結束 5 分鐘後自動關燈，如無其他預約',
      createdBy: 'system',
      modifiedBy: 'system',
    },
    {
      venueId: 'default',
      name: '營業時間外自動關燈',
      enabled: false,
      triggerType: 'TIME_BASED',
      triggerConfig: JSON.stringify({
        time: '22:30',
        circuits: ['05', '06', '07', '08', '09'],
      }),
      circuitNumbers: '05,06,07,08,09',
      actionType: 'POWER_OFF',
      actionConfig: JSON.stringify({
        verification: true,
      }),
      priority: 7,
      exceptDates: '',
      weekdays: '0,1,2,3,4,5,6',
      note: '每日 22:30 關閉營業區照明',
      createdBy: 'system',
      modifiedBy: 'system',
    },
    {
      venueId: 'default',
      name: '夜間環境自動啟動',
      enabled: false,
      triggerType: 'TIME_BASED',
      triggerConfig: JSON.stringify({
        time: '18:00',
        circuits: ['10', '11'],
      }),
      circuitNumbers: '10,11',
      actionType: 'POWER_ON',
      actionConfig: JSON.stringify({
        duration: 'until_closed',
      }),
      priority: 6,
      exceptDates: '',
      weekdays: '0,1,2,3,4,5,6',
      note: '晚間 18:00 啟動環境氣氛燈',
      createdBy: 'system',
      modifiedBy: 'system',
    },
    {
      venueId: 'default',
      name: '設備離線通知',
      enabled: false,
      triggerType: 'SENSOR',
      triggerConfig: JSON.stringify({
        sensor: 'device_offline',
        timeout: 300000,
      }),
      circuitNumbers: '01,02,03,04,05',
      actionType: 'NOTIFY_ADMIN',
      actionConfig: JSON.stringify({
        channels: ['email', 'line'],
        severity: 'high',
      }),
      priority: 9,
      exceptDates: '',
      weekdays: '0,1,2,3,4,5,6',
      note: '設備離線超過 5 分鐘自動通知管理員',
      createdBy: 'system',
      modifiedBy: 'system',
    },
  ]

  for (const rule of rules) {
    const created = await prisma.automationRule.create({
      data: rule,
    })
    console.log(`✅ 建立規則: ${created.name}`)
  }

  // 建立範例日誌
  const logs = [
    {
      ruleId: 'demo-rule-1',
      venueId: 'default',
      triggeredAt: new Date(Date.now() - 3600000),
      result: 'SUCCESS',
      action: '關閉迴路 01-04',
      affectedCircuits: '01,02,03,04',
    },
    {
      ruleId: 'demo-rule-2',
      venueId: 'default',
      triggeredAt: new Date(Date.now() - 7200000),
      result: 'SKIPPED',
      action: '關閉迴路 05-09',
      affectedCircuits: '05,06,07,08,09',
    },
  ]

  for (const log of logs) {
    await prisma.automationLog.create({
      data: log,
    })
  }

  console.log('🌱 種子化完成！')
}

// 執行
seedAutomationRules().catch(console.error)
