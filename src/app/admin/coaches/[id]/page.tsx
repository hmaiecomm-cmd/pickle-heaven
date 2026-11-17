import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { prisma } from '@/lib/db'
import { CoachEditForm } from './edit-form'

export const metadata: Metadata = { title: '教練詳情' }
export const dynamic = 'force-dynamic'

export default async function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if ((await pagePermission('members')) === 'forbidden') return <Forbidden />
  const { id } = await params

  const coach = await prisma.coach.findUnique({
    where: { id },
  })

  if (!coach) {
    return (
      <div className="space-y-4">
        <PageTitle title="教練詳情" desc="教練資料與設定" />
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-muted">
          找不到該教練
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageTitle title={coach.name} desc="編輯教練資料與設定" />
        <Link href="/admin/members?tab=coaches" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50">
          返回列表
        </Link>
      </div>

      {coach.userId && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h3 className="font-semibold mb-3 text-sm">對應會員資訊</h3>
          <div className="text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted">會員 ID：</span>
              <Link href={`/admin/members/${coach.userId}`} className="text-brand-700 hover:underline">
                {coach.userId}
              </Link>
            </div>
          </div>
        </section>
      )}

      <CoachEditForm coach={coach} />
    </div>
  )
}
