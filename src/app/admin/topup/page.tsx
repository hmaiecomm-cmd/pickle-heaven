import type { Metadata } from 'next'
import Link from 'next/link'
import { pagePermission } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { prisma } from '@/lib/db'
import { formatDateTime } from '@/lib/time'
import { Forbidden, PageTitle, Pill, SourceNote } from '@/components/admin/page-bits'
import { expireStaleTopUps, TOPUP_STATUS_LABEL, type TopUpStatus } from '@/server/topup-service'
import { CreditButton } from './credit-button'

export const metadata: Metadata = { title: '儲值單' }
export const dynamic = 'force-dynamic'

const TONE: Record<TopUpStatus, 'green' | 'amber' | 'red' | 'gray' | 'blue'> = { PENDING: 'amber', PAID: 'blue', CREDITED: 'green', CREDIT_FAILED: 'red', FAILED: 'gray', EXPIRED: 'gray', CANCELLED: 'gray' }
const sel = 'h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm'

/** 儲值單（擁有者）：付款與入帳狀態分開；已收款但入帳失敗者可安全補入 */
export default async function TopUpOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const ctx = await pagePermission('finance')
  if (ctx === 'forbidden') return <Forbidden />
  const sp = await searchParams
  await expireStaleTopUps()
  const status = sp.status && sp.status in TOPUP_STATUS_LABEL ? sp.status : ''
  const q = sp.q?.trim() ?? ''
  const rows = await prisma.topUpOrder.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ code: { contains: q.toUpperCase() } }, { user: { displayName: { contains: q } } }, { user: { email: { contains: q } } }, { providerRef: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { id: true, displayName: true, email: true, points: true } } },
  })
  const totals = rows.reduce((acc, r) => {
    if (r.status === 'CREDITED') { acc.amount += r.amount; acc.points += r.points; acc.bonus += r.bonusPoints }
    if (r.status === 'CREDIT_FAILED' || r.status === 'PAID') acc.pending += 1
    return acc
  }, { amount: 0, points: 0, bonus: 0, pending: 0 })
  const canCredit = can(ctx.role, 'finance.adjust')

  return (
    <div className="space-y-4">
      <PageTitle title="儲值單" desc="付款由金流回呼確認後才入點；回呼重送、頁面重整或連點都不會重複入點。「已收款，入帳失敗」可在此安全補入，不需客人再付款。" />
      <section className="grid gap-3 sm:grid-cols-4">
        <Box label="已入帳收款（此列表）" value={`NT$${totals.amount.toLocaleString()}`} />
        <Box label="已入帳付費點數" value={`${totals.points.toLocaleString()} 點`} />
        <Box label="已入帳贈點" value={`${totals.bonus.toLocaleString()} 點`} />
        <Box label="待補入" value={`${totals.pending} 筆`} />
      </section>
      <form method="get" className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
        <input name="q" defaultValue={q} placeholder="儲值單號、會員、Email 或交易序號" className={`${sel} w-64`} aria-label="搜尋儲值單" />
        <select name="status" defaultValue={status} className={sel} aria-label="狀態">
          <option value="">全部狀態</option>
          {(Object.keys(TOPUP_STATUS_LABEL) as TopUpStatus[]).map((k) => <option key={k} value={k}>{TOPUP_STATUS_LABEL[k]}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white">搜尋</button>
        <span className="ml-auto text-xs text-muted">共 {rows.length} 筆（最多 200）</span>
      </form>
      <section className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-muted">
            <tr><th className="px-3 py-2 font-medium">儲值單號</th><th className="px-3 py-2 font-medium">會員</th><th className="px-3 py-2 font-medium">方案</th><th className="px-3 py-2 text-right font-medium">金額</th><th className="px-3 py-2 text-right font-medium">點數</th><th className="px-3 py-2 font-medium">狀態</th><th className="px-3 py-2 font-medium">金流</th><th className="px-3 py-2 font-medium">時間</th><th className="px-3 py-2 font-medium">操作</th></tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted">沒有儲值單</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2"><Link href={`/admin/members/${r.user.id}?tab=points`} className="hover:underline">{r.user.displayName}</Link><span className="block text-[11px] text-muted">{r.user.email ?? '—'}・餘額 {r.user.points}</span></td>
                <td className="px-3 py-2 text-xs">{r.planName}</td>
                <td className="px-3 py-2 text-right tabular">NT${r.amount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular">{r.points}{r.bonusPoints > 0 && <span className="text-xs text-muted">＋{r.bonusPoints}</span>}</td>
                <td className="px-3 py-2"><Pill tone={TONE[r.status as TopUpStatus] ?? 'gray'}>{TOPUP_STATUS_LABEL[r.status as TopUpStatus] ?? r.status}</Pill>{r.failReason && <span className="block max-w-[14rem] text-[11px] text-red-700">{r.failReason}</span>}</td>
                <td className="px-3 py-2 text-xs text-muted">{r.provider ?? '—'}{r.provider === 'mock' && '（模擬）'}<span className="block">{r.providerRef ?? ''}</span></td>
                <td className="px-3 py-2 text-xs text-muted">建立 {formatDateTime(r.createdAt)}{r.paidAt && <span className="block">付款 {formatDateTime(r.paidAt)}</span>}{r.creditedAt && <span className="block">入帳 {formatDateTime(r.creditedAt)}</span>}</td>
                <td className="px-3 py-2">{canCredit && (r.status === 'PAID' || r.status === 'CREDIT_FAILED') ? <CreditButton orderId={r.id} code={r.code} /> : <span className="text-xs text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <SourceNote source="儲值單、點數帳本、金流回呼" basis="收款以金流回呼確認為準；入帳以點數帳本為準" updatedAt={new Date()} />
    </div>
  )
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  )
}
