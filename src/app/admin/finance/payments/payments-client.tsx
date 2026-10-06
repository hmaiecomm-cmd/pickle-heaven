'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, CreditCard, RotateCcw, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { getPayments, getReservations } from '@/lib/api-service'
import type { Payment, PaymentStatus, Reservation } from '@/lib/models'

/** 付款狀態（Phase 1F）。資料來自 mock api-service；重試付款為佔位。 */

type Period = 'today' | 'week' | 'month' | 'all'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '近 7 天' },
  { key: 'month', label: '近 30 天' },
  { key: 'all', label: '全部' },
]

const STATUS_META: Record<PaymentStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  PENDING: { label: '待付款', variant: 'warning' },
  PAID: { label: '已付款', variant: 'success' },
  FAILED: { label: '付款失敗', variant: 'error' },
  REFUNDED: { label: '已退款', variant: 'default' },
}
const METHOD_LABEL: Record<Payment['method'], string> = { CREDIT_CARD: '信用卡', LINE_PAY: 'LINE Pay', BANK_TRANSFER: '銀行轉帳' }

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDateTime = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`

function since(period: Period): Date | null {
  if (period === 'all') return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (period === 'week') d.setDate(d.getDate() - 6)
  if (period === 'month') d.setDate(d.getDate() - 29)
  return d
}

export function PaymentsClient() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>('month')
  const [status, setStatus] = useState<PaymentStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, r] = await Promise.all([getPayments(), getReservations()])
      if (!p.success) throw new Error(p.error?.message ?? '無法載入付款')
      setPayments(p.data)
      setReservations(r.success ? r.data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resOf = (id: string) => reservations.find((r) => r.id === id)

  const filtered = useMemo(() => {
    const from = since(period)
    const q = query.trim().toLowerCase()
    return payments
      .filter((p) => !from || p.createdAt >= from)
      .filter((p) => status === 'ALL' || p.status === status)
      .filter((p) => {
        if (!q) return true
        const r = resOf(p.reservationId)
        return `${p.transactionId ?? ''} ${p.reservationId} ${r?.bookingCode ?? p.bookingCode ?? ''} ${r?.member?.name ?? p.customerName ?? ''} ${p.customerPhone ?? ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, reservations, period, status, query])

  const kpi = useMemo(() => {
    const sum = (s: PaymentStatus) => filtered.filter((p) => p.status === s).reduce((a, p) => a + p.amount, 0)
    return {
      paid: sum('PAID'),
      pending: sum('PENDING'),
      failed: filtered.filter((p) => p.status === 'FAILED').length,
      rate: filtered.length ? Math.round((filtered.filter((p) => p.status === 'PAID').length / filtered.length) * 100) : 0,
    }
  }, [filtered])

  const selected = payments.find((p) => p.id === selectedId) ?? null

  /** 佔位：Phase 2 接金流商重試 API。這裡只模擬送出與回應。 */
  const retry = (id: string) => {
    setRetrying(id)
    setTimeout(() => {
      setRetrying(null)
      toast('已送出重試請求（mock，未呼叫金流商）', 'info')
    }, 1200)
  }

  const selectClass = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader title="付款狀態" subtitle="追蹤每筆付款的狀態與金流交易" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="已收款" value={kpi.paid.toLocaleString()} unit="元" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="待付款" value={kpi.pending.toLocaleString()} unit="元" />
        <KPICard icon={<AlertTriangle className="h-5 w-5" />} label="付款失敗" value={kpi.failed} unit="筆" />
        <KPICard icon={<CreditCard className="h-5 w-5" />} label="付款成功率" value={kpi.rate} unit="%" />
      </div>

      <div className={`flex flex-col gap-3 p-3 md:flex-row md:flex-wrap md:items-center ${panelClass}`}>
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
        <select aria-label="狀態" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
          <option value="ALL">全部狀態</option>
          {(Object.keys(STATUS_META) as PaymentStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋交易編號、訂單編號或會員"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] pl-8 pr-3 text-sm"
          />
        </label>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState description={error} retry={load} />
      ) : filtered.length === 0 ? (
        <div className={panelClass}>
          <EmptyState title="沒有符合條件的付款" description="試著放寬期間或篩選條件" icon="💳" />
        </div>
      ) : (
        <>
          <div className={`hidden overflow-x-auto md:block ${panelClass}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">建立時間</th>
                  <th className="px-4 py-3 font-medium">訂單</th>
                  <th className="px-4 py-3 font-medium">會員</th>
                  <th className="px-4 py-3 font-medium">方式</th>
                  <th className="px-4 py-3 font-medium">交易編號</th>
                  <th className="px-4 py-3 text-right font-medium">金額</th>
                  <th className="px-4 py-3 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const r = resOf(p.reservationId)
                  return (
                    <tr key={p.id} onClick={() => setSelectedId(p.id)} className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:surface-2">
                      <td className="px-4 py-3 tabular-nums">{fmtDateTime(p.createdAt)}</td>
                      <td className="px-4 py-3 font-mono">{r?.bookingCode ?? p.bookingCode ?? p.reservationId}</td>
                      <td className="px-4 py-3">{r?.member?.name ?? p.customerName ?? '—'}</td>
                      <td className="px-4 py-3">{METHOD_LABEL[p.method]}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{p.transactionId ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmtMoney(p.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={STATUS_META[p.status].label} variant={STATUS_META[p.status].variant} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {filtered.map((p) => {
              const r = resOf(p.reservationId)
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)} className={`w-full p-3 text-left hover:surface-2 ${panelClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{r?.bookingCode ?? p.bookingCode ?? p.reservationId}</p>
                      <p className="truncate text-sm">{r?.member?.name ?? p.customerName ?? '—'}　<span className="text-muted">{METHOD_LABEL[p.method]}</span></p>
                      <p className="mt-0.5 text-xs text-muted tabular-nums">{fmtDateTime(p.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm">{fmtMoney(p.amount)}</span>
                      <StatusBadge status={STATUS_META[p.status].label} variant={STATUS_META[p.status].variant} size="sm" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* 付款詳情 */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (() => {
          const r = resOf(selected.reservationId)
          return (
            <SheetContent title={`付款 ${selected.transactionId ?? selected.id}`} description={`建立於 ${fmtDateTime(selected.createdAt)}`}>
              <div className="space-y-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={STATUS_META[selected.status].label} variant={STATUS_META[selected.status].variant} />
                  <span className="font-mono text-base font-semibold">{fmtMoney(selected.amount)}</span>
                </div>

                <section className="grid grid-cols-2 gap-3">
                  <Info label="付款方式" value={METHOD_LABEL[selected.method]} />
                  <Info label="交易編號" value={selected.transactionId ?? '尚未產生'} mono />
                  <Info label="付款時間" value={selected.paidAt ? fmtDateTime(selected.paidAt) : '尚未付款'} />
                  <Info label="訂單" value={r?.bookingCode ?? selected.bookingCode ?? selected.reservationId} mono />
                  {selected.provider && <Info label="金流商" value={selected.provider} />}
                  {selected.failReason && <Info label="失敗原因" value={selected.failReason} />}
                </section>

                {!r && selected.customerName && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">聯絡人</h3>
                    <div className="rounded-lg border border-[rgb(var(--border))] p-3">
                      <p className="font-medium">{selected.customerName} <span className="ml-1 text-xs text-muted">{selected.customerPhone}</span></p>
                    </div>
                  </section>
                )}
                {r && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">訂單內容</h3>
                    <div className="rounded-lg border border-[rgb(var(--border))] p-3">
                      <p className="font-medium">{r.member?.name ?? '—'} <span className="ml-1 text-xs text-muted">{r.member?.phone}</span></p>
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                        {r.items.map((i) => (
                          <li key={i.id}>{i.name}　{fmtMoney(i.price)}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                )}

                <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                  {(selected.status === 'PENDING' || selected.status === 'FAILED') && (
                    <Button size="sm" loading={retrying === selected.id} onClick={() => retry(selected.id)}>
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      重試付款
                    </Button>
                  )}
                  {selected.status === 'PAID' && (
                    <Button size="sm" variant="secondary" disabled title="Phase 2 實作">申請退款</Button>
                  )}
                  <Button size="sm" variant="secondary" disabled title="Phase 2 實作">金流商紀錄</Button>
                </div>
                <p className="text-xs text-muted">重試付款目前為佔位，Phase 2 會呼叫金流商 API 重新發起交易。</p>
              </div>
            </SheetContent>
          )
        })()}
      </Sheet>
    </div>
  )
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  )
}
