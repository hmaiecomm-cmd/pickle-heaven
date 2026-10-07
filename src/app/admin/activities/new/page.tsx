import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { addDays, taipeiDateString } from '@/lib/time'
import { ActivityEditor, type EditorForm } from '../activity-editor'

export const metadata: Metadata = { title: '新增活動' }
export const dynamic = 'force-dynamic'

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ repeat?: string }> }) {
  await requireAdmin()
  const { repeat } = await searchParams
  const weekly = repeat === 'WEEKLY'
  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { courts: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!venue) return <p className="text-sm text-muted">尚未設定場館</p>

  const start = addDays(taipeiDateString(), 7)
  const startMinute = Math.min(Math.max(venue.openMinute, 19 * 60), venue.closeMinute - 2 * venue.slotMinutes)
  const initial: EditorForm = {
    title: '',
    type: 'OPEN_PLAY',
    summary: '',
    description: '',
    levelLabel: '',
    requirements: '',
    includes: '',
    refundNote: '',
    coverAssetId: null,
    coverFocusX: 50,
    coverFocusY: 50,
    price: 0,
    priceUnit: 'PER_PERSON',
    capacity: 8,
    maxPerOrder: 4,
    repeatKind: weekly ? 'WEEKLY' : 'ONCE',
    weekdays: weekly ? [new Date(`${start}T00:00:00+08:00`).getUTCDay()] : [],
    intervalWeeks: 1,
    startMinute,
    endMinute: startMinute + 2 * venue.slotMinutes,
    seriesStartDate: start,
    endMode: 'COUNT',
    seriesEndDate: addDays(start, 56),
    occurrenceCount: 8,
    skipDates: [],
    // 使用場地為必填：不預設指派，由管理者明確選擇
    courtIds: [],
    openDaysBefore: 7,
    openMinute: null,
    closeMinutesBefore: 60,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/activities" aria-label="返回活動列表" className="-ml-2 rounded-lg p-2 text-muted hover:surface-2">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">新增活動</h1>
      </div>
      <ActivityEditor
        activityId={null}
        status={null}
        initial={initial}
        venue={{ openMinute: venue.openMinute, closeMinute: venue.closeMinute, slotMinutes: venue.slotMinutes }}
        courts={venue.courts.map((c) => ({ id: c.id, name: c.name, active: c.active }))}
      />
    </div>
  )
}
