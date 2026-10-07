import type { PrismaClient } from '@prisma/client'
import { addDays, taipeiDateString, taipeiToUtc, taipeiWeekday } from '@/lib/time'

/**
 * 展示資料（全部虛構）。只對展示資料庫執行：呼叫端必須傳入展示資料庫的連線。
 * 每次執行會清空展示資料庫再重建，可重複執行。
 */

const NAMES = [
  '林小安', '陳柏宇', '王怡君', '張家豪', '李佳穎', '黃冠廷', '吳雅婷', '劉建宏', '蔡宜蓁', '楊宗翰',
  '許詩涵', '鄭博文', '謝依婷', '郭承恩', '洪子晴', '曾俊傑', '邱語彤', '廖冠宇', '賴品妤', '周彥廷',
  '林小安', '葉芷瑜', '蘇柏翰', '潘思妤', '杜昱辰', '戴心怡', '范書豪', '方雨潔', '石子揚', '江采潔',
]

/** 固定種子的亂數，每次產生相同的展示資料 */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export async function seedDemoData(db: PrismaClient, opts: { log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => {})
  const url = process.env.DEMO_DATABASE_URL
  if (!url || url === process.env.TURSO_DATABASE_URL) throw new Error('只能對獨立的展示資料庫執行')

  log('清空展示資料庫')
  await db.refundItem.deleteMany()
  await db.refund.deleteMany()
  await db.invoiceEvent.deleteMany()
  await db.invoice.deleteMany()
  await db.payment.deleteMany()
  await db.bookingActivityItem.deleteMany()
  await db.bookingItem.deleteMany()
  await db.voucher.deleteMany()
  await db.reservation.deleteMany()
  await db.deviceCommand.deleteMany()
  await db.device.deleteMany()
  await db.sessionWatch.deleteMany()
  await db.notificationLog.deleteMany()
  await db.sessionRosterSnapshot.deleteMany()
  await db.sessionRegistration.deleteMany()
  await db.sessionCourt.deleteMany()
  await db.session.deleteMany()
  await db.sessionTemplate.deleteMany()
  await db.activity.deleteMany()
  await db.mediaAsset.deleteMany()
  await db.priceRule.deleteMany()
  await db.booking.deleteMany()
  await db.memberRestriction.deleteMany()
  await db.incident.deleteMany()
  await db.auditLog.deleteMany()
  await db.coachAvailability.deleteMany()
  await db.coach.deleteMany()
  await db.expense.deleteMany()
  await db.receipt.deleteMany()
  await db.membershipTier.deleteMany()
  await db.court.deleteMany()
  await db.venue.deleteMany()
  await db.organization.deleteMany()
  await db.user.deleteMany()
  await db.adminSession.deleteMany()
  await db.adminLoginAttempt.deleteMany()
  await db.adminAccount.deleteMany()

  log('建立展示場館')
  const org = await db.organization.create({ data: { slug: 'demo-org', name: '展示營運（虛構）' } })
  const venue = await db.venue.create({
    data: {
      organizationId: org.id,
      slug: 'demo-forest',
      name: '森林示範球館（展示）',
      address: '展示用地址（虛構）',
      phone: '',
      description: '展示資料，非真實場館',
      openMinute: 600,
      closeMinute: 1440,
      slotMinutes: 60,
      bookAheadDays: 14,
      holdMinutes: 10,
      notice: '展示環境：所有資料皆為虛構',
    },
  })
  const courts = await Promise.all(
    ['A 場', 'B 場'].map((name, i) =>
      db.court.create({ data: { venueId: venue.id, name, sortOrder: i, indoor: false, covered: true, capacity: 4 } }),
    ),
  )
  await db.priceRule.createMany({
    data: [
      { venueId: venue.id, name: '離峰', kind: 'OFFPEAK', dayType: 'WEEKDAY', startMinute: 600, endMinute: 1020, price: 500 },
      { venueId: venue.id, name: '尖峰', kind: 'PEAK', dayType: 'WEEKDAY', startMinute: 1020, endMinute: 1440, price: 800 },
      { venueId: venue.id, name: '離峰', kind: 'OFFPEAK', dayType: 'WEEKEND', startMinute: 600, endMinute: 780, price: 700 },
      { venueId: venue.id, name: '尖峰', kind: 'PEAK', dayType: 'WEEKEND', startMinute: 780, endMinute: 1440, price: 1000 },
    ],
  })
  await db.membershipTier.createMany({
    data: [
      { level: 'BASIC', label: '一般', discountPct: 0, sortOrder: 0 },
      { level: 'PREMIUM', label: '進階', discountPct: 5, sortOrder: 1 },
      { level: 'VIP', label: 'VIP', discountPct: 10, sortOrder: 2 },
    ],
  })

  const now = new Date()
  // 模擬設備：A 場門禁離線、B 場人流感測偵測到有人（用來展示「預約與感測不一致」）
  for (const [i, c] of courts.entries()) {
    await db.device.createMany({
      data: [
        { courtId: c.id, type: 'DOOR', name: '門禁', status: i === 0 ? 'OFFLINE' : 'ONLINE', lastSeen: i === 0 ? new Date(now.getTime() - 47 * 60_000) : now, lastAction: 'LOCKED' },
        { courtId: c.id, type: 'LIGHTS', name: '照明', status: 'ONLINE', lastSeen: now, lastAction: 'OFF' },
        { courtId: c.id, type: 'FANS', name: '風扇', status: 'ONLINE', lastSeen: now, lastAction: 'OFF' },
        { courtId: c.id, type: 'CAMERA', name: '人流感測（模擬）', status: 'ONLINE', lastSeen: now, lastAction: i === 1 ? 'OCCUPIED' : 'EMPTY' },
      ],
    })
  }

  log('建立虛構會員')
  const users = []
  for (const [i, name] of NAMES.entries()) {
    users.push(
      await db.user.create({
        data: {
          // 展示會員一律為 Google 登入帳號（與正式前台一致）；每 9 位有 1 位未填電話
          googleSub: `DEMO_GOOGLE_${i}`,
          displayName: name,
          phone: i % 9 === 4 ? null : `0900${String(100000 + i * 3731).slice(-6)}`,
          lastLoginAt: new Date(now.getTime() - (i % 11) * 86_400_000 - i * 3_600_000),
          email: `demo${i + 1}@example.test`,
          points: i % 7 === 0 ? 300 : 0,
          membershipLevel: i % 10 === 0 ? 'VIP' : i % 4 === 0 ? 'PREMIUM' : 'BASIC',
          createdAt: new Date(now.getTime() - (60 - i) * 86_400_000),
        },
      }),
    )
  }

  const rand = rng(20261007)
  const today = taipeiDateString(now)
  const used = new Set<string>()
  const slotFree = (courtId: string, at: Date) => !used.has(`${courtId}@${at.getTime()}`)
  const take = (courtId: string, at: Date) => used.add(`${courtId}@${at.getTime()}`)

  log('建立活動與場次')
  const activities = [
    { title: '新手友善 Open Play', type: 'BEGINNER' as const, weekdays: [4, 6], start: 1140, end: 1260, courts: [0, 1], price: 350, cap: 12, level: '新手友善', summary: '第一次打匹克球也沒問題，現場分組輪流上場。' },
    { title: '週末進階雙打', type: 'OPEN_PLAY' as const, weekdays: [0], start: 600, end: 720, courts: [1], price: 450, cap: 8, level: '3.0 以上', summary: '固定隊友輪換，適合有比賽經驗的球友。' },
  ]
  const sessionsCreated: { id: string; price: number; startAt: Date; endAt: Date; title: string; courts: string }[] = []
  for (const a of activities) {
    const act = await db.activity.create({
      data: {
        organizationId: org.id,
        venueId: venue.id,
        title: a.title,
        type: a.type,
        status: 'PUBLISHED',
        summary: a.summary,
        description: `${a.summary}（展示資料）`,
        levelLabel: a.level,
        requirements: '請穿運動鞋（展示）',
        price: a.price,
        capacity: a.cap,
        maxPerOrder: 4,
        repeatKind: 'WEEKLY',
        weekdays: a.weekdays.join(','),
        startMinute: a.start,
        endMinute: a.end,
        seriesStartDate: addDays(today, -14),
        seriesEndDate: addDays(today, 28),
        courtIds: a.courts.map((i) => courts[i].id).join(','),
        openDaysBefore: 14,
        closeMinutesBefore: 60,
      },
    })
    let idx = 0
    for (let d = -14; d <= 28; d++) {
      const date = addDays(today, d)
      if (!a.weekdays.includes(taipeiWeekday(date))) continue
      const startAt = taipeiToUtc(date, a.start)
      const endAt = taipeiToUtc(date, a.end)
      const s = await db.session.create({
        data: {
          organizationId: org.id,
          venueId: venue.id,
          activityId: act.id,
          seriesIndex: ++idx,
          title: a.title,
          startAt,
          endAt,
          bookingOpenAt: taipeiToUtc(addDays(date, -14), a.start),
          bookingCloseAt: new Date(startAt.getTime() - 3600_000),
          cancelDeadline: new Date(startAt.getTime() - 3600_000),
          finalizeAt: new Date(startAt.getTime() - 3600_000),
          capacity: a.cap,
          price: a.price,
          waitlistEnabled: false,
          autoPromote: false,
          status: endAt < now ? 'COMPLETED' : 'OPEN',
          courtId: courts[a.courts[0]].id,
        },
      })
      await db.sessionCourt.createMany({ data: a.courts.map((i) => ({ sessionId: s.id, courtId: courts[i].id })) })
      const occ = []
      for (let m = a.start; m < a.end; m += 60) {
        for (const i of a.courts) {
          const at = taipeiToUtc(date, m)
          take(courts[i].id, at)
          occ.push({ courtId: courts[i].id, startsAt: at, endsAt: taipeiToUtc(date, m + 60), status: 'EVENT' as const, sessionId: s.id })
        }
      }
      await db.reservation.createMany({ data: occ })
      sessionsCreated.push({ id: s.id, price: a.price, startAt, endAt, title: a.title, courts: a.courts.map((i) => courts[i].name).join('、') })
    }
  }

  log('建立訂單、付款、退款與發票')
  let seq = 1
  const code = (date: string) => `PH-${date.replace(/-/g, '')}-D${String(seq++).padStart(3, '0')}`
  for (let d = -20; d <= 10; d++) {
    const date = addDays(today, d)
    const perDay = d <= 0 ? 3 : 2
    for (let k = 0; k < perDay; k++) {
      const u = users[Math.floor(rand() * users.length)]
      const court = courts[Math.floor(rand() * courts.length)]
      const startMinute = 600 + 60 * Math.floor(rand() * 13)
      const slots = rand() < 0.3 ? 2 : 1
      const times = Array.from({ length: slots }, (_, j) => startMinute + 60 * j).filter((m) => m + 60 <= 1440)
      if (!times.every((m) => slotFree(court.id, taipeiToUtc(date, m)))) continue
      const weekend = [0, 6].includes(taipeiWeekday(date))
      const priceOf = (m: number) => (weekend ? (m < 780 ? 700 : 1000) : m < 1020 ? 500 : 800)
      const items = times.map((m) => ({ m, price: priceOf(m) }))
      const subtotal = items.reduce((s, i) => s + i.price, 0)
      const createdAt = new Date(taipeiToUtc(date, 600).getTime() - (2 + Math.floor(rand() * 5)) * 86_400_000)
      const roll = rand()
      const status = d < 0 ? (roll < 0.12 ? 'CANCELLED' : roll < 0.18 ? 'EXPIRED' : 'COMPLETED') : roll < 0.15 ? 'PENDING' : 'PAID'
      const paid = status === 'PAID' || status === 'COMPLETED' || (status === 'CANCELLED' && roll < 0.08)
      const booking = await db.booking.create({
        data: {
          code: code(date),
          userId: u.id,
          venueId: venue.id,
          playDate: date,
          status,
          subtotal,
          total: subtotal,
          contactName: u.displayName,
          contactPhone: u.phone ?? '0900000000',
          expiresAt: status === 'PENDING' ? new Date(now.getTime() + 10 * 60_000) : null,
          paidAt: paid ? new Date(createdAt.getTime() + 5 * 60_000) : null,
          cancelledAt: status === 'CANCELLED' ? new Date(createdAt.getTime() + 86_400_000) : null,
          createdAt,
          items: {
            create: items.map((i) => ({
              courtId: court.id,
              courtName: court.name,
              startsAt: taipeiToUtc(date, i.m),
              endsAt: taipeiToUtc(date, i.m + 60),
              price: i.price,
              rateName: i.price >= 800 ? '尖峰' : '離峰',
              status: status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
            })),
          },
        },
      })
      if (paid) {
        await db.payment.create({ data: { bookingId: booking.id, provider: 'mock', method: 'CREDIT_CARD', amount: subtotal, status: 'SUCCESS', providerRef: `MOCK-DEMO-${booking.code}`, cardLast4: '4242', cardBrand: 'VISA', paidAt: booking.paidAt } })
      }
      if (status === 'PENDING' && rand() < 0.5) {
        await db.payment.create({ data: { bookingId: booking.id, provider: 'mock', amount: subtotal, status: 'FAILED', failReason: '模擬付款失敗（卡片遭拒）' } })
      }
      if (status === 'PAID' || status === 'PENDING') {
        for (const i of items) {
          take(court.id, taipeiToUtc(date, i.m))
          await db.reservation.create({
            data: { courtId: court.id, startsAt: taipeiToUtc(date, i.m), endsAt: taipeiToUtc(date, i.m + 60), status: status === 'PAID' ? 'BOOKED' : 'HELD', bookingId: booking.id, holdExpiresAt: status === 'PENDING' ? booking.expiresAt : null },
          })
        }
      }
      if (paid && rand() < 0.6) {
        await db.invoice.create({
          data: {
            invoiceNumber: `DM${date.replace(/-/g, '').slice(2)}${String(seq).padStart(4, '0')}`,
            userId: u.id,
            bookingId: booking.id,
            dueDate: booking.paidAt!,
            issueDate: booking.paidAt!,
            amount: subtotal,
            status: 'PAID',
            items: items.map((i) => ({ description: `${court.name} 場地租借`, quantity: 1, unitPrice: i.price, amount: i.price })),
            provider: 'demo-simulator',
            providerStatus: 'ISSUED',
            recipientEmail: u.email,
          },
        })
      }
    }
  }

  // 活動報名（含部分訂單同時有場地與活動）
  for (const s of sessionsCreated) {
    const n = s.endAt < now ? 6 : Math.floor(rand() * 8)
    const picked = new Set<number>()
    for (let j = 0; j < n; j++) {
      const ui = Math.floor(rand() * users.length)
      if (picked.has(ui) || ui === 5) continue
      picked.add(ui)
      const u = users[ui]
      const qty = rand() < 0.25 ? 2 : 1
      const date = taipeiDateString(s.startAt)
      const createdAt = new Date(s.startAt.getTime() - 3 * 86_400_000)
      const reg = await db.sessionRegistration.create({
        data: { sessionId: s.id, userId: u.id, status: s.endAt < now ? 'COMPLETED' : 'CONFIRMED', quantity: qty, seats: qty, unitPrice: s.price, registeredAt: createdAt, checkedInAt: s.endAt < now && rand() < 0.8 ? s.startAt : null },
      })
      const booking = await db.booking.create({
        data: {
          code: code(date),
          userId: u.id,
          venueId: venue.id,
          playDate: date,
          status: s.endAt < now ? 'COMPLETED' : 'PAID',
          subtotal: s.price * qty,
          total: s.price * qty,
          contactName: u.displayName,
          contactPhone: u.phone ?? '0900000000',
          paidAt: new Date(createdAt.getTime() + 3 * 60_000),
          createdAt,
          activityItems: {
            create: [{ sessionId: s.id, registrationId: reg.id, title: s.title, startsAt: s.startAt, endsAt: s.endAt, courtNames: s.courts, quantity: qty, seats: qty, unitPrice: s.price, amount: s.price * qty }],
          },
        },
      })
      await db.sessionRegistration.update({ where: { id: reg.id }, data: { bookingId: booking.id } })
      await db.payment.create({ data: { bookingId: booking.id, provider: 'mock', method: 'LINE_PAY', amount: booking.total, status: 'SUCCESS', providerRef: `MOCK-DEMO-${booking.code}`, paidAt: booking.paidAt } })
    }
  }

  // 退款範例：部分退款成功（模擬）、待人工處理、退款失敗
  const paidFuture = await db.booking.findMany({ where: { status: 'PAID', items: { some: {} } }, include: { items: true }, take: 3, orderBy: { playDate: 'asc' } })
  const kinds = [
    { status: 'SUCCEEDED', method: 'ORIGINAL', reason: '客人改期，退部分款項（展示）' },
    { status: 'MANUAL_PENDING', method: 'MANUAL', reason: '信用卡已停用，改匯款退回（展示）' },
    { status: 'FAILED', method: 'ORIGINAL', reason: '客人要求退款（展示）', fail: '模擬金流回覆失敗：超過可退款期限' },
  ]
  for (const [i, b] of paidFuture.entries()) {
    const k = kinds[i]
    const item = b.items[0]
    const amount = Math.round(item.price * 0.5)
    await db.refund.create({
      data: {
        bookingId: b.id,
        idempotencyKey: `demo-refund-${b.id}`,
        status: k.status,
        method: k.method,
        cashAmount: amount,
        pointsAmount: 0,
        reason: k.reason,
        cancelItems: false,
        provider: 'demo-simulator',
        providerRef: k.status === 'SUCCEEDED' ? `SIM-REFUND-${i}` : null,
        failReason: k.fail ?? null,
        createdBy: 'admin:展示',
        completedAt: k.status === 'SUCCEEDED' || k.status === 'FAILED' ? now : null,
        items: { create: [{ itemType: 'COURT', itemId: item.id, label: `場地 ${item.courtName}`, cashAmount: amount, pointsAmount: 0 }] },
      },
    })
    if (k.status !== 'FAILED') {
      await db.bookingItem.update({ where: { id: item.id }, data: { refundedAmount: amount } })
      await db.booking.update({ where: { id: b.id }, data: { refundedAmount: amount, refundStatus: k.status === 'SUCCEEDED' ? 'PARTIAL' : 'MANUAL' } })
    } else {
      await db.booking.update({ where: { id: b.id }, data: { refundStatus: 'FAILED' } })
    }
  }

  await db.voucher.createMany({
    data: [
      { code: 'DEMO100', title: '新會員 100 元折價券（展示）', type: 'AMOUNT', value: 100, minSpend: 500, expiresAt: new Date(now.getTime() + 30 * 86_400_000) },
      { code: 'DEMO90', title: '平日 9 折（展示）', type: 'PERCENT', value: 90, minSpend: 0, expiresAt: new Date(now.getTime() + 60 * 86_400_000) },
      { code: 'DEMOVIP', title: 'VIP 生日禮（展示）', type: 'AMOUNT', value: 300, minSpend: 0, userId: users[0].id, expiresAt: new Date(now.getTime() + 20 * 86_400_000) },
    ],
  })
  await db.memberRestriction.create({ data: { userId: users[5].id, type: 'NO_ACTIVITY', reason: '連續三次未到（展示資料）', createdBy: 'admin:展示', expiresAt: new Date(now.getTime() + 14 * 86_400_000) } })
  await db.coach.create({ data: { name: '示範教練 阿凱', status: 'ACTIVE', specialties: ['新手入門', '雙打戰術'], hourlyRate: 1200, bio: '展示資料' } })
  await db.expense.createMany({
    data: [
      { expenseNumber: 'EXP-DEMO-0001', category: 'MAINTENANCE', amount: 3200, status: 'APPROVED', description: '球網更換（展示）', submittedAt: new Date(now.getTime() - 5 * 86_400_000) },
      { expenseNumber: 'EXP-DEMO-0002', category: 'UTILITIES', amount: 5400, status: 'SUBMITTED', description: '照明電費（展示）', submittedAt: new Date(now.getTime() - 2 * 86_400_000) },
    ],
  })
  // 儲值方案（展示用，不是正式售價）與幾筆儲值單
  const plans = await Promise.all([
    db.topUpPlan.create({ data: { name: '儲值 1,000（展示）', price: 1000, points: 1000, bonusPoints: 0, scopeNote: '場地租借與活動報名結帳折抵', validityNote: '入帳後 12 個月', refundNote: '未使用之付費點數可申請退款，贈點不退', active: true, sortOrder: 1, createdBy: 'demo' } }),
    db.topUpPlan.create({ data: { name: '儲值 3,000 送 300（展示）', price: 3000, points: 3000, bonusPoints: 300, scopeNote: '場地租借與活動報名結帳折抵', validityNote: '入帳後 12 個月', refundNote: '未使用之付費點數可申請退款，贈點不退', active: true, sortOrder: 2, createdBy: 'demo' } }),
    db.topUpPlan.create({ data: { name: '儲值 5,000 送 750（展示）', price: 5000, points: 5000, bonusPoints: 750, scopeNote: '場地租借與活動報名結帳折抵', validityNote: '入帳後 12 個月', refundNote: '未使用之付費點數可申請退款，贈點不退', active: false, sortOrder: 3, createdBy: 'demo' } }),
  ])
  const topUpStates: Array<[number, number, string]> = [[0, 1, 'CREDITED'], [1, 2, 'CREDITED'], [2, 1, 'PENDING'], [3, 2, 'CREDIT_FAILED'], [4, 1, 'FAILED']]
  for (const [i, [ui, pi, status]] of topUpStates.entries()) {
    const plan = plans[pi - 1]
    const u = users[ui]
    const at = new Date(now.getTime() - (i + 1) * 86_400_000)
    const order = await db.topUpOrder.create({
      data: {
        code: `TP-DEMO000${i + 1}`,
        userId: u.id,
        planId: plan.id,
        planName: plan.name,
        amount: plan.price,
        points: plan.points,
        bonusPoints: plan.bonusPoints,
        status,
        provider: status === 'PENDING' ? null : 'mock',
        method: status === 'PENDING' ? null : 'CREDIT_CARD',
        providerRef: status === 'PENDING' ? null : `MOCKDEMO${i}`,
        paidAt: status === 'CREDITED' || status === 'CREDIT_FAILED' ? at : null,
        creditedAt: status === 'CREDITED' ? at : null,
        failReason: status === 'CREDIT_FAILED' ? '入帳失敗：資料庫暫時無法連線（展示）' : status === 'FAILED' ? '模擬付款失敗（卡片遭拒）' : null,
        expiresAt: status === 'PENDING' ? new Date(now.getTime() + 20 * 60_000) : null,
        createdAt: at,
      },
    })
    if (status === 'CREDITED') {
      const after1 = (await db.user.update({ where: { id: u.id }, data: { points: { increment: plan.points } } })).points
      await db.pointsLedger.create({ data: { userId: u.id, delta: plan.points, balanceAfter: after1, kind: 'TOPUP_PAID', reason: `儲值 ${order.code}（${plan.name}）`, actor: 'system', idempotencyKey: `topup:${order.id}:paid`, createdAt: at } })
      if (plan.bonusPoints > 0) {
        const after2 = (await db.user.update({ where: { id: u.id }, data: { points: { increment: plan.bonusPoints } } })).points
        await db.pointsLedger.create({ data: { userId: u.id, delta: plan.bonusPoints, balanceAfter: after2, kind: 'TOPUP_BONUS', reason: `儲值 ${order.code} 贈點（${plan.name}）`, actor: 'system', idempotencyKey: `topup:${order.id}:bonus`, createdAt: at } })
      }
    }
  }
  log('完成')
  return { venueId: venue.id }
}
