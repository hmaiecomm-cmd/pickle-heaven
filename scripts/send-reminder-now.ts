import { prisma } from '../src/lib/db'
import { sendDueReminders } from '../src/server/booking-reminders'
import { pushMessages } from '../src/lib/line'

async function main() {
  // 查詢預約
  const booking = await prisma.booking.findFirst({
    where: { code: 'PH-20261106-RWVA' },
    include: {
      user: true,
      venue: true,
      items: true,
      activityItems: true,
    },
  })

  if (!booking) {
    console.error('找不到預約：PH-20261106-RWVA')
    return
  }

  console.log('✅ 找到預約：', {
    編號: booking.code,
    會員: booking.user.displayName,
    LineId: booking.user.lineUserId,
    狀態: booking.status,
  })

  // 發送所有到期的提醒
  const result = await sendDueReminders()
  console.log('\n📤 提醒發送結果：', result)

  // 查詢通知記錄
  const logs = await prisma.notificationLog.findMany({
    where: { userId: booking.userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  console.log('\n📋 通知記錄：')
  for (const log of logs) {
    console.log({
      類型: log.type,
      去重鍵: log.dedupeKey?.substring(0, 50),
      狀態: log.status,
      發送時間: log.sentAt,
      錯誤: log.error,
    })
  }
}

main().catch(console.error).finally(() => process.exit(0))
