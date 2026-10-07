import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { taipeiDateString } from '@/lib/time'
import { Forbidden, PageTitle, Pill, SourceNote } from '@/components/admin/page-bits'
import { RESTRICTION_LABEL } from '@/server/member-restrictions'
import { orderStatusOf, paymentStatusOf, maskEmail } from '@/server/admin-orders'
import { RestrictionPanel } from './restriction-panel'

export const metadata: Metadata = { title: '會員紀錄' }
export const dynamic = 'force-dynamic'

const money = (n: number) => `NT$${n.toLocaleString()}`
const dt = (d: Date) => d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await pagePermission('members')
  if (ctx === 'forbidden') return <Forbidden />
  const { id } = await params
  const m = await prisma.user.findUnique({
    where: { id },
    include: {
      bookings: { orderBy: { createdAt: 'desc' }, take: 50, include: { items: true, activityItems: true, payments: { select: { status: true, provider: true } } } },
      registrations: { orderBy: { registeredAt: 'desc' }, take: 50, include: { session: { select: { id: true, title: true, startAt: true } } } },
      vouchers: { orderBy: { createdAt: 'desc' }, take: 20 },
      restrictions: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!m) notFound()
  const showMoney = can(ctx.role, 'finance') || can(ctx.role, 'bookings')
  const paidTotal = m.bookings.filter((b) => ['PAID', 'COMPLETED'].includes(b.status)).reduce((s, b) => s + b.total, 0)
  const refunded = m.bookings.reduce((s, b) => s + b.refundedAmount, 0)

  return (
    <div className="space-y-4">
      <PageTitle title={m.displayName} desc={`會員 #${m.id.slice(-6)}・加入 ${dt(m.createdAt)}`} right={<Link href="/admin/members/history" className="text-sm text-brand-700 hover:underline">← 會員預約與消費紀錄</Link>} />
      <section className="grid gap-3 sm:grid-cols-4">
        <Box label="電話" value={m.phone ?? '—'} />
        <Box label="Email" value={m.email ? maskEmail(m.email) : '—'} />
        <Box label="點數" value={`${m.points} 點`} />
        {showMoney && <Box label="累計實付／已退" value={`${money(paidTotal)}／${money(refunded)}`} />}
      </section>

      <RestrictionPanel
        userId={m.id}
        canEdit={can(ctx.role, 'members.restrict')}
        rows={m.restrictions.map((r) => ({
          id: r.id,
          label: RESTRICTION_LABEL[r.type] ?? r.type,
          reason: r.reason,
          createdAt: dt(r.createdAt),
          createdBy: r.createdBy,
          expiresAt: r.expiresAt ? dt(r.expiresAt) : null,
          revoked: r.revokedAt ? `${dt(r.revokedAt)} ${r.revokedBy ?? ''}：${r.revokeReason ?? ''}` : null,
          active: !r.revokedAt && (!r.expiresAt || r.expiresAt > new Date()),
        }))}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">預約與消費（最近 50 筆）</h2>
        {m.bookings.length === 0 ? <p className="mt-2 text-sm text-muted">沒有訂單</p> : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {m.bookings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/bookings?order=${b.id}`} className="font-mono text-brand-700 hover:underline">{b.code}</Link>
                <span className="text-xs text-muted">{b.playDate}・場地 {b.items.length}・活動 {b.activityItems.length}</span>
                <span className="flex items-center gap-1">
                  <Pill tone={paymentStatusOf(b) === 'PAID' ? 'green' : 'gray'}>{{ PAID: '已付款', PENDING: '待付款', FAILED: '付款失敗', UNPAID: '未付款' }[paymentStatusOf(b)]}</Pill>
                  <Pill>{{ ACTIVE: '有效', CANCELLED: '已取消', EXPIRED: '已過期', COMPLETED: '已完成', REFUND_PENDING: '款項待退' }[orderStatusOf(b.status)]}</Pill>
                  {showMoney && <span className="tabular">{money(b.total)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">活動報名</h2>
        {m.registrations.length === 0 ? <p className="mt-2 text-sm text-muted">沒有活動報名</p> : (
          <ul className="mt-2 divide-y divide-zinc-100 text-sm">
            {m.registrations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/sessions/${r.session.id}`} className="hover:underline">{taipeiDateString(r.session.startAt)} {r.session.title}</Link>
                <span className="text-xs text-muted">{r.quantity} 位・{{ CONFIRMED: '已報名', PENDING: '暫留／待付款', EXPIRED: '已逾時', CANCELLED: '已取消', LATE_CANCEL: '逾時取消', WAITLISTED: '候補', NO_SHOW: '未到', COMPLETED: '已出席' }[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">票券</h2>
        {m.vouchers.length === 0 ? <p className="mt-2 text-sm text-muted">沒有專屬票券</p> : (
          <ul className="mt-2 space-y-1 text-sm">
            {m.vouchers.map((v) => (
              <li key={v.id}>{v.code}　{v.title}・{v.usedAt ? '已使用' : v.expiresAt && v.expiresAt < new Date() ? '已過期' : '可使用'}</li>
            ))}
          </ul>
        )}
      </section>
      <SourceNote source="會員、訂單、報名與票券紀錄" basis="累計實付僅含已付款與已完成訂單" updatedAt={new Date()} />
    </div>
  )
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  )
}
