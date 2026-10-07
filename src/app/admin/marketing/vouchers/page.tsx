import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Forbidden, PageTitle, SourceNote } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '優惠與票券方案' }
export const dynamic = 'force-dynamic'

export default async function VoucherPlansPage() {
  if ((await pagePermission('marketing')) === 'forbidden') return <Forbidden />
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })
  const plans = new Map<string, { title: string; type: string; value: number; minSpend: number; total: number; used: number; expired: number }>()
  const at = new Date()
  for (const v of vouchers) {
    const key = `${v.title}|${v.type}|${v.value}|${v.minSpend}`
    const p = plans.get(key) ?? { title: v.title, type: v.type, value: v.value, minSpend: v.minSpend, total: 0, used: 0, expired: 0 }
    p.total++
    if (v.usedAt) p.used++
    else if (v.expiresAt && v.expiresAt < at) p.expired++
    plans.set(key, p)
  }
  return (
    <div>
      <PageTitle title="優惠與票券方案" desc="依現有折價券彙整的方案與使用情形。建立新方案與發送票券尚未開放（需搭配行銷通知與發送紀錄）。" />
      {plans.size === 0 ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted">目前沒有折價券</p> : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-muted">
              <tr><th className="px-3 py-2 font-medium">方案</th><th className="px-3 py-2 font-medium">優惠</th><th className="px-3 py-2 text-right font-medium">低消</th><th className="px-3 py-2 text-right font-medium">發出</th><th className="px-3 py-2 text-right font-medium">已使用</th><th className="px-3 py-2 text-right font-medium">已過期</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {[...plans.values()].map((p) => (
                <tr key={`${p.title}${p.value}`}>
                  <td className="px-3 py-2">{p.title}</td>
                  <td className="px-3 py-2">{p.type === 'AMOUNT' ? `折 NT$${p.value}` : `${p.value / 10} 折`}</td>
                  <td className="px-3 py-2 text-right">NT${p.minSpend}</td>
                  <td className="px-3 py-2 text-right">{p.total}</td>
                  <td className="px-3 py-2 text-right">{p.used}</td>
                  <td className="px-3 py-2 text-right">{p.expired}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SourceNote className="mt-2" source="折價券紀錄" updatedAt={new Date()} />
    </div>
  )
}
