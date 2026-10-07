import 'server-only'
import { Prisma, RegistrationStatus } from '@prisma/client'
import { prisma, mainPrisma, currentTenant } from '@/lib/db'
import { formatDateTime, now, taipeiDateString, taipeiMinuteOfDay } from '@/lib/time'
import { formatRange } from '@/lib/time'
import { ROLE_LABEL } from '@/lib/admin-permissions'
import { POINTS_KIND_LABEL, type PointsKind } from './points-ledger'

/**
 * 人員管理查詢：會員、教練、工作人員與管理員、黑名單。
 * 會員資料來自前台 Google 登入自動建立的 User；教練身分（isCoach／Coach）與後台角色（AdminAccount）分開。
 */

export type PeopleTab = 'all' | 'coaches' | 'staff' | 'blacklist'
export const PAGE_SIZE = 20

export interface PeopleQuery {
  tab: PeopleTab
  q?: string
  role?: 'member' | 'coach' | 'staff' | ''
  status?: 'normal' | 'restricted' | ''
  from?: string
  to?: string
  sort?: 'joined' | 'login' | 'points' | 'name'
  page?: number
}

export const ACCOUNT_STATUS_LABEL = { normal: '正常', restricted: '受限（黑名單）', limited: '受限（禁止報名）' } as const

function activeRestrictionWhere(type?: string): Prisma.MemberRestrictionWhereInput {
  return { ...(type ? { type } : {}), revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] }
}

export async function listPeople(qy: PeopleQuery) {
  const page = Math.max(1, qy.page ?? 1)
  const text = (qy.q ?? '').trim()
  const digits = text.replace(/[^\d]/g, '')
  const where: Prisma.UserWhereInput = {}
  const and: Prisma.UserWhereInput[] = []
  if (text) {
    and.push({ OR: [{ displayName: { contains: text } }, { email: { contains: text.toLowerCase() } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] })
  }
  if (qy.from) and.push({ createdAt: { gte: new Date(`${qy.from}T00:00:00+08:00`) } })
  if (qy.to) and.push({ createdAt: { lt: new Date(`${qy.to}T23:59:59+08:00`) } })
  if (qy.tab === 'coaches' || qy.role === 'coach') and.push({ isCoach: true })
  if (qy.tab === 'blacklist' || qy.status === 'restricted') and.push({ restrictions: { some: activeRestrictionWhere('BLACKLIST') } })
  if (qy.status === 'normal') and.push({ restrictions: { none: activeRestrictionWhere() } })
  if (and.length) where.AND = and

  // 工作人員與管理員：以後台帳號為主（正式資料庫），可對應會員
  const tenant = await currentTenant()
  const staffAccounts = tenant === 'main' ? await mainPrisma.adminAccount.findMany({ where: { tenant: 'main' }, orderBy: [{ role: 'asc' }, { username: 'asc' }] }) : []
  const staffUserIds = staffAccounts.map((a) => a.userId).filter((x): x is string => Boolean(x))
  if (qy.role === 'staff') and.push({ id: { in: staffUserIds } })

  const orderBy: Prisma.UserOrderByWithRelationInput =
    qy.sort === 'login' ? { lastLoginAt: { sort: 'desc', nulls: 'last' } } : qy.sort === 'points' ? { points: 'desc' } : qy.sort === 'name' ? { displayName: 'asc' } : { createdAt: 'desc' }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { restrictions: { where: activeRestrictionWhere() }, _count: { select: { bookings: true } } },
    }),
  ])
  const staffByUser = new Map(staffAccounts.filter((a) => a.userId).map((a) => [a.userId as string, a]))

  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: users.map((u) => {
      const black = u.restrictions.find((r) => r.type === 'BLACKLIST')
      const noAct = u.restrictions.find((r) => r.type === 'NO_ACTIVITY')
      const staff = staffByUser.get(u.id)
      return {
        id: u.id,
        name: u.displayName,
        avatar: u.pictureUrl,
        email: u.email,
        emailVerified: Boolean(u.googleSub && u.email),
        phone: u.phone,
        roles: ['會員', ...(u.isCoach ? ['教練'] : []), ...(staff ? [ROLE_LABEL[staff.role as keyof typeof ROLE_LABEL] ?? staff.role] : [])],
        status: black ? ('restricted' as const) : noAct ? ('limited' as const) : ('normal' as const),
        statusLabel: black ? ACCOUNT_STATUS_LABEL.restricted : noAct ? ACCOUNT_STATUS_LABEL.limited : ACCOUNT_STATUS_LABEL.normal,
        points: u.points,
        /** 可提前預約天數：目前依場館預設（會員個別資格於下一階段） */
        bookAhead: null as number | null,
        joinedAt: formatDateTime(u.createdAt),
        lastLoginAt: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : null,
        bookings: u._count.bookings,
        blacklistReason: black?.reason ?? null,
        blacklistUntil: black?.expiresAt ? formatDateTime(black.expiresAt) : black ? '永久' : null,
      }
    }),
    coaches: qy.tab === 'coaches' ? await prisma.coach.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, status: true, phone: true, userId: true } }) : [],
    staff: qy.tab === 'staff' ? staffAccounts.map((a) => ({ id: a.id, username: a.username, displayName: a.displayName, role: a.role, roleLabel: ROLE_LABEL[a.role as keyof typeof ROLE_LABEL] ?? a.role, active: a.active, userId: a.userId, lastLoginAt: a.lastLoginAt ? formatDateTime(a.lastLoginAt) : null })) : [],
  }
}

