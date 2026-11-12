import { prisma } from '@/lib/db'

async function main() {
  const booking = await prisma.booking.findFirst({
    where: { code: 'PH-20261107-UJQB' },
    include: { user: true }
  })

  console.log('Booking:', booking?.code, booking?.status, booking?.user.lineUserId)

  const logs = await prisma.notificationLog.findMany({
    where: { userId: booking?.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  console.log('\n📋 通知記錄 (' + logs.length + '):')
  logs.forEach((log, i) => {
    console.log(`${i+1}. ${log.type} - ${log.status} - ${log.createdAt.toISOString()} - ${log.error || ''}`)
  })

  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
