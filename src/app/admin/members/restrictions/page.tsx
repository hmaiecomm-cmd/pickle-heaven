import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'
import { RESTRICTION_LABEL } from '@/server/member-restrictions'

export const metadata: Metadata = { title: '會員限制與黑名單' }
export const dynamic = 'force-dynamic'

export default async function RestrictionsPage() {
  if ((await pagePermission('members.restrict')) === 'forbidden') return <Forbidden />
  const rows = await prisma.memberRestriction.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { user: { select: { id: true, displayName: true } } } })
  const at = new Date()
  return (
    <div>
      <PageTitle title="會員限制與黑名單" desc="新增限制請到會員紀錄頁，需填寫原因並記入操作紀錄。限制在建立訂單與報名活動時由後端檢查。" right={<Link href="/admin/members/history" className="text-sm text-brand-700 hover:underline">搜尋會員 →</Link>} />
      {rows.length === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted">目前沒有限制紀錄</p> : (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white text-sm">
          {rows.map((r) => {
            const active = !r.revokedAt && (!r.expiresAt || r.expiresAt > at)
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={active ? 'red' : 'gray'}>{active ? '生效中' : '已解除／過期'}</Pill>
                  <Link href={`/admin/members/${r.user.id}`} className="font-semibold text-brand-700 hover:underline">{r.user.displayName}</Link>
                  <span>{RESTRICTION_LABEL[r.type] ?? r.type}</span>
                </div>
                <p className="mt-1 text-xs text-muted">原因：{r.reason}・{r.createdBy}・{r.createdAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}{r.expiresAt ? `・到期 ${r.expiresAt.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })}` : ''}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
