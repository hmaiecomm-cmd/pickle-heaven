import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { formatDateTime, taipeiDateString, taipeiMinuteOfDay } from '@/lib/time'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { listMaintenance } from '@/server/maintenance-admin'
import { MaintenanceClient } from './maintenance-client'
import { UnblockButton } from './unblock-button'

export const metadata: Metadata = { title: '清潔／維護排程與封場' }
export const dynamic = 'force-dynamic'

/**
 * 清潔／維護排程與人工封場共用同一頁（活動管理與場地管理都連到這裡），不建兩套紀錄。
 * 兩者都寫進同一套場地占用（Reservation.BLOCKED），前台一律顯示不可租借。
 */
export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await pagePermission('courts')
  if (ctx === 'forbidden') return <Forbidden />
  const { tab: rawTab } = await searchParams
  const tab = rawTab === 'manual' ? 'manual' : 'plans'
  const canManage = can(ctx.role, 'courts.manage')

  const [data, blocks, courts] = await Promise.all([
    listMaintenance(),
    prisma.reservation.findMany({ where: { status: 'BLOCKED', maintenanceEventId: null, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, take: 200, include: { court: { select: { name: true } } } }),
    prisma.court.findMany({ where: { status: { not: 'ACTIVE' } }, select: { id: true, name: true, status: true } }),
  ])

  return (
    <div className="space-y-4">
      <PageTitle title="清潔／維護排程與封場" desc="清潔維護與人工封場都會占用場地：前台該時段顯示「清潔維護・暫不開放」或「封場」，不能訂場也不能安排活動。" />
      <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm" aria-label="分頁">
        {(
          [
            ['plans', '清潔／維護排程'],
            ['manual', '人工封場'],
          ] as const
        ).map(([k, label]) => (
          <Link key={k} href={`/admin/maintenance?tab=${k}`} aria-current={tab === k ? 'page' : undefined} className={`rounded-lg px-3 py-1.5 font-medium ${tab === k ? 'bg-white shadow-sm' : 'text-muted hover:text-[rgb(var(--fg))]'}`}>
            {label}
          </Link>
        ))}
      </nav>

      {courts.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">停用或維護中的場地</p>
          <p className="mt-1">{courts.map((c) => `${c.name}（${c.status === 'MAINTENANCE' ? '維護中' : '停用'}）`).join('、')}</p>
        </section>
      )}

      {tab === 'plans' ? (
        <MaintenanceClient data={data} canManage={canManage} />
      ) : (
        <section className="space-y-3">
          <p className="text-xs text-muted">人工封場以單一時段格為單位；新增請到預約行事曆點選空白時段。整面場地停用或維護請到「場地與時段」。</p>
          <div className="rounded-2xl border border-zinc-200 bg-white">
            {blocks.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">目前沒有人工封場時段</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {blocks.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span>
                      {b.court.name}　{formatDateTime(b.startsAt)}–{formatDateTime(b.endsAt).split(' ')[1]}
                      <span className="ml-2 text-xs text-muted">{b.note ?? '場館維護'}</span>
                    </span>
                    {canManage && <UnblockButton courtId={b.courtId} date={taipeiDateString(b.startsAt)} start={taipeiMinuteOfDay(b.startsAt)} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/admin/schedule" className="text-sm text-brand-700 hover:underline">到預約行事曆新增封場 →</Link>
        </section>
      )}
    </div>
  )
}
