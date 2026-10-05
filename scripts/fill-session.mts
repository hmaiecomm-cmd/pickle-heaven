/**
 * 開發用：把最近一場開放報名的球敘塞滿示範球友，方便檢視額滿／候補的畫面。
 *
 *   npm run dev:fill        塞到額滿
 *   npm run dev:fill -- 3   只塞 3 人
 *   npm run dev:fill -- 0   清掉本腳本建立的示範球友
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { joinSession } from '../src/server/session-service.ts'

const prisma = new PrismaClient({
  adapter: new PrismaLibSQL({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  }),
})

const PREFIX = '示範球友'
const NAMES = ['Jerry', 'Amy', 'Jack', 'Vivian', 'David', 'Tina', 'Peter', 'Jenny', 'Kevin', 'Alex']

const arg = process.argv[2]
const requested = arg === undefined ? null : Number(arg)

async function main() {
  if (requested === 0) {
    const { count } = await prisma.user.deleteMany({
      where: { displayName: { startsWith: PREFIX } },
    })
    console.log(`已清除 ${count} 位示範球友`)
    return
  }

  const session = await prisma.session.findFirst({
    where: { status: { in: ['OPEN', 'FULL'] } },
    orderBy: { startAt: 'asc' },
  })
  if (!session) {
    console.log('找不到開放報名中的球敘，請先執行 /api/cron/sessions')
    return
  }

  const publicSpots = Math.max(0, session.capacity - session.reservedCapacity)
  const confirmed = await prisma.sessionRegistration.count({
    where: { sessionId: session.id, status: 'CONFIRMED' },
  })
  const count = requested ?? Math.max(0, publicSpots - confirmed) + 1 // 多一位讓候補也看得到

  console.log(`球敘：${session.title}（正取 ${confirmed}/${publicSpots}），將加入 ${count} 人`)

  for (let i = 0; i < count; i++) {
    const name = `${PREFIX} ${NAMES[i % NAMES.length]}`
    const user = await prisma.user.upsert({
      where: { lineUserId: `__demo_${i}` },
      update: { displayName: name },
      create: { displayName: name, lineUserId: `__demo_${i}` },
    })
    const result = await joinSession(session.id, user.id)
    console.log(
      `  ${name} → ${result.ok ? result.status : `失敗（${result.reason}）`}` +
        (result.ok && result.status === 'WAITLISTED' ? ` #${result.position}` : ''),
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
