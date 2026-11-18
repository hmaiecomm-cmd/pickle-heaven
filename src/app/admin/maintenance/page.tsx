import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { formatDateTime, isValidDateString, slotStarts, taipeiDateString, taipeiMinuteOfDay } from '@/lib/time'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { listMaintenance } from '@/server/maintenance-admin'
import { shortDateLabel } from '@/lib/activity-shared'
import { MaintenanceClient } from './maintenance-client'
import { UnblockButton } from './unblock-button'
import { BlockForm } from './block-form'

export const metadata: Metadata = { title: '維護與封場' }
export const dynamic = 'force-dynamic'

/**
 * 清潔／維護排程與人工封場共用同一頁（活動管理與場地管理都連到這裡），不建兩套紀錄。
 * 兩者都寫進同一套場地占用（Reservation.BLOCKED），前台一律顯示不可租借。
 */
/**
 * 活動占場：直接讀活動發布時寫入的場地占用（Reservation.EVENT），同一場次同一面場地的連續時段合併成一列。
 * 不另存資料，改期、取消時由活動模組釋放或重建這些占用，這裡自然同步。
 */
async function listActivityOccupancy(activityId?: string) {
  const rows = await prisma.reservation.findMany({
    where: { status: 'EVENT', endsAt: { gt: new Date() }, ...(activityId ? { session: { activityId } } : {}) },
    orderBy: [{ startsAt: 'asc' }],
    take: 2000,
    select: {
      courtId: true,
      startsAt: true,
      endsAt: true,
      holdExpiresAt: true,
      sessionId: true,
      court: { select: { name: true, sortOrder: true } },
      session: { select: { title: true, activityId: true, status: true } },
    },
  })
  type Row = { key: string; courtName: string; sortOrder: number; startsAt: Date; endsAt: Date; title: string; activityId: string | null; sessionId: string | null; hold: Date | null; draft: boolean }
  const merged: Row[] = []
  const last = new Map<string, Row>()
  for (const r of rows) {
    const k = `${r.sessionId}|${r.courtId}`
    const prev = last.get(k)
    if (prev && prev.endsAt.getTime() === r.startsAt.getTime()) {
      prev.endsAt = r.endsAt
      continue
    }
    const row: Row = {
      key: `${k}|${r.startsAt.toISOString()}`,
      courtName: r.court.name,
      sortOrder: r.court.sortOrder,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      title: r.session?.title ?? '活動',
      activityId: r.session?.activityId ?? null,
      sessionId: r.sessionId,
      hold: r.holdExpiresAt,
      draft: r.session?.status === 'DRAFT',
    }
    merged.push(row)
    last.set(k, row)
  }
  return merged.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.sortOrder - b.sortOrder)
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ tab?: string; court?: string; date?: string; start?: string; activity?: string }> }) {
  const ctx = await pagePermission('courts')
  if (ctx === 'forbidden') return <Forbidden />
  const { tab: rawTab, court: preCourt, date: preDate, start: preStart, activity: activityFilter } = await searchParams
  const tab = rawTab === 'manual' ? 'manual' : rawTab === 'activity' ? 'activity' : 'plans'
  const canManage = can(ctx.role, 'courts.manage')

  const venue = await prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { openMinute: true, closeMinute: true, slotMinutes: true, courts: { where: { active: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } } } })
  if (!venue) return <p className="text-sm text-muted">尚未建立場館。</p>

  const [data, blocks, courts, eventRows] = await Promise.all([
    listMaintenance(),
    prisma.reservation.findMany({ where: { status: 'BLOCKED', maintenanceEventId: null, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, take: 200, include: { court: { select: { name: true } } } }),
    prisma.court.findMany({ where: { status: { not: 'ACTIVE' } }, select: { id: true, name: true, status: true } }),
    tab === 'activity' ? listActivityOccupancy(activityFilter) : Promise.resolve([]),
  ])

  return (
    <div className="space-y-4">
      <PageTitle title="維護與封場" desc="清潔維護與人工封場都會占用場地：前台該時段顯示「清潔維護・暫不開放」或「封場」，不能訂場也不能安排活動。" />
      <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm" aria-label="分頁">
        {(
          [
            ['plans', '清潔／維護排程'],
            ['manual', '人工封場'],
            ['activity', '活動占場'],
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

      {tab === 'activity' ? (
        <section className="space-y-3">
          <p className="text-xs text-muted">
            已發布活動（與草稿保留場地）占用的球場時段，由活動發布時自動建立；一般預約不能訂這些時段。改期或取消請到活動的場次列表操作，這裡會同步更新。人工封場與清潔維護在其他分頁，來源分開。
          </p>
          {activityFilter && (
            <p className="text-sm">
              只顯示單一活動的占場・<Link href="/admin/maintenance?tab=activity" className="text-brand-700 hover:underline">顯示全部</Link>
            </p>
          )}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            {eventRows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">目前沒有活動占用的時段</p>
            ) : (
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-brand-50 text-left text-xs text-brand-900">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">日期</th>
                    <th className="px-4 py-2.5 font-semibold">場地</th>
                    <th className="px-4 py-2.5 font-semibold">占場時段</th>
                    <th className="px-4 py-2.5 font-semibold">關聯活動</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {eventRows.map((r) => {
                    const date = taipeiDateString(r.startsAt)
                    return (
                      <tr key={r.key}>
                        <td className="whitespace-nowrap px-4 py-2.5">{shortDateLabel(date)}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold">{r.courtName}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 tabular">
                          {formatDateTime(r.startsAt).split(' ')[1]}–{formatDateTime(r.endsAt).split(' ')[1]}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.title}
                          {r.hold && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">草稿保留至 {formatDateTime(r.hold)}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          {r.activityId ? (
                            <Link href={`/admin/marketing/activities/${r.activityId}`} className="text-brand-700 hover:underline">
                              查看活動
                            </Link>
                          ) : r.sessionId ? (
                            <Link href={`/admin/sessions/${r.sessionId}`} className="text-brand-700 hover:underline">
                              查看場次
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : tab === 'plans' ? (
        <MaintenanceClient data={data} canManage={canManage} />
      ) : (
        <section className="space-y-3">
          <p className="text-xs text-muted">人工封場以單一時段格為單位；整面場地停用或維護請到「場地設定」。</p>
          {canManage && (
            <BlockForm
              courts={venue.courts}
              starts={slotStarts(venue.openMinute, venue.closeMinute, venue.slotMinutes)}
              slotMinutes={venue.slotMinutes}
              today={taipeiDateString()}
              initial={{ courtId: preCourt, date: preDate && isValidDateString(preDate) ? preDate : undefined, start: preStart && /^\d+$/.test(preStart) ? Number(preStart) : undefined }}
            />
          )}
          <div className="rounded-2xl border border-zinc-200 bg-white">
            {blocks.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">目前沒有人工封場時段</p>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {blocks.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span>
                      {b.court.name}　{formatDateTime(b.startsAt)}–{formatDateTime(b.endsAt).split(' ')[1]}
                      <span className="ml-2 text-xs text-muted">{b.note ?? '場館維護'}{b.lighting ? '・開燈' : '・不開燈'}</span>
                    </span>
                    {canManage && <UnblockButton courtId={b.courtId} date={taipeiDateString(b.startsAt)} start={taipeiMinuteOfDay(b.startsAt)} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/admin/schedule" className="text-sm text-brand-700 hover:underline">到智慧排程查看當日預約 →</Link>
        </section>
      )}
    </div>
  )
}
