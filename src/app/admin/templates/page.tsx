import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { prisma } from '@/lib/db'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { parseWeekdays } from '@/lib/session-schedule'
import { TemplatesClient, type TemplateRow } from './templates-client'

export const metadata: Metadata = { title: '週期性範本' }
export const dynamic = 'force-dynamic'

export default async function AdminTemplatesPage() {
  if ((await pagePermission('activities')) === 'forbidden') return <Forbidden />
  // 週期性範本已併入「活動」（可設定結束日期／次數、跳過日期，並先預覽場地衝突）
  redirect('/admin/activities')

  const templates = await prisma.sessionTemplate.findMany({
    orderBy: [{ active: 'desc' }, { weekday: 'asc' }, { startMinute: 'asc' }],
    include: {
      venue: { select: { name: true } },
      _count: { select: { sessions: true } },
    },
  })

  const rows: TemplateRow[] = templates.map((t) => ({
    id: t.id,
    venueName: t.venue.name,
    sessionCount: t._count.sessions,
    title: t.title,
    weekdays: parseWeekdays(t.weekdays, t.weekday),
    startMinute: t.startMinute,
    endMinute: t.endMinute,
    capacity: t.capacity,
    reservedCapacity: t.reservedCapacity,
    skillLevelMin: t.skillLevelMin,
    skillLevelMax: t.skillLevelMax,
    price: t.price,
    bookingOpenDaysBefore: t.bookingOpenDaysBefore,
    bookingOpenHourOffset: t.bookingOpenHourOffset,
    cancellationMode: t.cancellationMode,
    cancellationHoursBefore: t.cancellationHoursBefore,
    waitlistEnabled: t.waitlistEnabled,
    autoPromote: t.autoPromote,
    allowPostLockReplacement: t.allowPostLockReplacement,
    generateWeeksAhead: t.generateWeeksAhead,
    active: t.active,
  }))

  return (
    <div className="space-y-4">
      <Link
        href="/admin/sessions"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-brand-600"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        回球敘列表
      </Link>
      <TemplatesClient templates={rows} />
    </div>
  )
}
