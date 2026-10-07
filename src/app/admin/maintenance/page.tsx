import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { formatDateTime, taipeiDateString, taipeiMinuteOfDay } from '@/lib/time'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { UnblockButton } from './unblock-button'

export const metadata: Metadata = { title: '封場與維護' }
export const dynamic = 'force-dynamic'

export default async function MaintenancePage() {
  if ((await pagePermission('courts.manage')) === 'forbidden') return <Forbidden />
  const [blocks, courts] = await Promise.all([
    prisma.reservation.findMany({ where: { status: 'BLOCKED', endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, take: 200, include: { court: { select: { name: true } } } }),
    prisma.court.findMany({ where: { status: { not: 'ACTIVE' } }, select: { id: true, name: true, status: true } }),
  ])
  return (
    <div className="space-y-4">
      <PageTitle title="封場與維護" desc="封場時段客人無法預約；新增封場請到預約行事曆點選空白時段。整面場地停用或維護請到「場地與時段」。" right={<Link href="/admin/schedule" className="text-sm text-brand-700 hover:underline">到預約行事曆新增封場 →</Link>} />
      {courts.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">停用或維護中的場地</p>
          <p className="mt-1">{courts.map((c) => `${c.name}（${c.status === 'MAINTENANCE' ? '維護中' : '停用'}）`).join('、')}</p>
        </section>
      )}
      <section className="rounded-2xl border border-zinc-200 bg-white">
        {blocks.length === 0 ? <p className="p-6 text-center text-sm text-muted">目前沒有排定的封場時段</p> : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>{b.court.name}　{formatDateTime(b.startsAt)}–{formatDateTime(b.endsAt).split(' ')[1]}<span className="ml-2 text-xs text-muted">{b.note ?? '場館維護'}</span></span>
                <UnblockButton courtId={b.courtId} date={taipeiDateString(b.startsAt)} start={taipeiMinuteOfDay(b.startsAt)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
