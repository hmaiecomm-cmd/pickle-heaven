import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle, Pill, SourceNote } from '@/components/admin/page-bits'

const STATE: Record<string, [string, 'blue' | 'green' | 'red' | 'amber']> = {
  PROCESSING: ['處理中', 'blue'],
  SUCCEEDED: ['成功', 'green'],
  FAILED: ['失敗', 'red'],
  MANUAL_PENDING: ['待人工處理', 'amber'],
  MANUAL_DONE: ['人工已完成', 'green'],
}
const METHOD: Record<string, string> = { ORIGINAL: '原付款方式', POINTS: '點數', MANUAL: '人工' }

export async function RefundsTab({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />

  const { status = '' } = searchParams as { status?: string }
  const rows = await prisma.refund.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      booking: { select: { id: true, code: true, contactName: true } },
      items: true
    },
  } as any)
  const filters = [['', '全部'], ['PROCESSING', '處理中'], ['MANUAL_PENDING', '待人工處理'], ['FAILED', '失敗'], ['SUCCEEDED', '成功']]

  return (
    <div>
      <PageTitle title="退款紀錄" desc="每筆退款的金額、方式、狀態與經手人。處理中、成功、失敗分開顯示；模擬金流的結果另外標示。" />
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        {filters.map(([k, l]) => (
          <Link key={k} href={k ? `/admin/finance?tab=refunds&status=${k}` : '/admin/finance?tab=refunds'} className={`rounded-full px-3 py-1 ${status === k ? 'bg-brand-100 font-semibold text-brand-800' : 'bg-white ring-1 ring-zinc-200'}`}>{l}</Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-muted">
            <tr><th className="px-3 py-2 font-medium">時間</th><th className="px-3 py-2 font-medium">訂單</th><th className="px-3 py-2 font-medium">項目</th><th className="px-3 py-2 text-right font-medium">金額</th><th className="px-3 py-2 font-medium">方式</th><th className="px-3 py-2 font-medium">狀態</th><th className="px-3 py-2 font-medium">經手</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">沒有退款紀錄</td></tr>}
            {rows.map((r: any) => {
              const [l, t] = STATE[r.status] ?? [r.status, 'blue']
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{r.createdAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</td>
                  <td className="px-3 py-2"><Link href={`/admin/finance?tab=bookings&order=${r.booking.id}`} className="font-mono text-brand-700 hover:underline">{r.booking.code}</Link><span className="block text-[11px] text-muted">{r.booking.contactName}</span></td>
                  <td className="max-w-[18rem] px-3 py-2 text-xs">{r.items.map((i: any) => i.label).join('；') || '整筆訂單'}<span className="block text-muted">原因：{r.reason}</span></td>
                  <td className="px-3 py-2 text-right font-tabular">${r.cashAmount}{r.pointsAmount ? ` +${r.pointsAmount}P` : ''}</td>
                  <td className="px-3 py-2">{METHOD[r.method]}</td>
                  <td className="px-3 py-2"><Pill tone={t}>{l}</Pill></td>
                  <td className="px-3 py-2 text-xs text-muted">{r.createdBy === 'USER' ? '—' : r.createdBy}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