export type MemberDetailTab = 'profile' | 'bookings' | 'orders' | 'points' | 'roles' | 'logs'

export async function getMemberDetail(id: string, opts: { dateType?: 'created' | 'play'; from?: string; to?: string } = {}) {
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      restrictions: { orderBy: { createdAt: 'desc' } },
      vouchers: { orderBy: { createdAt: 'desc' }, take: 50 },
      pointsLedger: { orderBy: { createdAt: 'desc' }, take: 100 },
    },
  })
  if (!u) return null
  const bookingWhere: Prisma.BookingWhereInput = { userId: id }
  if (opts.from || opts.to) {
    if (opts.dateType === 'play') bookingWhere.playDate = { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) }
    else bookingWhere.createdAt = { ...(opts.from ? { gte: new Date(`${opts.from}T00:00:00+08:00`) } : {}), ...(opts.to ? { lt: new Date(`${opts.to}T23:59:59+08:00`) } : {}) }
  }
  const [bookings, regs, staff, coach, audit, courts] = await Promise.all([
    prisma.booking.findMany({ where: bookingWhere, orderBy: { createdAt: 'desc' }, take: 100, include: { items: true, activityItems: true, payments: { select: { status: true, provider: true } }, refunds: { select: { status: true, cashAmount: true, pointsAmount: true } } } }),
    prisma.sessionRegistration.findMany({ where: { userId: id }, orderBy: { registeredAt: 'desc' }, take: 100, include: { session: { select: { id: true, title: true, startAt: true, endAt: true, status: true, courts: { include: { court: { select: { name: true } } } } } } } }),
    (await currentTenant()) === 'main' ? mainPrisma.adminAccount.findFirst({ where: { userId: id } }) : Promise.resolve(null),
    prisma.coach.findFirst({ where: { userId: id } }),
    prisma.auditLog.findMany({ where: { OR: [{ target: u.displayName }, { target: id }] }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.court.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ])
  const at = now()
  const today = taipeiDateString()
  const live = bookings.filter((b) => ['PAID', 'COMPLETED'].includes(b.status))
  const paid = live.reduce((s, b) => s + b.total, 0)
  const refunded = bookings.reduce((s, b) => s + b.refundedAmount, 0)
  const pointsUsed = live.reduce((s, b) => s + b.pointsUsed, 0)
  const black = u.restrictions.find((r) => r.type === 'BLACKLIST' && !r.revokedAt && (!r.expiresAt || r.expiresAt > at))
  const courtName = new Map(courts.map((c) => [c.id, c.name]))

  return {
    user: {
      id: u.id,
      name: u.displayName,
      avatar: u.pictureUrl,
      email: u.email,
      emailVerified: Boolean(u.googleSub && u.email),
      phone: u.phone,
      points: u.points,
      isCoach: u.isCoach,
      adminNote: u.adminNote,
      joinedAt: formatDateTime(u.createdAt),
      lastLoginAt: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : null,
      loginMethod: u.googleSub ? 'Google' : u.lineUserId ? 'LINE（舊）' : '—',
      restricted: Boolean(black),
      blacklist: black ? { id: black.id, reason: black.reason, until: black.expiresAt ? formatDateTime(black.expiresAt) : '永久', by: black.createdBy, at: formatDateTime(black.createdAt), internalNote: black.internalNote } : null,
      staff: staff ? { username: staff.username, role: staff.role, roleLabel: ROLE_LABEL[staff.role as keyof typeof ROLE_LABEL] ?? staff.role, active: staff.active } : null,
      coach: coach ? { id: coach.id, name: coach.name, status: coach.status } : null,
    },
    money: { paid, refunded, net: paid - refunded, pointsUsed, period: opts.from || opts.to ? `${opts.from ?? '…'}～${opts.to ?? '…'}（${opts.dateType === 'play' ? '使用日期' : '下單日期'}）` : '全部期間' },
    bookings: bookings.map((b) => ({
      id: b.id,
      code: b.code,
      status: b.status,
      playDate: b.playDate,
      createdAt: formatDateTime(b.createdAt),
      total: b.total,
      subtotal: b.subtotal,
      discount: b.discount,
      pointsUsed: b.pointsUsed,
      refunded: b.refundedAmount,
      refundStatus: b.refundStatus,
      courtLines: b.items.map((i) => `${i.courtName} ${formatRange(taipeiMinuteOfDay(i.startsAt), taipeiMinuteOfDay(i.startsAt) + Math.round((i.endsAt.getTime() - i.startsAt.getTime()) / 60_000))}`),
      activityLines: b.activityItems.map((i) => `${i.title} ×${i.quantity}`),
      upcoming: ['PAID', 'PENDING'].includes(b.status) && b.playDate >= today,
      paymentOk: b.payments.some((p) => p.status === 'SUCCESS'),
    })),
    registrations: regs.map((r) => {
      const start = taipeiMinuteOfDay(r.session.startAt)
      const end = start + Math.round((r.session.endAt.getTime() - r.session.startAt.getTime()) / 60_000)
      const date = taipeiDateString(r.session.startAt)
      return {
        id: r.id,
        sessionId: r.session.id,
        title: r.session.title,
        date,
        timeLabel: formatRange(start, end),
        courts: r.session.courts.map((c) => c.court.name).join('、') || '—',
        quantity: r.quantity,
        status: r.status,
        /** 未到場只來自點名紀錄（NO_SHOW），不因時間已過推定 */
        statusLabel: ({ CONFIRMED: r.session.endAt <= at ? '已結束（未點名）' : '已報名', WAITLISTED: '候補', PENDING: '待付款／暫留', COMPLETED: '已出席', CANCELLED: '已取消', LATE_CANCEL: '逾期取消', NO_SHOW: '未到場', EXPIRED: '已逾時' } as Record<string, string>)[r.status] ?? r.status,
        bookingId: r.bookingId,
        upcoming: r.session.endAt > at && ['CONFIRMED', 'WAITLISTED', 'PENDING'].includes(r.status),
      }
    }),
    ledger: u.pointsLedger.map((l) => ({ id: l.id, at: formatDateTime(l.createdAt), delta: l.delta, balanceAfter: l.balanceAfter, kind: POINTS_KIND_LABEL[l.kind as PointsKind] ?? l.kind, reason: l.reason, actor: l.actor, bookingId: l.bookingId })),
    vouchers: u.vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      title: v.title,
      kind: v.ticketKind ? ({ OFFPEAK: '離峰券', PEAK: '尖峰券', GENERAL: '通用券' } as Record<string, string>)[v.ticketKind] ?? v.ticketKind : v.type === 'AMOUNT' ? `折價券（折 NT$${v.value}）` : `折價券（${v.value / 10} 折）`,
      units: v.units,
      courts: v.courtIds ? v.courtIds.split(',').filter(Boolean).map((c) => courtName.get(c) ?? c).join('、') : '全部場地',
      expiresAt: v.expiresAt ? formatDateTime(v.expiresAt) : null,
      state: v.revokedAt ? '已撤銷' : v.usedAt ? '已核銷' : v.expiresAt && v.expiresAt < at ? '已過期' : '可使用',
      issuedBy: v.issuedBy,
      issueReason: v.issueReason,
      createdAt: formatDateTime(v.createdAt),
      revokeReason: v.revokeReason,
    })),
    restrictions: u.restrictions.map((r) => ({ id: r.id, type: r.type, reason: r.reason, internalNote: r.internalNote, createdAt: formatDateTime(r.createdAt), createdBy: r.createdBy, expiresAt: r.expiresAt ? formatDateTime(r.expiresAt) : null, revoked: r.revokedAt ? `${formatDateTime(r.revokedAt)} ${r.revokedBy ?? ''}：${r.revokeReason ?? ''}` : null, active: !r.revokedAt && (!r.expiresAt || r.expiresAt > at) })),
    audit: audit.map((a) => ({ id: a.id, at: formatDateTime(a.createdAt), actor: a.actor, action: a.action, detail: a.detail ? JSON.stringify(a.detail).slice(0, 300) : '' })),
    courts,
    registrationStatuses: Object.values(RegistrationStatus),
  }
}
