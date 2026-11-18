import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden } from '@/components/admin/page-bits'
import { prisma } from '@/lib/db'
import { ACTIVITY_TYPE_LABEL, type ActivityTypeKey } from '@/lib/activity-shared'
import { getActivityAdmin } from '@/server/activity-admin'
import { ActivityEditor, type EditorFlash } from '@/app/admin/activities/activity-editor'
import { editorFormFromActivity } from '@/app/admin/activities/editor-initial'
import { SessionsTable } from '@/app/admin/activities/sessions-table'
import { ArchiveButton } from '@/app/admin/activities/[id]/archive-button'
import { MARKETING_ACTIVITY_PATHS } from '../workbench-paths'
import { MarketingBreadcrumb } from '../breadcrumb'

export const metadata: Metadata = { title: '編輯活動｜活動與行銷設計' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '草稿', cls: 'bg-amber-100 text-amber-800' },
  PUBLISHED: { label: '已發布', cls: 'bg-emerald-100 text-emerald-800' },
  ARCHIVED: { label: '已下架', cls: 'bg-zinc-100 text-zinc-600' },
}

export default async function MarketingActivityEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string; c?: string; f?: string; preview?: string }>
}) {
  if ((await pagePermission('activities')) === 'forbidden') return <Forbidden />
  const [{ id }, q] = await Promise.all([params, searchParams])
  const [data, venue] = await Promise.all([
    getActivityAdmin(id),
    prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, include: { courts: { orderBy: { sortOrder: 'asc' } } } }),
  ])
  if (!data || !venue) notFound()
  const a = data.activity
  const grid = { openMinute: venue.openMinute, closeMinute: venue.closeMinute, slotMinutes: venue.slotMinutes }
  const courts = venue.courts.map((c) => ({ id: c.id, name: c.name, active: c.active }))
  const flash: EditorFlash | null =
    q.done === 'draft' || q.done === 'publish' ? { mode: q.done, created: Number(q.c) || 0, failed: Number(q.f) || 0 } : null
  const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.DRAFT

  return (
    <div className="space-y-4">
      <ActivityEditor
        variant="workbench"
        paths={MARKETING_ACTIVITY_PATHS}
        breadcrumb={
          <MarketingBreadcrumb
            current={a.title}
            badge={<span className={`ml-1 flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>}
          />
        }
        flash={flash}
        openPreviewOnMount={q.preview === '1'}
        activityId={a.id}
        status={a.status}
        initial={editorFormFromActivity(a)}
        venue={grid}
        courts={courts}
      />

      {(data.sessions.length > 0 || a.status === 'PUBLISHED') && (
        <section aria-label="場次列表" className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-700">場次列表（改期、取消、新增場次）</h2>
          <SessionsTable
            activityId={a.id}
            repeat={a.repeatKind === 'WEEKLY' || data.sessions.length > 1}
            sessions={data.sessions}
            courts={courts}
            venue={grid}
            typeLabel={ACTIVITY_TYPE_LABEL[a.type as ActivityTypeKey]}
          />
        </section>
      )}

      <div className="flex justify-end">
        <ArchiveButton id={a.id} draft={a.status === 'DRAFT'} disabled={a.status === 'ARCHIVED'} listHref="/admin/marketing#activities" />
      </div>
    </div>
  )
}
