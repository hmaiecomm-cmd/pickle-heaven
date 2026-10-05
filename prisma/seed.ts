/**
 * 種子資料：建立示範場館、場地、費率、折價券與少量已預約/維護時段，
 * 讓矩陣一開啟就看得到各種狀態。
 *
 * 執行：npm run db:seed
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import 'dotenv/config'

const prisma = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
})

const TAIPEI_OFFSET_MINUTES = 480

function taipeiDateString(date = new Date()): string {
  const d = new Date(date.getTime() + TAIPEI_OFFSET_MINUTES * 60_000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const nd = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}-${String(nd.getUTCDate()).padStart(2, '0')}`
}

function taipeiToUtc(dateStr: string, minuteOfDay: number): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + (minuteOfDay - TAIPEI_OFFSET_MINUTES) * 60_000)
}

async function main() {
  console.log('▸ 清除既有示範資料…')
  await prisma.reservation.deleteMany()
  await prisma.bookingItem.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.voucher.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.priceRule.deleteMany()
  await prisma.court.deleteMany()
  await prisma.venue.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.notificationLog.deleteMany()
  await prisma.sessionRosterSnapshot.deleteMany()
  await prisma.sessionRegistration.deleteMany()
  await prisma.session.deleteMany()
  await prisma.sessionTemplate.deleteMany()
  await prisma.organization.deleteMany()
  // 一併清除示範／開發帳號，讓點數餘額每次都回到已知狀態
  await prisma.user.deleteMany({ where: { OR: [{ lineUserId: null }, { lineUserId: 'DEV_USER' }] } })

  console.log('▸ 建立組織…')
  const org = await prisma.organization.create({
    data: { slug: 'pickle-heaven', name: '匹克天堂' },
  })

  console.log('▸ 建立場館…')
  const venue = await prisma.venue.create({
    data: {
      organizationId: org.id,
      timezone: 'Asia/Taipei',
      slug: 'taipei-dazhi',
      name: '匹克天堂 · 台北大直館',
      address: '台北市中山區敬業三路 128 號（頂樓雨棚球場）',
      phone: '02-2532-8888',
      description: '2 面標準匹克球場，室外雨棚全遮蔽、下雨照常開打，專業 PU 地墊與獨立更衣淋浴間，捷運劍南路站步行 5 分鐘。',
      openMinute: 600, // 10:00
      closeMinute: 1440, // 24:00
      slotMinutes: 60,
      bookAheadDays: 14,
      holdMinutes: 10,
      notice: '球場為室外雨棚場地，全場遮蔽、雨天照常開打。首次到場請提前 10 分鐘辦理報到，並請著止滑運動鞋、禁止穿著黑底鞋入場。',
      policy: '開打前 72 小時以上取消可全額退還為點數；48–72 小時退 80%；24–48 小時退 50%；24 小時內恕不退款。',
    },
  })

  console.log('▸ 建立場地…')
  // 本場館為 2 面室外雨棚球場
  const courts = await Promise.all(
    [1, 2].map((n) =>
      prisma.court.create({
        data: {
          venueId: venue.id,
          name: `${n}號場地`,
          sortOrder: n,
          indoor: false,
          covered: true,
          surface: 'PU 專業地墊（雨棚遮蔽）',
        },
      }),
    ),
  )

  console.log('▸ 建立費率規則…')
  await prisma.priceRule.createMany({
    data: [
      // 平日
      { venueId: venue.id, name: '離峰', kind: 'OFFPEAK', dayType: 'WEEKDAY', startMinute: 600, endMinute: 1020, price: 500, priority: 10 },
      { venueId: venue.id, name: '尖峰', kind: 'PEAK', dayType: 'WEEKDAY', startMinute: 1020, endMinute: 1440, price: 800, priority: 10 },
      // 假日
      { venueId: venue.id, name: '離峰', kind: 'OFFPEAK', dayType: 'WEEKEND', startMinute: 600, endMinute: 780, price: 700, priority: 10 },
      { venueId: venue.id, name: '尖峰', kind: 'PEAK', dayType: 'WEEKEND', startMinute: 780, endMinute: 1440, price: 1000, priority: 10 },
    ],
  })

  console.log('▸ 建立示範會員與折價券…')
  const demoUser = await prisma.user.create({
    data: {
      lineUserId: null,
      displayName: '測試球友',
      phone: '0912345678',
      points: 300,
      role: 'USER',
    },
  })

  await prisma.voucher.createMany({
    data: [
      { code: 'WELCOME100', title: '新朋友首購折 100', type: 'AMOUNT', value: 100, minSpend: 500 },
      { code: 'PICKLE90', title: '全站 9 折', type: 'PERCENT', value: 90, minSpend: 1000 },
      { code: 'VIP200', title: '會員專屬折 200', type: 'AMOUNT', value: 200, minSpend: 1500, userId: demoUser.id },
    ],
  })

  console.log('▸ 建立示範佔用時段…')
  const today = taipeiDateString()
  const tomorrow = addDays(today, 1)

  // 已預約（他人已成立訂單）
  const bookedSpots: [number, number][] = [
    [0, 1140], // 1號場地 19:00
    [0, 1200], // 1號場地 20:00
    [1, 1140], // 2號場地 19:00
    [1, 1260], // 2號場地 21:00
  ]
  for (const [courtIdx, minute] of bookedSpots) {
    await prisma.reservation.create({
      data: {
        courtId: courts[courtIdx].id,
        startsAt: taipeiToUtc(tomorrow, minute),
        endsAt: taipeiToUtc(tomorrow, minute + 60),
        status: 'BOOKED',
        note: '示範資料',
      },
    })
  }

  // 場館維護鎖定
  for (const minute of [600, 660]) {
    await prisma.reservation.create({
      data: {
        courtId: courts[1].id,
        startsAt: taipeiToUtc(tomorrow, minute),
        endsAt: taipeiToUtc(tomorrow, minute + 60),
        status: 'BLOCKED',
        note: '地墊保養',
      },
    })
  }

  // 今日晚間也放幾筆，讓今天的矩陣不會空空的
  for (const [courtIdx, minute] of [[0, 1260], [1, 1200]] as [number, number][]) {
    await prisma.reservation.create({
      data: {
        courtId: courts[courtIdx].id,
        startsAt: taipeiToUtc(today, minute),
        endsAt: taipeiToUtc(today, minute + 60),
        status: 'BOOKED',
        note: '示範資料',
      },
    })
  }

  // ── 球敘（Open Play）範本 ──────────────────────────────
  // 規格 §1 的範例：每週二 12:00–14:00、8 人、程度 3.0–4.0、NT$500。
  // 這些都是設定資料，不是寫死的邏輯（規格 §17）。
  console.log('▸ 建立球敘範本…')
  await prisma.sessionTemplate.create({
    data: {
      organizationId: org.id,
      venueId: venue.id,
      courtId: courts[0].id,
      title: '大興店固定球敘',
      weekday: 2, // 週二
      startMinute: 12 * 60,
      endMinute: 14 * 60,
      capacity: 8,
      reservedCapacity: 2, // 保留給教練／來賓
      skillLevelMin: 3.0,
      skillLevelMax: 4.0,
      price: 500,
      bookingOpenDaysBefore: 7,
      bookingOpenHourOffset: 1,
      cancellationMode: 'PREVIOUS_DAY_MIDNIGHT',
      waitlistEnabled: true,
      autoPromote: true,
      generateWeeksAhead: 10,
    },
  })

  console.log('\n✅ 種子資料建立完成')
  console.log(`   場館：${venue.name}（/booking?venue=${venue.slug}）`)
  console.log(`   場地：${courts.length} 面`)
  console.log('   球敘範本：每週二 12:00–14:00（8 人・NT$500）→ /sessions')
  console.log('   折價券：WELCOME100 / PICKLE90 / VIP200')
}

main()
  .catch((e) => {
    console.error('❌ 種子資料建立失敗', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
