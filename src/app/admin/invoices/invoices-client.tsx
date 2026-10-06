'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileText, Search, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { getInvoices, getMembers, getReservations, updateInvoiceStatus } from '@/lib/api-service'
import { downloadCsv } from '@/lib/csv'
import type { Invoice, Member, Reservation } from '@/lib/models'

/** 發票（Phase 1G）。資料來自 mock api-service，狀態操作僅更新本機狀態。 */

type Status = Invoice['status']
type Period = 'month' | 'quarter' | 'all'
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

const STATUS_META: Record<Status, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  ISSUED: { label: '已開立', variant: 'info' },
  PAID: { label: '已付款', variant: 'success' },
  OVERDUE: { label: '逾期', variant: 'error' },
  CANCELLED: { label: '已作廢', variant: 'default' },
}
const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季' },
  { key: 'all', label: '全部' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`

function periodStart(p: Period): Date | null {
  if (p === 'all') return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (p === 'month') d.setDate(1)
  else d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1)
  return d
}

/** 已開立但超過到期日，顯示為逾期。 */
const effectiveStatus = (i: Invoice, now: Date): Status => (i.status === 'ISSUED' && i.dueDate < now ? 'OVERDUE' : i.status)

export function InvoicesClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>('all')
  const [status, setStatus] = useState<Status | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [i, m, r] = await Promise.all([getInvoices(), getMembers(), getReservations()])
      if (!i.success) throw new Error(i.error?.message ?? '無法載入發票')
      setInvoices(i.data)
      setMembers(m.success ? m.data : [])
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

  const now = new Date()
  const memberName = (i: Invoice) => i.memberName ?? members.find((m) => m.id === i.memberId)?.name ?? '—'
  const bookingCode = (i: Invoice) => i.bookingCode ?? reservations.find((r) => r.id === i.reservationId)?.bookingCode ?? i.reservationId

  const filtered = useMemo(() => {
    const from = periodStart(period)
    const q = query.trim().toLowerCase()
    return invoices
      .filter((i) => !from || i.issueDate >= from)
      .filter((i) => status === 'ALL' || effectiveStatus(i, now) === status)
      .filter((i) => !q || `${i.invoiceNumber} ${memberName(i)} ${bookingCode(i)}`.toLowerCase().includes(q))
      .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, members, reservations, period, status, query])

  const kpi = useMemo(() => {
    const sum = (pred: (i: Invoice) => boolean) => filtered.filter(pred).reduce((s, i) => s + i.amount, 0)
    return {
      issued: sum((i) => effectiveStatus(i, now) !== 'DRAFT' && effectiveStatus(i, now) !== 'CANCELLED'),
      paid: sum((i) => i.status === 'PAID'),
      overdue: filtered.filter((i) => effectiveStatus(i, now) === 'OVERDUE').length,
      draft: filtered.filter((i) => i.status === 'DRAFT').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

  const selected = invoices.find((i) => i.id === selectedId) ?? null

  const [busy, setBusy] = useState(false)

  /** 寫入資料庫並留下稽核紀錄。 */
  const setInvoiceStatus = async (id: string, next: Status) => {
    setBusy(true)
    try {
      const res = await updateInvoiceStatus(id, next)
      if (!res.success) {
        toast(`變更失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
        return
      }
      setInvoices((list) => list.map((i) => (i.id === id ? res.data : i)))
      toast(`發票已改為「${STATUS_META[next].label}」`, next === 'CANCELLED' ? 'info' : 'success')
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () =>
    downloadCsv(
      `invoices-${fmtDate(now).replace(/\//g, '')}.csv`,
      ['發票號碼', '會員', '訂單', '開立日期', '到期日', '金額', '狀態'],
      filtered.map((i) => [i.invoiceNumber, memberName(i), bookingCode(i), fmtDate(i.issueDate), fmtDate(i.dueDate), i.amount, STATUS_META[effectiveStatus(i, now)].label]),
    )

  const selectClass = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader
        title="發票"
        subtitle="管理開立給會員的發票與收款狀態"
        action={
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" aria-hidden />
            匯出 CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<FileText className="h-5 w-5" />} label="已開立總額" value={kpi.issued.toLocaleString()} unit="元" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="已收款" value={kpi.paid.toLocaleString()} unit="元" />
        <KPICard icon={<AlertTriangle className="h-5 w-5" />} label="逾期" value={kpi.overdue} unit="張" />
        <KPICard icon={<Send className="h-5 w-5" />} label="待開立草稿" value={kpi.draft} unit="張" />
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
          {(Object.keys(STATUS_META) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋發票號碼、會員或訂單"
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
          <EmptyState title="沒有符合條件的發票" description="試著放寬期間或篩選條件" icon="🧾" />
        </div>
      ) : (
        <>
          <div className={`hidden overflow-x-auto md:block ${panelClass}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">發票號碼</th>
                  <th className="px-4 py-3 font-medium">會員</th>
                  <th className="px-4 py-3 font-medium">訂單</th>
                  <th className="px-4 py-3 font-medium">開立日期</th>
                  <th className="px-4 py-3 font-medium">到期日</th>
                  <th className="px-4 py-3 text-right font-medium">金額</th>
                  <th className="px-4 py-3 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const s = effectiveStatus(i, now)
                  return (
                    <tr key={i.id} onClick={() => setSelectedId(i.id)} className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:surface-2">
                      <td className="px-4 py-3 font-mono font-medium">{i.invoiceNumber}</td>
                      <td className="px-4 py-3">{memberName(i)}</td>
                      <td className="px-4 py-3 font-mono">{bookingCode(i)}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtDate(i.issueDate)}</td>
                      <td className={`px-4 py-3 tabular-nums ${s === 'OVERDUE' ? 'text-red-600' : ''}`}>{fmtDate(i.dueDate)}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmtMoney(i.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={STATUS_META[s].label} variant={STATUS_META[s].variant} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {filtered.map((i) => {
              const s = effectiveStatus(i, now)
              return (
                <button key={i.id} onClick={() => setSelectedId(i.id)} className={`w-full p-3 text-left hover:surface-2 ${panelClass}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{i.invoiceNumber}</p>
                      <p className="truncate text-sm">{memberName(i)}　<span className="font-mono text-muted">{bookingCode(i)}</span></p>
                      <p className="mt-0.5 text-xs text-muted tabular-nums">開立 {fmtDate(i.issueDate)}　到期 {fmtDate(i.dueDate)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm">{fmtMoney(i.amount)}</span>
                      <StatusBadge status={STATUS_META[s].label} variant={STATUS_META[s].variant} size="sm" />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (() => {
          const s = effectiveStatus(selected, now)
          return (
            <SheetContent title={`發票 ${selected.invoiceNumber}`} description={`開立於 ${fmtDate(selected.issueDate)}　到期 ${fmtDate(selected.dueDate)}`}>
              <div className="space-y-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={STATUS_META[s].label} variant={STATUS_META[s].variant} />
                  <span className="font-mono text-base font-semibold">{fmtMoney(selected.amount)}</span>
                </div>

                <section className="grid grid-cols-2 gap-3">
                  <Info label="會員" value={memberName(selected)} />
                  <Info label="訂單" value={bookingCode(selected)} mono />
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">明細</h3>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr className="border-b border-[rgb(var(--border))]">
                        <th className="py-1.5 font-medium">項目</th>
                        <th className="py-1.5 text-right font-medium">數量</th>
                        <th className="py-1.5 text-right font-medium">單價</th>
                        <th className="py-1.5 text-right font-medium">小計</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border))]">
                      {selected.items.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5">{it.description}</td>
                          <td className="py-1.5 text-right tabular-nums">{it.quantity}</td>
                          <td className="py-1.5 text-right font-mono">{fmtMoney(it.unitPrice)}</td>
                          <td className="py-1.5 text-right font-mono">{fmtMoney(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                  {selected.status === 'DRAFT' && <Button size="sm" loading={busy} onClick={() => setInvoiceStatus(selected.id, 'ISSUED')}>開立發票</Button>}
                  {(s === 'ISSUED' || s === 'OVERDUE') && <Button size="sm" loading={busy} onClick={() => setInvoiceStatus(selected.id, 'PAID')}>標記已付款</Button>}
                  {selected.status !== 'CANCELLED' && selected.status !== 'PAID' && (
                    <Button size="sm" variant="danger" disabled={busy} onClick={() => setInvoiceStatus(selected.id, 'CANCELLED')}>作廢</Button>
                  )}
                  <Button size="sm" variant="secondary" disabled title="Phase 2 實作">下載 PDF</Button>
                  <Button size="sm" variant="secondary" disabled title="Phase 2 實作">寄送給會員</Button>
                </div>
                <p className="text-xs text-muted">狀態變更會寫入資料庫並留下稽核紀錄；電子發票串接為後續項目。</p>
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
      <p className={`mt-1 truncate font-medium ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  )
}
