import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '操作紀錄' }
export const dynamic = 'force-dynamic'

const PAGE = 50

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  if ((await pagePermission('audit')) === 'forbidden') return <Forbidden />
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const page = Math.max(1, Number(sp.page) || 1)
  const where = q ? { OR: [{ actor: { contains: q } }, { action: { contains: q.toUpperCase() } }, { target: { contains: q } }] } : {}
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * PAGE, take: PAGE }),
  ])
  const pages = Math.max(1, Math.ceil(total / PAGE))
  return (
    <div>
      <PageTitle title="操作紀錄" desc="後台與系統的重要操作：退款、發票、設備指令、會員限制、活動異動、登入帳號變更等。" />
      <form className="mb-3 flex gap-2" action="/admin/audit">
        <input name="q" defaultValue={q} placeholder="操作者、動作或對象" className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 text-sm" aria-label="搜尋操作紀錄" />
        <button type="submit" className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">搜尋</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-muted">
            <tr><th className="px-3 py-2 font-medium">時間</th><th className="px-3 py-2 font-medium">操作者</th><th className="px-3 py-2 font-medium">動作</th><th className="px-3 py-2 font-medium">對象</th><th className="px-3 py-2 font-medium">內容</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2 text-xs">{r.createdAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</td>
                <td className="px-3 py-2 text-xs">{r.actor}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 text-xs">{r.target}</td>
                <td className="max-w-[24rem] truncate px-3 py-2 text-[11px] text-muted" title={r.detail ? JSON.stringify(r.detail) : ''}>{r.detail ? JSON.stringify(r.detail) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-end gap-3 text-sm">
        <span className="text-muted">共 {total} 筆・第 {page}／{pages} 頁</span>
        {page > 1 && <Link href={`/admin/audit?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-brand-700 hover:underline">上一頁</Link>}
        {page < pages && <Link href={`/admin/audit?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-brand-700 hover:underline">下一頁</Link>}
      </div>
    </div>
  )
}
