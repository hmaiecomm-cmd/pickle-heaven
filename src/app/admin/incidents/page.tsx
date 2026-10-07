import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { detectIncidents, listIncidents } from '@/server/monitor-service'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { IncidentsClient } from './incidents-client'

export const metadata: Metadata = { title: '異常警示與處理紀錄' }
export const dynamic = 'force-dynamic'

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  if ((await pagePermission('monitor')) === 'forbidden') return <Forbidden />
  const { all } = await searchParams
  await detectIncidents()
  const rows = await listIncidents(all ? 'ALL' : 'OPEN', 200)
  return (
    <div>
      <PageTitle title="異常警示與處理紀錄" desc="系統依退款、付款、設備與場地佔用自動偵測；狀況排除後自動標記解除。人工處理請填寫說明，會記入操作紀錄。" />
      <IncidentsClient
        showAll={Boolean(all)}
        rows={rows.map((r) => ({
          id: r.id,
          type: r.type,
          severity: r.severity,
          title: r.title,
          detail: r.detail,
          link: r.link,
          status: r.status,
          note: r.note,
          createdAt: r.createdAt.toISOString(),
          resolvedAt: r.resolvedAt?.toISOString() ?? null,
          resolvedBy: r.resolvedBy,
        }))}
      />
    </div>
  )
}
