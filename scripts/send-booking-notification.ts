import { prisma } from '../src/lib/db'
import { notifyBookingConfirmed, pushMessages } from '../src/lib/line'
import { taipeiToUtc } from '../src/lib/time'
import { activityTimeLabel } from '../src/lib/activity-shared'

async function main() {
  // 查詢預約（可改成命令行參數）
  const bookingCode = process.argv[2] || 'PH-20261107-UJQB'

  const booking = await prisma.booking.findFirst({
    where: { code: bookingCode },
    include: {
      user: true,
      venue: true,
      items: { where: { status: 'ACTIVE' }, orderBy: { startsAt: 'asc' } },
      activityItems: { where: { status: 'ACTIVE' }, orderBy: { startsAt: 'asc' } },
    },
  })

  if (!booking) {
    console.error('❌ 找不到預約：', bookingCode)
    process.exit(1)
  }

  console.log('✅ 找到預約：', {
    編號: booking.code,
    會員: booking.user.displayName,
    LineId: booking.user.lineUserId,
    狀態: booking.status,
    訂單金額: booking.total,
  })

  if (!booking.user.lineUserId) {
    console.error('❌ 使用者沒有 LINE User ID')
    process.exit(1)
  }

  console.log('\n📤 開始發送預約成功通知...\n')

  let results = {
    items: [] as { type: string; ok: boolean; message?: string }[],
  }

  // 場地預約通知（Flex Message）
  if (booking.items.length > 0) {
    console.log('📬 發送場地預約通知（Flex Message）...')
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
      type: '場地預約',
      ok,
      message: ok ? '✅ Flex Message 已發送' : '❌ 發送失敗',
    })
    console.log(results.items[results.items.length - 1].message)
  }

  // 活動報名通知（文字訊息）
  if (booking.activityItems.length > 0) {
    console.log('\n📬 發送活動報名通知（文字訊息）...')
    const { taipeiDateString } = await import('../src/lib/time')
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
      type: '活動報名',
      ok,
      message: ok ? '✅ 文字訊息已發送' : '❌ 發送失敗',
    })
    console.log(results.items[results.items.length - 1].message)
  }

  // 查詢通知記錄
  console.log('\n📋 查詢通知記錄...')
  const logs = await prisma.notificationLog.findMany({
    where: { userId: booking.userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  console.log('\n📊 最近 10 筆通知記錄：')
  logs.forEach((log, i) => {
    const status = log.status === 'SENT' ? '✅' : log.status === 'FAILED' ? '❌' : '⏳'
    console.log(
      `${i + 1}. ${status} ${log.type.padEnd(15)} | ${log.status.padEnd(8)} | ${log.createdAt.toISOString()} ${log.error ? `| 錯誤：${log.error}` : ''}`,
    )
  })

  const allOk = results.items.every((i) => i.ok)
  console.log(
    '\n' + (allOk ? '✅ 所有通知已發送到 LINE' : '⚠️ 部分通知發送失敗（使用者可能未加好友或 LINE API 故障）'),
  )

  process.exit(allOk ? 0 : 1)
}

main().catch((err) => {
  console.error('❌ 執行失敗：', err)
  process.exit(1)
})
