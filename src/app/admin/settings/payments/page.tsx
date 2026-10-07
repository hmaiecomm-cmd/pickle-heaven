import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { isDemoTenant } from '@/lib/db'
import { availableProviders, linepayProvider, mockProvider, newebpayProvider, tappayProvider } from '@/lib/payments'
import { invoiceIntegration } from '@/server/invoice-service'
import { Forbidden, PageTitle, Pill } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: '金流與發票設定' }
export const dynamic = 'force-dynamic'

export default async function PaymentSettingsPage() {
  if ((await pagePermission('settings')) === 'forbidden') return <Forbidden />
  const demo = await isDemoTenant()
  const primary = process.env.PAYMENT_PROVIDER ?? 'mock'
  const providers = [mockProvider, tappayProvider, newebpayProvider, linepayProvider].map((p) => ({
    id: p.id,
    name: p.displayName,
    configured: p.isConfigured(),
    refund: Boolean(p.refund),
  }))
  const enabled = new Set(availableProviders().map((p) => p.id))
  const inv = await invoiceIntegration()
  return (
    <div className="space-y-4">
      <PageTitle title="金流與發票設定" desc="顯示目前實際生效的設定。金鑰屬於伺服器環境變數，不在畫面上顯示或修改。" />
      {demo && <p className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">展示環境一律使用模擬金流與模擬發票服務，不會連線真實金流。</p>}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">金流</h2>
        <p className="mt-1 text-xs text-muted">主要金流：{primary}{primary === 'mock' ? '（模擬金流：付款與退款都不是真實款項）' : ''}</p>
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {providers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{p.name}<span className="ml-2 font-mono text-xs text-muted">{p.id}</span></span>
              <span className="flex gap-1">
                <Pill tone={p.configured ? 'green' : 'gray'}>{p.configured ? '已設定' : '未設定'}</Pill>
                <Pill tone={enabled.has(p.id as never) ? 'blue' : 'gray'}>{enabled.has(p.id as never) ? '結帳可用' : '結帳未開放'}</Pill>
                <Pill tone={p.refund ? 'green' : 'amber'}>{p.refund ? '支援線上退款' : '不支援線上退款'}</Pill>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold">電子發票</h2>
        <p className="mt-1 text-sm">
          <Pill tone={inv.connected ? (inv.simulated ? 'violet' : 'green') : 'gray'}>{inv.label}</Pill>
        </p>
        {inv.reason && <p className="mt-1 text-xs text-muted">{inv.reason}</p>}
        <p className="mt-2 text-xs text-muted">目前的發票資料是內部紀錄，未上傳財政部電子發票平台。串接服務商後才能開立、補寄與作廢重開。</p>
      </section>
    </div>
  )
}
