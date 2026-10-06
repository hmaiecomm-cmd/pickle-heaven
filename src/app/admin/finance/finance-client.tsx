'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ArrowUpDown, DollarSign, Percent, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { BarChart, ChartCard, ErrorState, HBarChart, KPICard, LineChart, LoadingState, StatusBadge, type Point } from '@/components/common'
import { getCourts, getExpenses, getFinancialSummary, getPayments, getRevenue } from '@/lib/api-service'
import { getDateRange } from '@/lib/mock-data'
import type { Court, Expense, FinancialSummary, Payment, PaymentStatus, Revenue } from '@/lib/models'

/** 營收與財務儀表板（Phase 1F）。資料來自 mock api-service。 */

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本週' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季' },
  { key: 'year', label: '今年' },
]

const TYPE_LABEL: Record<Revenue['type'], string> = { COURT: '球場', EVENT: '活動', COACH: '教練' }
const TYPE_SERIES = { COURT: 'series-1', EVENT: 'series-2', COACH: 'series-3' } as const
const METHOD_LABEL: Record<string, string> = { CREDIT_CARD: '信用卡', LINE_PAY: 'LINE Pay', BANK_TRANSFER: '銀行轉帳' }
const PAYMENT_META: Record<PaymentStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  PENDING: { label: '待付款', variant: 'warning' },
  PAID: { label: '已付款', variant: 'success' },
  FAILED: { label: '付款失敗', variant: 'error' },
  REFUNDED: { label: '已退款', variant: 'default' },
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
const fmtShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

