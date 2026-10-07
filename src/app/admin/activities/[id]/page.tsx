import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { ACTIVITY_TYPE_LABEL, type ActivityTypeKey, type PriceUnitKey } from '@/lib/activity-shared'
import { getActivityAdmin } from '@/server/activity-admin'
import { ActivityEditor, type EditorForm } from '../activity-editor'
import { SessionsTable } from '../sessions-table'
import { ArchiveButton } from './archive-button'

export const metadata: Metadata = { title: '編輯活動' }
export const dynamic = 'force-dynamic'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const [data, venue] = await Promise.all([
    getActivityAdmin(id),
    prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { orderBy: { sortOrder: 'asc' } } } }),
  ])
  if (!data || !venue) notFound()
  const a = data.activity

  const initial: EditorForm = {
    title: a.title,
    type: a.type as ActivityTypeKey,
    summary: a.summary ?? '',
    description: a.description ?? '',
    levelLabel: a.levelLabel ?? '',
    requirements: a.requirements ?? '',
    includes: a.includes ?? '',
    refundNote: a.refundNote ?? '',
    coverAssetId: a.coverAssetId,
    coverFocusX: a.coverFocusX,
    coverFocusY: a.coverFocusY,
    price: a.price,
    priceUnit: a.priceUnit as PriceUnitKey,
    capacity: a.capacity,
    maxPerOrder: a.maxPerOrder,
    repeatKind: a.repeatKind as 'ONCE' | 'WEEKLY',
    weekdays: a.weekdays,
    intervalWeeks: a.intervalWeeks,
    startMinute: a.startMinute,
    endMinute: a.endMinute,
    seriesStartDate: a.seriesStartDate,
    endMode: a.occurrenceCount && !a.seriesEndDate ? 'COUNT' : 'DATE',
    seriesEndDate: a.seriesEndDate ?? a.seriesStartDate,
    occurrenceCount: a.occurrenceCount ?? 8,
    skipDates: a.skipDates,
    courtIds: a.courtIds,
    openDaysBefore: a.openDaysBefore,
    openMinute: a.openMinute,
    closeMinutesBefore: a.closeMinutesBefore,
  }
  const grid = { openMinute: venue.openMinute, closeMinute: venue.closeMinute, slotMinutes: venue.slotMinutes }
  const courts = venue.courts.map((c) => ({ id: c.id, name: c.name, active: c.active }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/activities" aria-label="返回活動列表" className="-ml-2 rounded-lg p-2 text-muted hover:surface-2">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">{a.title}</h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px]">
          {a.status === 'PUBLISHED' ? '已發布' : a.status === 'DRAFT' ? '草稿' : '已下架'}
        </span>
        {a.holdUntil && <span className="text-[11px] text-amber-700">保留場地至 {new Date(a.holdUntil).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span>}
        <div className="ml-auto">
          <ArchiveButton id={a.id} draft={a.status === 'DRAFT'} disabled={a.status === 'ARCHIVED'} />
        </div>
      </div>

      {data.sessions.length > 0 && (
        <SessionsTable
          activityId={a.id}
          repeat={a.repeatKind === 'WEEKLY' || data.sessions.length > 1}
          sessions={data.sessions}
          courts={courts}
          venue={grid}
          typeLabel={ACTIVITY_TYPE_LABEL[a.type as ActivityTypeKey]}
        />
      )}

      <ActivityEditor activityId={a.id} status={a.status} initial={initial} venue={grid} courts={courts} />
    </div>
  )
}
