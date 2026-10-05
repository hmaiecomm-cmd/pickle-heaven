/**
 * 球敘狀態機與排程冪等性的實際驗證（規格 §5、§9、§11、§12）。
 *
 *   npm run verify:lifecycle
 *
 * 作法：建立一場時間戳都設在過去的球敘，逐一呼叫各排程任務，
 * 檢查狀態依序推進，並確認重跑不會產生重複的快照或通知。
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import {
  openBookings,
  lockSessions,
  startPlayingSessions,
  completeSessions,
} from '../src/server/session-scheduler.ts'
import { joinSession } from '../src/server/session-service.ts'

const prisma = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
})

let failures = 0
function check(label: string, passed: boolean, detail = '') {
  console.log(`   ${passed ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!passed) failures++
}

const MIN = 60_000
const TITLE = '__lifecycle__'

async function statusOf(id: string) {
  return (await prisma.session.findUniqueOrThrow({ where: { id } })).status
}

async function cleanup() {
  const old = await prisma.session.findMany({ where: { title: TITLE }, select: { id: true } })
  const ids = old.map((s) => s.id)
  if (ids.length) {
    await prisma.notificationLog.deleteMany({ where: { sessionId: { in: ids } } })
    await prisma.sessionRosterSnapshot.deleteMany({ where: { sessionId: { in: ids } } })
    await prisma.sessionRegistration.deleteMany({ where: { sessionId: { in: ids } } })
    await prisma.session.deleteMany({ where: { id: { in: ids } } })
  }
  await prisma.user.deleteMany({ where: { displayName: { startsWith: '__lifecycle_p' } } })
}

async function main() {
  await cleanup()

  const org = await prisma.organization.findFirstOrThrow()
  const venue = await prisma.venue.findFirstOrThrow({ where: { organizationId: org.id } })
  const now = new Date()

  // 各時間戳都設在過去，讓每個排程任務都會命中
  const session = await prisma.session.create({
    data: {
      organizationId: org.id,
      venueId: venue.id,
      title: TITLE,
      startAt: new Date(now.getTime() - 30 * MIN),
      endAt: new Date(now.getTime() + 30 * MIN), // 仍在進行中
      bookingOpenAt: new Date(now.getTime() - 120 * MIN),
      bookingCloseAt: new Date(now.getTime() - 60 * MIN),
      cancelDeadline: new Date(now.getTime() - 60 * MIN),
      finalizeAt: new Date(now.getTime() - 60 * MIN),
      capacity: 3,
      reservedCapacity: 0,
      status: 'SCHEDULED',
      waitlistEnabled: true,
      autoPromote: true,
    },
  })

  console.log('\n【狀態機推進】')
  check('初始狀態為 SCHEDULED', (await statusOf(session.id)) === 'SCHEDULED')

  await openBookings()
  check('報名時間已到 → OPEN', (await statusOf(session.id)) === 'OPEN', await statusOf(session.id))

  // 放 4 個人進來：3 正取 1 候補（報名檢查會擋，所以用 byOrganizer 略過時間限制）
  const players = []
  for (let i = 0; i < 4; i++) {
    players.push(
      await prisma.user.create({
        data: { displayName: `__lifecycle_p${i}`, lineUserId: `__lc_${Date.now()}_${i}` },
      }),
    )
  }
  for (const p of players) await joinSession(session.id, p.id, true)

  const confirmed = await prisma.sessionRegistration.count({
    where: { sessionId: session.id, status: 'CONFIRMED' },
  })
  const waitlisted = await prisma.sessionRegistration.count({
    where: { sessionId: session.id, status: 'WAITLISTED' },
  })
  check('3 人正取、1 人候補', confirmed === 3 && waitlisted === 1, `${confirmed} / ${waitlisted}`)

  console.log('\n【鎖定與最終名單】')
  const lockRes = await lockSessions()
  check('截止時間已到 → LOCKED', (await statusOf(session.id)) === 'LOCKED', await statusOf(session.id))
  check('產生 1 份名單快照', lockRes.snapshots === 1, `${lockRes.snapshots}`)
  check('為 4 位參與者排入通知', lockRes.queuedNotifications === 4, `${lockRes.queuedNotifications}`)

  const snap = await prisma.sessionRosterSnapshot.findFirstOrThrow({
    where: { sessionId: session.id, snapshotType: 'FINAL_ROSTER' },
  })
  const roster = snap.rosterJson as { confirmed: unknown[]; waitlist: unknown[] }
  check('快照含 3 位正取', roster.confirmed.length === 3, `${roster.confirmed.length}`)
  check('快照含 1 位候補', roster.waitlist.length === 1, `${roster.waitlist.length}`)

  console.log('\n【冪等性：重跑鎖定任務】')
  const again = await lockSessions()
  check('不再重複鎖定', again.locked === 0, `${again.locked}`)
  const snapCount = await prisma.sessionRosterSnapshot.count({ where: { sessionId: session.id } })
  check('快照仍只有 1 份', snapCount === 1, `${snapCount}`)
  const notifCount = await prisma.notificationLog.count({ where: { sessionId: session.id } })
  check('通知仍只有 4 筆', notifCount === 4, `${notifCount}`)

  console.log('\n【開打與結束】')
  await startPlayingSessions()
  check('已過開打時間 → PLAYING', (await statusOf(session.id)) === 'PLAYING', await statusOf(session.id))

  // 把結束時間改到過去，模擬球敘已結束
  await prisma.session.update({
    where: { id: session.id },
    data: { endAt: new Date(now.getTime() - MIN) },
  })
  const done = await completeSessions()
  check('已過結束時間 → COMPLETED', (await statusOf(session.id)) === 'COMPLETED', await statusOf(session.id))
  check('3 位正取被標記出席', done.attendeesMarked === 3, `${done.attendeesMarked}`)

  const stat = await prisma.user.findUniqueOrThrow({ where: { id: players[0].id } })
  check('個人完成場次統計 +1', stat.sessionsCompleted === 1, `${stat.sessionsCompleted}`)

  const repeat = await completeSessions()
  check('重跑不會重複結算', repeat.completed === 0, `${repeat.completed}`)

  await cleanup()
  console.log(failures === 0 ? '\n✅ 全部通過' : `\n❌ 有 ${failures} 項未通過`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('執行失敗：', e)
  await cleanup().catch(() => {})
  process.exit(1)
})
