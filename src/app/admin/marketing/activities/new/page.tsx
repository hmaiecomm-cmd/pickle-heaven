import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { prisma } from '@/lib/db'
import { ActivityEditor } from '@/app/admin/activities/activity-editor'
import { newEditorForm } from '@/app/admin/activities/editor-initial'
import { MARKETING_ACTIVITY_PATHS } from '../workbench-paths'
import { MarketingBreadcrumb } from '../breadcrumb'

export const metadata: Metadata = { title: '新增活動｜活動與行銷設計' }
export const dynamic = 'force-dynamic'

/** 行銷入口的新增活動：B 版單頁工作台，沿用活動模組的表單、驗證與發布流程 */
export default async function MarketingActivityNewPage({ searchParams }: { searchParams: Promise<{ repeat?: string }> }) {
  if ((await pagePermission('activities')) === 'forbidden') return <Forbidden />
  const { repeat } = await searchParams
  const venue = await prisma.venue.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { courts: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!venue) return <p className="text-sm text-muted">尚未設定場館</p>

  return (
    <ActivityEditor
      variant="workbench"
      paths={MARKETING_ACTIVITY_PATHS}
      breadcrumb={<MarketingBreadcrumb current="新增活動" />}
      activityId={null}
      status={null}
      initial={newEditorForm(venue, repeat === 'WEEKLY')}
      venue={{ openMinute: venue.openMinute, closeMinute: venue.closeMinute, slotMinutes: venue.slotMinutes }}
      courts={venue.courts.map((c) => ({ id: c.id, name: c.name, active: c.active }))}
    />
  )
}
