import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'
import { maskEmail, maskPhone } from '@/server/admin-orders'

export const metadata: Metadata = { title: '會員預約與消費紀錄' }
export const dynamic = 'force-dynamic'

export default async function MemberHistoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const { q = '' } = await searchParams
  const text = q.trim()
  const digits = text.replace(/[^\d]/g, '')
  const members = text
    ? await prisma.user.findMany({
        where: {
          OR: [
            { displayName: { contains: text } },
            { email: { contains: text.toLowerCase() } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
            { bookings: { some: { OR: [{ contactName: { contains: text } }, ...(digits.length >= 3 ? [{ contactPhone: { contains: digits } }] : []), { code: { contains: text.toUpperCase() } }] } } },
          ],
        },
        include: { _count: { select: { bookings: true, registrations: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    : []
  return (
    <div>
      <PageTitle title="會員預約與消費紀錄" desc="以姓名、電話、Email 或訂單編號找會員，再查看其預約、活動、消費、點數與聯絡資料。同名會員以電話末碼與會員編號區分，不自動視為同一人。" />
      <form className="mb-4 flex gap-2" action="/admin/members/history">
        <input name="q" defaultValue={q} placeholder="姓名、電話、Email 或訂單編號" className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 text-sm" aria-label="搜尋會員" />
        <button type="submit" className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">搜尋</button>
        {q && <Link href="/admin/members/history" className="grid h-10 place-items-center rounded-lg border border-zinc-300 px-3 text-sm">清除條件</Link>}
      </form>
      {!text ? (
        <p className="text-sm text-muted">請輸入搜尋條件。</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted">找不到符合「{text}」的會員。</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                <Link href={`/admin/members/${m.id}`} className="font-semibold text-brand-700 hover:underline">{m.displayName}</Link>
                <span className="ml-2 text-xs text-muted">#{m.id.slice(-6)}・{maskPhone(m.phone) || '無電話'}{m.email ? `・${maskEmail(m.email)}` : ''}</span>
              </span>
              <span className="text-xs text-muted">訂單 {m._count.bookings}・活動 {m._count.registrations}・點數 {m.points}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
