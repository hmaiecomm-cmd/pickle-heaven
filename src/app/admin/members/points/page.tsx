import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '點數與票券' }
export const dynamic = 'force-dynamic'

export default async function PointsPage() {
  if ((await pagePermission('members')) === 'forbidden') return <Forbidden />
  const [holders, vouchers, totals] = await Promise.all([
    prisma.user.findMany({ where: { points: { gt: 0 } }, orderBy: { points: 'desc' }, take: 50, select: { id: true, displayName: true, points: true } }),
    prisma.voucher.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { user: { select: { id: true, displayName: true } } } }),
    prisma.user.aggregate({ _sum: { points: true }, _count: { _all: true }, where: { points: { gt: 0 } } }),
  ])
  return (
    <div className="space-y-4">
      <PageTitle title="點數與票券" desc="點數 1 點＝NT$1，來自取消與退款回補；票券為折價券。手動調整點數尚未開放（需要點數異動明細帳，才能追蹤每一筆來源）。" />
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">持有點數的會員（{totals._count._all} 位，共 {totals._sum.points ?? 0} 點）</h2>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {holders.length === 0 && <li className="py-2 text-muted">沒有會員持有點數</li>}
          {holders.map((u) => (
            <li key={u.id} className="flex justify-between py-2">
              <Link href={`/admin/members/${u.id}`} className="hover:underline">{u.displayName} <span className="text-xs text-muted">#{u.id.slice(-6)}</span></Link>
              <span className="tabular">{u.points} 點</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">票券</h2>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {vouchers.length === 0 && <li className="py-2 text-muted">沒有票券</li>}
          {vouchers.map((v) => (
            <li key={v.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span><span className="font-mono">{v.code}</span>　{v.title}</span>
              <span className="text-xs text-muted">
                {v.type === 'AMOUNT' ? `折 NT$${v.value}` : `${v.value / 10} 折`}・{v.user ? `專屬 ${v.user.displayName}` : '通用'}・{v.usedAt ? '已使用' : v.expiresAt && v.expiresAt < new Date() ? '已過期' : '可使用'}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <SourceNote source="會員點數餘額與折價券" updatedAt={new Date()} />
    </div>
  )
}
