import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle, Pill, SourceNote } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '退款紀錄' }
export const dynamic = 'force-dynamic'

const STATE: Record<string, [string, 'blue' | 'green' | 'red' | 'amber']> = {
  PROCESSING: ['處理中', 'blue'],
  SUCCEEDED: ['成功', 'green'],
  FAILED: ['失敗', 'red'],
  MANUAL_PENDING: ['待人工處理', 'amber'],
  MANUAL_DONE: ['人工已完成', 'green'],
}
const METHOD: Record<string, string> = { ORIGINAL: '原付款方式', POINTS: '點數', MANUAL: '人工' }

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const { status = '' } = await searchParams
  const rows = await prisma.refund.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { booking: { select: { id: true, code: true, contactName: true } }, items: true },
  })
  const filters = [['', '全部'], ['PROCESSING', '處理中'], ['MANUAL_PENDING', '待人工處理'], ['FAILED', '失敗'], ['SUCCEEDED', '成功']]
  return (
    <div>
      <PageTitle title="退款紀錄" desc="每筆退款的金額、方式、狀態與經手人。處理中、成功、失敗分開顯示；模擬金流的結果另外標示。" />
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {filters.map(([k, l]) => (
          <Link key={k} href={k ? `/admin/refunds?status=${k}` : '/admin/refunds'} className={`rounded-full px-3 py-1 ${status === k ? 'bg-brand-100 font-semibold text-brand-800' : 'bg-white ring-1 ring-zinc-200'}`}>{l}</Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-muted">
            <tr><th className="px-3 py-2 font-medium">時間</th><th className="px-3 py-2 font-medium">訂單</th><th className="px-3 py-2 font-medium">項目</th><th className="px-3 py-2 text-right font-medium">金額</th><th className="px-3 py-2 font-medium">方式</th><th className="px-3 py-2 font-medium">狀態</th><th className="px-3 py-2 font-medium">經手</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">沒有退款紀錄</td></tr>}
            {rows.map((r) => {
              const [l, t] = STATE[r.status] ?? [r.status, 'blue']
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.createdAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</td>
                  <td className="px-3 py-2"><Link href={`/admin/bookings?order=${r.booking.id}`} className="font-mono text-brand-700 hover:underline">{r.booking.code}</Link><span className="block text-[11px] text-muted">{r.booking.contactName}</span></td>
                  <td className="max-w-[18rem] px-3 py-2 text-xs">{r.items.map((i) => i.label).join('；') || '整筆訂單'}<span className="block text-muted">原因：{r.reason}</span></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular">NT${r.cashAmount.toLocaleString()}{r.pointsAmount ? <span className="block text-[11px]">＋{r.pointsAmount} 點</span> : null}</td>
                  <td className="px-3 py-2 text-xs">{METHOD[r.method] ?? r.method}{r.cancelItems ? '・取消預約' : ''}</td>
                  <td className="px-3 py-2"><Pill tone={t}>{l}</Pill>{(r.provider === 'mock' || r.provider === 'demo-simulator') && <Pill tone="violet" className="ml-1">模擬</Pill>}{r.failReason && <span className="block text-[11px] text-red-700">{r.failReason}</span>}</td>
                  <td className="px-3 py-2 text-xs text-muted">{r.createdBy}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <SourceNote className="mt-2" source="退款紀錄" basis="金額為實付金額（不含點數）；點數另列" updatedAt={new Date()} />
    </div>
  )
}
