import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { prisma } from '@/lib/db'
import { ActivityEditor } from '../activity-editor'
import { newEditorForm } from '../editor-initial'

export const metadata: Metadata = { title: '新增活動' }
export const dynamic = 'force-dynamic'

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ repeat?: string }> }) {
  if ((await pagePermission('activities')) === 'forbidden') return <Forbidden />
  const { repeat } = await searchParams
  const weekly = repeat === 'WEEKLY'
  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { courts: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!venue) return <p className="text-sm text-muted">尚未設定場館</p>

  const initial = newEditorForm(venue, weekly)

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
