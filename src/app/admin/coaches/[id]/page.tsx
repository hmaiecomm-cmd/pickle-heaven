import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { prisma } from '@/lib/db'

export const metadata: Metadata = { title: '教練詳情' }
export const dynamic = 'force-dynamic'

export default async function CoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if ((await pagePermission('members')) === 'forbidden') return <Forbidden />
  const { id } = await params

  const coach = await prisma.coach.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, displayName: true, email: true, phone: true, pictureUrl: true } },
      _count: { select: { sessions: true } },
    },
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

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold mb-4">基本資料</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">教練名稱</label>
            <div className="text-sm font-medium">{coach.name}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">狀態</label>
            <div className="text-sm font-medium">
              {coach.status === 'ACTIVE' ? '在職' : coach.status === 'ON_LEAVE' ? '請假' : '停用'}
            </div>
          </div>
          {coach.user && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">對應會員</label>
                <Link href={`/admin/members/${coach.user.id}`} className="text-sm text-brand-700 hover:underline">
                  {coach.user.displayName}
                </Link>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Email</label>
                <div className="text-sm">{coach.user.email ?? '未設定'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">電話</label>
                <div className="text-sm">{coach.user.phone ?? '未設定'}</div>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">授課場次</label>
            <div className="text-sm font-medium">{coach._count.sessions} 場</div>
          </div>
        </div>
      </section>

      <div className="flex gap-2 justify-end">
        <Link href="/admin/members?tab=coaches" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50">
          取消
        </Link>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          保存更改
        </button>
      </div>
    </div>
  )
}
