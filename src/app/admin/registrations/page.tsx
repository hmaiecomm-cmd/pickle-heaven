import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { formatDateTime } from '@/lib/time'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '報名與候補／通知名單' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, [string, 'green' | 'blue' | 'amber' | 'gray']> = {
  CONFIRMED: ['已報名', 'green'],
  PENDING: ['暫留／待付款', 'blue'],
  WAITLISTED: ['候補（舊制）', 'amber'],
}

export default async function RegistrationsPage() {
  if ((await pagePermission('activities.view')) === 'forbidden') return <Forbidden />
  const now = new Date()
  const sessions = await prisma.session.findMany({
    where: { deletedAt: null, endAt: { gt: now }, status: { notIn: ['CANCELLED', 'DRAFT'] } },
    orderBy: { startAt: 'asc' },
    take: 30,
    include: {
      registrations: {
        where: { OR: [{ status: { in: ['CONFIRMED', 'WAITLISTED'] } }, { status: 'PENDING', holdExpiresAt: { gt: now } }] },
        include: { user: { select: { id: true, displayName: true } } },
        orderBy: { registeredAt: 'asc' },
      },
      watches: { where: { cancelledAt: null }, include: { user: { select: { id: true, displayName: true } } } },
    },
  })
  return (
    <div>
      <PageTitle title="報名與候補／通知名單" desc="未來場次的報名名單、付款中的暫留，以及「有名額通知我」的訂閱者（通知不保留名額）。舊制候補只會出現在舊資料。" />
      <div className="space-y-3">
        {sessions.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted">沒有未來場次</p>}
        {sessions.map((s) => (
          <section key={s.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/admin/sessions/${s.id}`} className="font-semibold hover:underline">{formatDateTime(s.startAt)}　{s.title}</Link>
              <span className="text-xs text-muted">名額 {s.capacity - s.reservedCapacity}・已報名 {s.registrations.filter((r) => r.status === 'CONFIRMED').reduce((a, r) => a + r.seats, 0)}・通知訂閱 {s.watches.length}</span>
            </div>
            {s.registrations.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                {s.registrations.map((r) => {
                  const [l, t] = STATUS[r.status] ?? [r.status, 'gray']
                  return (
                    <li key={r.id}>
                      <Link href={`/admin/members/${r.user.id}`}><Pill tone={t}>{r.user.displayName}・{r.quantity}・{l}</Pill></Link>
                    </li>
                  )
                })}
              </ul>
            )}
            {s.watches.length > 0 && (
              <p className="mt-2 text-xs text-muted">有名額通知：{s.watches.map((w) => `${w.user.displayName}${w.notifiedAt ? '（已通知）' : ''}`).join('、')}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
