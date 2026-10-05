/**
 * 球敘核心邏輯的實際驗證（對真正的 Turso 資料庫執行）。
 *
 *   npm run verify:session
 *
 * 重點在規格 §15 的防超賣：12 個人同時搶 8 個名額，
 * 必須剛好 8 人正取、4 人候補，且候補順位連續不重複。
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { joinSession, cancelRegistration } from '../src/server/session-service.ts'
import { computeSessionTimes } from '../src/lib/session-schedule.ts'
import { zonedParts } from '../src/lib/timezone.ts'

const prisma = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
})

const TZ = 'Asia/Taipei'
const CAPACITY = 8
const CONTENDERS = 12

let failures = 0
function check(label: string, passed: boolean, detail = '') {
  console.log(`   ${passed ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!passed) failures++
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow()
  const venue = await prisma.venue.findFirstOrThrow({ where: { organizationId: org.id } })

  // 建立一場「現在就開放報名、明天開打」的測試球敘
  const tomorrow = new Date(Date.now() + 86_400_000)
  const times = computeSessionTimes(zonedParts(tomorrow, TZ), {
    timezone: TZ,
    startMinute: 12 * 60,
    endMinute: 14 * 60,
    bookingOpenDaysBefore: 7,
    bookingOpenHourOffset: 1,
    cancellationMode: 'PREVIOUS_DAY_MIDNIGHT',
  })

  await prisma.session.deleteMany({ where: { title: '__verify__' } })
  const session = await prisma.session.create({
    data: {
      organizationId: org.id,
      venueId: venue.id,
      title: '__verify__',
      startAt: times.startAt,
      endAt: times.endAt,
      bookingOpenAt: new Date(Date.now() - 3_600_000), // 已開放
      bookingCloseAt: times.startAt,
      cancelDeadline: times.startAt, // 讓測試期間都算「截止前」
      finalizeAt: times.finalizeAt,
      capacity: CAPACITY,
      reservedCapacity: 0,
      status: 'OPEN',
      waitlistEnabled: true,
      autoPromote: true,
    },
  })

  const users = []
  for (let i = 0; i < CONTENDERS; i++) {
    users.push(
      await prisma.user.create({
        data: { displayName: `__verify_player_${i}`, lineUserId: `__verify_${Date.now()}_${i}` },
      }),
    )
  }

  console.log(`\n【防超賣測試】${CONTENDERS} 人同時報名，名額 ${CAPACITY}`)
  const results = await Promise.all(users.map((u) => joinSession(session.id, u.id)))

  const confirmed = results.filter((r) => r.ok && r.status === 'CONFIRMED').length
  const waitlisted = results.filter((r) => r.ok && r.status === 'WAITLISTED').length
  const rejected = results.filter((r) => !r.ok)

  check(`正取剛好 ${CAPACITY} 人`, confirmed === CAPACITY, `實際 ${confirmed}`)
  check(`候補 ${CONTENDERS - CAPACITY} 人`, waitlisted === CONTENDERS - CAPACITY, `實際 ${waitlisted}`)
  check('沒有人被錯誤拒絕', rejected.length === 0, `拒絕 ${rejected.length}`)

  const dbConfirmed = await prisma.sessionRegistration.count({
    where: { sessionId: session.id, status: 'CONFIRMED' },
  })
  check('資料庫中正取人數未超賣', dbConfirmed === CAPACITY, `實際 ${dbConfirmed}`)

  const positions = (
    await prisma.sessionRegistration.findMany({
      where: { sessionId: session.id, status: 'WAITLISTED' },
      orderBy: { waitlistPosition: 'asc' },
      select: { waitlistPosition: true },
    })
  ).map((r) => r.waitlistPosition)
  const expected = Array.from({ length: CONTENDERS - CAPACITY }, (_, i) => i + 1)
  check('候補順位連續且不重複', JSON.stringify(positions) === JSON.stringify(expected), `${positions.join(',')}`)

  const st = await prisma.session.findUniqueOrThrow({ where: { id: session.id } })
  check('場次狀態轉為 FULL', st.status === 'FULL', st.status)

  console.log('\n【候補自動遞補測試】一位正取者取消')
  const firstConfirmed = await prisma.sessionRegistration.findFirstOrThrow({
    where: { sessionId: session.id, status: 'CONFIRMED' },
    orderBy: { registeredAt: 'asc' },
  })
  const nextInLine = await prisma.sessionRegistration.findFirstOrThrow({
    where: { sessionId: session.id, status: 'WAITLISTED' },
    orderBy: { waitlistPosition: 'asc' },
  })

  const cancelled = await cancelRegistration(session.id, firstConfirmed.userId)
  check('取消成功且判定為正常取消', cancelled.ok && cancelled.status === 'CANCELLED')
  check(
    '遞補的是候補第一位（FIFO）',
    cancelled.ok && cancelled.promotedUserId === nextInLine.userId,
  )

  const promoted = await prisma.sessionRegistration.findUniqueOrThrow({
    where: { sessionId_userId: { sessionId: session.id, userId: nextInLine.userId } },
  })
  check('被遞補者狀態為 CONFIRMED', promoted.status === 'CONFIRMED', promoted.status)
  check('已記錄 promotedAt', promoted.promotedAt !== null)

  const after = await prisma.sessionRegistration.count({
    where: { sessionId: session.id, status: 'CONFIRMED' },
  })
  check(`遞補後正取仍為 ${CAPACITY} 人`, after === CAPACITY, `實際 ${after}`)

  const newPositions = (
    await prisma.sessionRegistration.findMany({
      where: { sessionId: session.id, status: 'WAITLISTED' },
      orderBy: { waitlistPosition: 'asc' },
      select: { waitlistPosition: true },
    })
  ).map((r) => r.waitlistPosition)
  check(
    '剩餘候補順位已重排為 1,2,3',
    JSON.stringify(newPositions) === JSON.stringify([1, 2, 3]),
    newPositions.join(','),
  )

  console.log('\n【重複報名測試】')
  const dup = await joinSession(session.id, nextInLine.userId)
  check('同一人無法重複報名', !dup.ok && dup.reason === 'ALREADY_REGISTERED')

  // 清理測試資料
  await prisma.sessionRegistration.deleteMany({ where: { sessionId: session.id } })
  await prisma.session.delete({ where: { id: session.id } })
  await prisma.user.deleteMany({ where: { displayName: { startsWith: '__verify_player_' } } })

  console.log(failures === 0 ? '\n✅ 全部通過' : `\n❌ 有 ${failures} 項未通過`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('執行失敗：', e)
  process.exit(1)
})
