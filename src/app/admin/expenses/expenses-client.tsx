'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Download, FileEdit, Plus, Receipt as ReceiptIcon, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { getExpenses } from '@/lib/api-service'
import { downloadCsv } from '@/lib/csv'
import type { Expense, ExpenseStatus } from '@/lib/models'

/** 費用（Phase 1G）。資料來自 mock api-service；審核動作僅更新本機狀態。 */

type Category = Expense['category']
type Period = 'month' | 'quarter' | 'all'
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

const CATEGORY_LABEL: Record<Category, string> = { MAINTENANCE: '維護', SUPPLIES: '耗材', UTILITIES: '水電', LABOR: '人事', OTHER: '其他' }
const STATUS_META: Record<ExpenseStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  SUBMITTED: { label: '待審核', variant: 'warning' },
  APPROVED: { label: '已核准', variant: 'success' },
  REJECTED: { label: '已退回', variant: 'error' },
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

/** 費用本身或其 OCR 來源仍是草稿時，都視為「草稿」提醒。 */
const isDraft = (e: Expense) => e.status === 'DRAFT' || e.ocrData?.status === 'DRAFT' || e.receipt?.ocrData?.status === 'DRAFT'

export function ExpensesClient() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>('all')
  const [category, setCategory] = useState<Category | 'ALL'>('ALL')
  const [status, setStatus] = useState<ExpenseStatus | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getExpenses()
      if (!r.success) throw new Error(r.error?.message ?? '無法載入費用')
      setExpenses(r.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const from = periodStart(period)
    const q = query.trim().toLowerCase()
    return expenses
      .filter((e) => !from || e.submittedAt >= from)
      .filter((e) => category === 'ALL' || e.category === category)
      .filter((e) => status === 'ALL' || e.status === status)
      .filter((e) => !q || `${e.expenseNumber} ${e.description}`.toLowerCase().includes(q))
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
  }, [expenses, period, category, status, query])

  const kpi = useMemo(() => {
    const sum = (s?: ExpenseStatus) => filtered.filter((e) => !s || e.status === s).reduce((a, e) => a + e.amount, 0)
    return {
      total: sum(),
      approved: sum('APPROVED'),
      pending: filtered.filter((e) => e.status === 'SUBMITTED').length,
      draft: filtered.filter(isDraft).length,
    }
  }, [filtered])

  const selected = expenses.find((e) => e.id === selectedId) ?? null

  /** Phase 1 僅更新本機狀態；Phase 2 改呼叫 API。 */
  const setExpenseStatus = (id: string, next: ExpenseStatus) => {
    setExpenses((list) =>
      list.map((e) => (e.id === id ? { ...e, status: next, approvedAt: next === 'APPROVED' ? new Date() : e.approvedAt } : e)),
    )
    toast(`費用已改為「${STATUS_META[next].label}」（mock，未寫入資料庫）`, next === 'REJECTED' ? 'info' : 'success')
  }

  const addExpense = (e: Expense) => {
    setExpenses((list) => [e, ...list])
    toast(`已登錄費用 ${e.expenseNumber}（${STATUS_META[e.status].label}）`, 'success')
  }

  const exportCsv = () =>
    downloadCsv(
      `expenses-${fmtDate(new Date()).replace(/\//g, '')}.csv`,
      ['費用編號', '類別', '說明', '金額', '提交日期', '核准日期', '狀態'],
      filtered.map((e) => [e.expenseNumber, CATEGORY_LABEL[e.category], e.description, e.amount, fmtDate(e.submittedAt), e.approvedAt ? fmtDate(e.approvedAt) : '', STATUS_META[e.status].label]),
    )

  const selectClass = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader
        title="費用"
        subtitle="場館支出登錄與審核"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" aria-hidden />
              匯出 CSV
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              手動登錄
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<ReceiptIcon className="h-5 w-5" />} label="費用總額" value={kpi.total.toLocaleString()} unit="元" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="已核准" value={kpi.approved.toLocaleString()} unit="元" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="待審核" value={kpi.pending} unit="筆" />
        <KPICard icon={<FileEdit className="h-5 w-5" />} label="草稿" value={kpi.draft} unit="筆" />
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
        <div className="flex flex-wrap gap-2">
          <select aria-label="類別" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={selectClass}>
            <option value="ALL">全部類別</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <select aria-label="狀態" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectClass}>
            <option value="ALL">全部狀態</option>
            {(Object.keys(STATUS_META) as ExpenseStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋費用編號或說明"
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
          <EmptyState title="沒有符合條件的費用" description="可用右上角手動登錄" icon="💸" />
        </div>
      ) : (
        <>
          <div className={`hidden overflow-x-auto md:block ${panelClass}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">費用編號</th>
                  <th className="px-4 py-3 font-medium">類別</th>
                  <th className="px-4 py-3 font-medium">說明</th>
                  <th className="px-4 py-3 font-medium">提交日期</th>
                  <th className="px-4 py-3 text-right font-medium">金額</th>
                  <th className="px-4 py-3 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} onClick={() => setSelectedId(e.id)} className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:surface-2">
                    <td className="px-4 py-3 font-mono font-medium">{e.expenseNumber}</td>
                    <td className="px-4 py-3">{CATEGORY_LABEL[e.category]}</td>
                    <td className="max-w-[20rem] truncate px-4 py-3">{e.description}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDate(e.submittedAt)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(e.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <StatusBadge status={STATUS_META[e.status].label} variant={STATUS_META[e.status].variant} />
                        {isDraft(e) && e.status !== 'DRAFT' && <StatusBadge status="來源草稿" variant="warning" size="sm" />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {filtered.map((e) => (
              <button key={e.id} onClick={() => setSelectedId(e.id)} className={`w-full p-3 text-left hover:surface-2 ${panelClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold">{e.expenseNumber}</p>
                    <p className="truncate text-sm">{e.description}</p>
                    <p className="mt-0.5 text-xs text-muted tabular-nums">{CATEGORY_LABEL[e.category]}　{fmtDate(e.submittedAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-sm">{fmtMoney(e.amount)}</span>
                    <StatusBadge status={STATUS_META[e.status].label} variant={STATUS_META[e.status].variant} size="sm" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* 費用詳情 */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={`費用 ${selected.expenseNumber}`} description={`${CATEGORY_LABEL[selected.category]}　提交於 ${fmtDate(selected.submittedAt)}`}>
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={STATUS_META[selected.status].label} variant={STATUS_META[selected.status].variant} />
                {isDraft(selected) && <StatusBadge status="草稿，尚未入帳" variant="warning" />}
                <span className="font-mono text-base font-semibold">{fmtMoney(selected.amount)}</span>
              </div>
              <p className="whitespace-pre-wrap">{selected.description}</p>
              <section className="grid grid-cols-2 gap-3">
                <Info label="核准日期" value={selected.approvedAt ? fmtDate(selected.approvedAt) : '尚未核准'} />
                <Info label="附件收據" value={selected.receipt ? selected.receipt.receiptNumber : '無'} mono={!!selected.receipt} />
              </section>
              {selected.ocrData && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">OCR 來源欄位</h3>
                  <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-[rgb(var(--border))]">
                    {Object.entries(selected.ocrData.fields).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between px-3 py-2">
                        <span className="text-muted">{k}</span>
                        <span className="font-mono text-xs">{v}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                {selected.status === 'DRAFT' && <Button size="sm" onClick={() => setExpenseStatus(selected.id, 'SUBMITTED')}>送出審核</Button>}
                {selected.status === 'SUBMITTED' && (
                  <>
                    <Button size="sm" onClick={() => setExpenseStatus(selected.id, 'APPROVED')}>核准</Button>
                    <Button size="sm" variant="danger" onClick={() => setExpenseStatus(selected.id, 'REJECTED')}>退回</Button>
                  </>
                )}
                {selected.status === 'REJECTED' && <Button size="sm" variant="secondary" onClick={() => setExpenseStatus(selected.id, 'DRAFT')}>改回草稿</Button>}
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">編輯</Button>
              </div>
              <p className="text-xs text-muted">審核動作目前僅更新畫面（mock 模式），Phase 2 會寫回資料庫。</p>
            </div>
          </SheetContent>
        )}
      </Sheet>

      <CreateExpenseSheet open={creating} onOpenChange={setCreating} onCreate={addExpense} />
    </div>
  )
}

/* ───────────────────────────── 手動登錄 ───────────────────────────── */

function CreateExpenseSheet({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (o: boolean) => void; onCreate: (e: Expense) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const EMPTY = { category: 'OTHER' as Category, amount: '', date: today, description: '' }
  const [form, setForm] = useState(EMPTY)
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const valid = Number(form.amount) > 0 && form.description.trim().length > 0

  const submit = (asDraft: boolean) => {
    const d = new Date(form.date)
    onCreate({
      id: `exp-${Date.now()}`,
      expenseNumber: `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      category: form.category,
      amount: Number(form.amount),
      status: asDraft ? 'DRAFT' : 'SUBMITTED',
      submittedAt: isNaN(d.getTime()) ? new Date() : d,
      description: form.description.trim(),
    })
    setForm(EMPTY)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="手動登錄費用" description="沒有收據或 OCR 無法辨識時使用">
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="類別" htmlFor="exp-category">
              <select
                id="exp-category"
                value={form.category}
                onChange={(e) => set('category', e.target.value as Category)}
                className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]"
              >
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="金額" htmlFor="exp-amount">
              <Input id="exp-amount" type="number" inputMode="numeric" min={0} value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            </Field>
            <Field label="日期" htmlFor="exp-date">
              <Input id="exp-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </Field>
          </div>
          <Field label="說明" htmlFor="exp-desc">
            <Input id="exp-desc" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="例：球場地板打蠟保養" />
          </Field>
          <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
            <Button size="sm" disabled={!valid} onClick={() => submit(false)}>送出審核</Button>
            <Button size="sm" variant="secondary" disabled={!valid} onClick={() => submit(true)}>存為草稿</Button>
          </div>
          <p className="text-xs text-muted">目前只存在畫面上（mock 模式），Phase 2 會寫回資料庫。</p>
        </div>
      </SheetContent>
    </Sheet>
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