/** 依期間長度決定按日或按月分桶，回傳每桶的總和，空桶補 0。 */
function bucketize(from: Date, to: Date, items: { date: Date; amount: number }[]): Point[] {
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  const byMonth = days > 62
  const sums = new Map<string, number>()
  for (const it of items) {
    const k = byMonth ? monthKey(it.date) : dayKey(it.date)
    sums.set(k, (sums.get(k) ?? 0) + it.amount)
  }
  const out: Point[] = []
  const cur = new Date(from)
  if (byMonth) {
    cur.setDate(1)
    while (cur <= to) {
      out.push({ label: `${cur.getMonth() + 1}月`, value: sums.get(monthKey(cur)) ?? 0 })
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    cur.setHours(0, 0, 0, 0)
    while (cur <= to) {
      out.push({ label: fmtShort(cur), value: sums.get(dayKey(cur)) ?? 0 })
      cur.setDate(cur.getDate() + 1)
    }
  }
  return out
}

export function FinanceClient() {
  const [period, setPeriod] = useState<Period>('month')
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [revenue, setRevenue] = useState<Revenue[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (p: Period) => {
    setLoading(true)
    setError(null)
    try {
      const [s, r, e, pay, c] = await Promise.all([getFinancialSummary(p), getRevenue(p), getExpenses(), getPayments(), getCourts()])
      if (!s.success) throw new Error(s.error?.message ?? '無法載入財務摘要')
      setSummary(s.data)
      setRevenue(r.success ? r.data : [])
      setExpenses(e.success ? e.data : [])
      setPayments(pay.success ? pay.data : [])
      setCourts(c.success ? c.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(period)
  }, [period])

  const range = useMemo(() => getDateRange(period), [period])
  const expensesInRange = useMemo(
    () => expenses.filter((e) => e.submittedAt >= range.from && e.submittedAt <= range.to),
    [expenses, range],
  )

  const trend = useMemo(() => {
    const rev = bucketize(range.from, range.to, revenue.map((r) => ({ date: r.date, amount: r.amount })))
    const exp = bucketize(range.from, range.to, expensesInRange.map((e) => ({ date: e.submittedAt, amount: e.amount })))
    let acc = 0
    const net = rev.map((p, i) => {
      acc += p.value - (exp[i]?.value ?? 0)
      return { label: p.label, value: acc }
    })
    return { rev, exp, net }
  }, [range, revenue, expensesInRange])

  const byCourt = useMemo(() => {
    const sums = new Map<string, number>()
    for (const r of revenue) {
      const k = r.courtId ? (courts.find((c) => c.id === r.courtId)?.name ?? r.courtId) : '非球場'
      sums.set(k, (sums.get(k) ?? 0) + r.amount)
    }
    return [...sums].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [revenue, courts])

  const byType = useMemo(() => {
    const sums = new Map<Revenue['type'], number>()
    for (const r of revenue) sums.set(r.type, (sums.get(r.type) ?? 0) + r.amount)
    return (Object.keys(TYPE_LABEL) as Revenue['type'][])
      .map((t) => ({ label: TYPE_LABEL[t], value: sums.get(t) ?? 0, series: TYPE_SERIES[t] }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [revenue])

  const paymentSummary = useMemo(() => {
    const inRange = payments.filter((p) => p.createdAt >= range.from && p.createdAt <= range.to)
    return (Object.keys(PAYMENT_META) as PaymentStatus[]).map((s) => {
      const rows = inRange.filter((p) => p.status === s)
      return { status: s, count: rows.length, amount: rows.reduce((a, p) => a + p.amount, 0) }
    })
  }, [payments, range])

  const s = summary

  return (
    <div className="space-y-6">
      <PageHeader
        title="營收與財務"
        subtitle={`${fmtDate(range.from)} – ${fmtDate(range.to)}　幣別 TWD`}
        action={
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)} aria-pressed={period === p.key}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p.key ? 'bg-brand-600 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <LoadingState />
      ) : error || !s ? (
        <ErrorState description={error ?? '沒有資料'} retry={() => load(period)} />
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KPICard icon={<DollarSign className="h-5 w-5" />} label="總營收" value={s.grossRevenue.toLocaleString()} unit="元" />
            <KPICard icon={<Receipt className="h-5 w-5" />} label="費用" value={s.expenses.toLocaleString()} unit="元" />
            <KPICard icon={<Wallet className="h-5 w-5" />} label="淨收入" value={s.netRevenue.toLocaleString()} unit="元" />
            <KPICard icon={<TrendingUp className="h-5 w-5" />} label="營業利潤" value={s.operatingProfit.toLocaleString()} unit="元" />
            <KPICard icon={<Percent className="h-5 w-5" />} label="利潤率" value={s.profitMargin.toFixed(1)} unit="%" />
          </div>

          {/* 趨勢 */}
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="營收趨勢" subtitle={trend.rev.length > 31 ? '按月' : '按日'}>
              <BarChart data={trend.rev} series="series-1" />
            </ChartCard>
            <ChartCard title="費用趨勢" subtitle="依提交日期">
              <BarChart data={trend.exp} series="series-2" />
            </ChartCard>
            <ChartCard title="累計淨額" subtitle="營收減費用，逐期累加">
              <LineChart data={trend.net} series="series-3" />
            </ChartCard>
          </div>

          {/* 分布與付款 */}
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="依球場" subtitle="營收占比">
              <HBarChart data={byCourt} series="series-1" />
            </ChartCard>
            <ChartCard title="依預約類型" subtitle="營收占比">
              <HBarChart data={byType} />
            </ChartCard>
            <ChartCard
              title="付款狀態"
              subtitle="依建立日期"
              aside={<Link href="/admin/finance/payments" className="text-xs text-brand-600 hover:underline">查看全部 →</Link>}
            >
              <ul className="divide-y divide-[rgb(var(--border))] text-sm">
                {paymentSummary.map((p) => (
                  <li key={p.status} className="flex items-center justify-between py-2">
                    <StatusBadge status={PAYMENT_META[p.status].label} variant={PAYMENT_META[p.status].variant} />
                    <span className="tabular-nums">
                      <span className="text-muted">{p.count} 筆　</span>
                      {fmtMoney(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>

          <RevenueTable rows={revenue} courts={courts} />

          <p className="text-xs text-muted">
            計算說明：總營收為期間內所有已入帳收入；費用以提交日期歸屬期間；淨收入 = 總營收 − 費用；營業利潤目前等於淨收入（尚未扣除其他成本）；利潤率 = 營業利潤 ÷ 總營收。
          </p>
        </>
      )}
    </div>
  )
}

/* ───────────────────────────── 營收明細 ───────────────────────────── */

type SortKey = 'date' | 'amount'

function RevenueTable({ rows, courts }: { rows: Revenue[]; courts: Court[] }) {
  const [type, setType] = useState<Revenue['type'] | 'ALL'>('ALL')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' })

  const data = useMemo(() => {
    const list = rows.filter((r) => type === 'ALL' || r.type === type)
    const m = sort.dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) =>
      sort.key === 'date' ? (a.date.getTime() - b.date.getTime()) * m : (a.amount - b.amount) * m,
    )
  }, [rows, type, sort])

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key !== k ? <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden /> : sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />

  const total = data.reduce((s, r) => s + r.amount, 0)
  const courtName = (id?: string) => (id ? (courts.find((c) => c.id === id)?.name ?? id) : '—')

  return (
    <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] p-4">
        <div>
          <h3 className="text-sm font-semibold">營收明細</h3>
          <p className="mt-0.5 text-xs text-muted">{data.length} 筆　合計 {fmtMoney(total)}</p>
        </div>
        <select aria-label="類型" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm">
          <option value="ALL">全部類型</option>
          {(Object.keys(TYPE_LABEL) as Revenue['type'][]).map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">此期間沒有營收紀錄</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="px-4 py-2.5 font-medium">
                  <button onClick={() => toggle('date')} className="inline-flex items-center gap-1 hover:text-[rgb(var(--fg))]">日期 <SortIcon k="date" /></button>
                </th>
                <th className="px-4 py-2.5 font-medium">類型</th>
                <th className="px-4 py-2.5 font-medium">球場</th>
                <th className="px-4 py-2.5 font-medium">訂單</th>
                <th className="px-4 py-2.5 font-medium">付款方式</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  <button onClick={() => toggle('amount')} className="inline-flex items-center gap-1 hover:text-[rgb(var(--fg))]">金額 <SortIcon k="amount" /></button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {data.map((r) => (
                <tr key={r.id} className="hover:surface-2">
                  <td className="px-4 py-2.5 tabular-nums">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5">{TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-2.5">{courtName(r.courtId)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.reservationId}</td>
                  <td className="px-4 py-2.5">{METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
