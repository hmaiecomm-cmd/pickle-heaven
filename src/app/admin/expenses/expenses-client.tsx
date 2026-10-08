'use client'

import * as React from 'react'
import { Camera, CheckCircle2, Clock, Download, FileEdit, FileText, History, Loader2, Paperclip, PenLine, Receipt as ReceiptIcon, RotateCw, Search, Trash2, TriangleAlert, Upload, X } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { downloadCsv } from '@/lib/csv'
import type { ExpenseDTO } from '@/server/expense-service'
import { attachmentUrl, createExpenseApi, deleteAttachmentApi, duplicateHintsApi, listExpenses, rotateAttachmentApi, setExpenseStatusApi, updateExpenseApi, uploadAttachmentApi, type AttachmentDTO } from './api'

/**
 * 費用與收據：拍照登錄／上傳收據／手動登錄 → 預覽（旋轉、重新上傳）→ 填寫欄位 → 人工確認 → 存草稿或提交審核。
 * OCR 尚未串接：所有欄位由人工填寫，不假裝辨識。附件為私有，讀取都經權限驗證。
 */

type Category = ExpenseDTO['category']
type Status = ExpenseDTO['status']
const CATEGORY_LABEL: Record<Category, string> = { MAINTENANCE: '維護', SUPPLIES: '耗材', UTILITIES: '水電', LABOR: '人事', OTHER: '其他' }
const STATUS_META: Record<Status, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  DRAFT: { label: '草稿', variant: 'default' },
  SUBMITTED: { label: '待審核', variant: 'warning' },
  APPROVED: { label: '已核准', variant: 'success' },
  REJECTED: { label: '已退回', variant: 'error' },
}
type Period = 'month' | 'quarter' | 'all'
const PERIODS: { key: Period; label: string }[] = [{ key: 'month', label: '本月' }, { key: 'quarter', label: '本季' }, { key: 'all', label: '全部' }]
const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (iso: string | null | undefined) => { if (!iso) return '—'; const d = new Date(iso); return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}` }
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const fmtMoney = (n: number, cur = 'TWD') => (cur === 'TWD' ? `NT$${n.toLocaleString()}` : `${cur} ${n.toLocaleString()}`)
const todayStr = () => { const d = new Date(Date.now() + 8 * 3600_000); return d.toISOString().slice(0, 10) }
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
const whoLabel = (actor: string | null, me: string, displayName: string) => (!actor ? '—' : actor === me ? `${displayName}（本人）` : actor.replace(/^admin:/, ''))

function periodStart(p: Period): Date | null {
  if (p === 'all') return null
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (p === 'month') d.setDate(1)
  else d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1)
  return d
}

export function ExpensesClient({ review, me, displayName }: { review: boolean; me: string; displayName: string }) {
  const { toast } = useToast()
  const [rows, setRows] = React.useState<ExpenseDTO[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [period, setPeriod] = React.useState<Period>('all')
  const [category, setCategory] = React.useState<Category | 'ALL'>('ALL')
  const [status, setStatus] = React.useState<Status | 'ALL'>('ALL')
  const [query, setQuery] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [entry, setEntry] = React.useState<{ mode: 'camera' | 'upload' | 'manual'; files: File[] } | null>(null)
  const [editing, setEditing] = React.useState<ExpenseDTO | null>(null)
  const cameraRef = React.useRef<HTMLInputElement>(null)
  const uploadRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    setLoading(true); setError(null)
    const res = await listExpenses()
    if (!res.ok) setError(res.error)
    else setRows(res.data)
    setLoading(false)
  }, [])
  React.useEffect(() => { void load() }, [load])

  const filtered = React.useMemo(() => {
    const start = periodStart(period)
    const q = query.trim().toLowerCase()
    return rows
      .filter((e) => !start || new Date(e.expenseDate ?? e.submittedAt) >= start)
      .filter((e) => category === 'ALL' || e.category === category)
      .filter((e) => status === 'ALL' || e.status === status)
      .filter((e) => !q || `${e.expenseNumber} ${e.description} ${e.vendorName ?? ''} ${e.docNumber ?? ''}`.toLowerCase().includes(q))
  }, [rows, period, category, status, query])

  const kpi = React.useMemo(() => {
    const sum = (s?: Status) => filtered.filter((e) => !s || e.status === s).reduce((a, e) => a + e.amount, 0)
    return { total: sum(), approved: sum('APPROVED'), pending: filtered.filter((e) => e.status === 'SUBMITTED').length, draft: filtered.filter((e) => e.status === 'DRAFT').length }
  }, [filtered])

  const selected = rows.find((e) => e.id === selectedId) ?? null
  const upsert = (e: ExpenseDTO) => setRows((list) => (list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? e : x)) : [e, ...list]))

  const onPick = (mode: 'camera' | 'upload') => (ev: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(ev.target.files ?? [])
    ev.target.value = ''
    if (files.length === 0) return
    setEntry({ mode, files })
  }

  const exportCsv = () =>
    downloadCsv(
      `expenses-${todayStr().replace(/-/g, '')}.csv`,
      ['費用編號', '支出日期', '類別', '商家', '說明', '金額', '幣別', '單據號碼', '附件數', '提交人', '提交日期', '狀態', '核准日期'],
      filtered.map((e) => [e.expenseNumber, fmtDate(e.expenseDate), CATEGORY_LABEL[e.category], e.vendorName ?? '', e.description, e.amount, e.currency, e.docNumber ?? '', e.attachments.length, e.submittedBy ?? '', fmtDate(e.submittedAt), STATUS_META[e.status].label, fmtDate(e.approvedAt)]),
    )

  const selectClass = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader
        title="費用與收據"
        subtitle={review ? '支出憑證登錄與審核（全部申請）' : '本人的費用申請（只看得到自己提交的申請）'}
        action={
          <div className="flex flex-wrap gap-2">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick('camera')} aria-label="拍照登錄" />
            <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={onPick('upload')} aria-label="上傳收據" />
            <Button size="sm" onClick={() => cameraRef.current?.click()}><Camera className="h-4 w-4" aria-hidden />拍照登錄</Button>
            <Button size="sm" variant="secondary" onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4" aria-hidden />上傳收據</Button>
            <Button size="sm" variant="secondary" onClick={() => setEntry({ mode: 'manual', files: [] })}><PenLine className="h-4 w-4" aria-hidden />手動登錄</Button>
            {review && <Button size="sm" variant="ghost" onClick={exportCsv} disabled={filtered.length === 0}><Download className="h-4 w-4" aria-hidden />匯出 CSV</Button>}
          </div>
        }
      />
      <p className="-mt-4 text-xs text-muted">手機按「拍照登錄」會開啟相機（不支援時改為選擇檔案）；桌機請用「上傳收據」。此處登錄的是場館支出憑證，不是對客戶開立的銷售發票。OCR 尚未串接，欄位請人工填寫。</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<ReceiptIcon className="h-5 w-5" />} label={review ? '費用總額（篩選範圍）' : '本人申請合計'} value={kpi.total.toLocaleString()} unit="元" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="已核准" value={kpi.approved.toLocaleString()} unit="元" />
        <KPICard icon={<Clock className="h-5 w-5" />} label="待審核" value={kpi.pending} unit="筆" />
        <KPICard icon={<FileEdit className="h-5 w-5" />} label="草稿" value={kpi.draft} unit="筆" />
      </div>

      <div className={`flex flex-col gap-3 p-3 md:flex-row md:flex-wrap md:items-center ${panelClass}`}>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} aria-pressed={period === p.key} className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${period === p.key ? 'bg-brand-600 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800'}`}>{p.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="類別" value={category} onChange={(e) => setCategory(e.target.value as Category | 'ALL')} className={selectClass}>
            <option value="ALL">全部類別</option>
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <select aria-label="狀態" value={status} onChange={(e) => setStatus(e.target.value as Status | 'ALL')} className={selectClass}>
            <option value="ALL">全部狀態</option>
            {(Object.keys(STATUS_META) as Status[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" placeholder="搜尋編號、說明、商家或單據號碼" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] pl-8 pr-3 text-sm" />
        </label>
      </div>

      {loading ? <LoadingState /> : error ? <ErrorState description={error} retry={load} /> : filtered.length === 0 ? (
        <div className={panelClass}><EmptyState title="沒有符合條件的費用" description="用右上角「拍照登錄」「上傳收據」或「手動登錄」新增" icon="🧾" /></div>
      ) : (
        <>
          <div className={`hidden overflow-x-auto md:block ${panelClass}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">費用編號</th><th className="px-4 py-3 font-medium">支出日期</th><th className="px-4 py-3 font-medium">類別</th><th className="px-4 py-3 font-medium">商家／說明</th><th className="px-4 py-3 font-medium">附件</th>{review && <th className="px-4 py-3 font-medium">提交人</th>}<th className="px-4 py-3 text-right font-medium">金額</th><th className="px-4 py-3 font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} onClick={() => setSelectedId(e.id)} className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:surface-2">
                    <td className="px-4 py-3 font-mono font-medium">{e.expenseNumber}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDate(e.expenseDate ?? e.submittedAt)}</td>
                    <td className="px-4 py-3">{CATEGORY_LABEL[e.category]}</td>
                    <td className="max-w-[20rem] truncate px-4 py-3">{e.vendorName ? <span className="font-medium">{e.vendorName}・</span> : null}{e.description}</td>
                    <td className="px-4 py-3 text-xs text-muted">{e.attachments.length > 0 ? <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" aria-hidden />{e.attachments.length}</span> : '—'}</td>
                    {review && <td className="px-4 py-3 text-xs">{whoLabel(e.submittedBy, me, displayName)}</td>}
                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(e.amount, e.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge status={STATUS_META[e.status].label} variant={STATUS_META[e.status].variant} /></td>
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
                    <p className="truncate text-sm">{e.vendorName ? `${e.vendorName}・` : ''}{e.description}</p>
                    <p className="mt-0.5 text-xs text-muted tabular-nums">{CATEGORY_LABEL[e.category]}　{fmtDate(e.expenseDate ?? e.submittedAt)}{e.attachments.length > 0 && `　📎${e.attachments.length}`}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-mono text-sm">{fmtMoney(e.amount, e.currency)}</span>
                    <StatusBadge status={STATUS_META[e.status].label} variant={STATUS_META[e.status].variant} size="sm" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && (
        <DetailSheet expense={selected} review={review} me={me} displayName={displayName} onClose={() => setSelectedId(null)} onChanged={upsert} onEdit={() => { setEditing(selected); setSelectedId(null) }} />
      )}
      {entry && (
        <EntrySheet mode={entry.mode} initialFiles={entry.files} onClose={() => setEntry(null)} onCreated={(e) => { upsert(e); setEntry(null); toast(`已${e.status === 'DRAFT' ? '儲存草稿' : '提交審核'} ${e.expenseNumber}`, 'success') }} />
      )}
      {editing && (
        <EntrySheet mode="edit" existing={editing} initialFiles={[]} onClose={() => setEditing(null)} onCreated={(e) => { upsert(e); setEditing(null); toast(`已更新 ${e.expenseNumber}（已留存更正歷史）`, 'success') }} />
      )}
    </div>
  )
}

/* ───────────────────────────── 詳情 ───────────────────────────── */

function DetailSheet({ expense: e, review, me, displayName, onClose, onChanged, onEdit }: { expense: ExpenseDTO; review: boolean; me: string; displayName: string; onClose: () => void; onChanged: (e: ExpenseDTO) => void; onEdit: () => void }) {
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  const [note, setNote] = React.useState('')
  const [preview, setPreview] = React.useState<string | null>(null)
  const own = e.submittedBy === me
  const canEdit = review || (own && (e.status === 'DRAFT' || e.status === 'REJECTED'))

  const change = async (status: Status, needNote = false) => {
    if (needNote && !note.trim()) return toast('請填寫原因或說明', 'error')
    setBusy(true)
    const res = await setExpenseStatusApi(e.id, status, note.trim() || undefined)
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    onChanged(res.data)
    setNote('')
    toast(`已${{ DRAFT: '改回草稿', SUBMITTED: '提交審核', APPROVED: '核准', REJECTED: '退回' }[status]}`, 'success')
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={`費用 ${e.expenseNumber}`} description={`${CATEGORY_LABEL[e.category]}・支出日期 ${fmtDate(e.expenseDate)}・提交 ${fmtDate(e.submittedAt)}`}>
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={STATUS_META[e.status].label} variant={STATUS_META[e.status].variant} />
            <span className="font-mono text-base font-semibold">{fmtMoney(e.amount, e.currency)}</span>
            {e.revisions.length > 0 && <span className="inline-flex items-center gap-1 text-xs text-muted"><History className="h-3.5 w-3.5" aria-hidden />更正 {e.revisions.length} 次</span>}
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <Info label="商家／供應商" value={e.vendorName ?? '未填寫'} />
            <Info label="發票／收據號碼" value={e.docNumber ?? '無'} mono={Boolean(e.docNumber)} />
            <Info label="提交人" value={whoLabel(e.submittedBy, me, displayName)} />
            <Info label={e.status === 'REJECTED' ? '退回' : '核准'} value={e.status === 'APPROVED' ? `${fmtDate(e.approvedAt)}・${whoLabel(e.approvedBy, me, displayName)}` : e.status === 'REJECTED' ? `${fmtDate(e.reviewedAt)}` : '尚未審核'} />
          </dl>
          <p className="whitespace-pre-wrap">{e.description}</p>
          {e.reviewNote && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">審核說明：{e.reviewNote}</p>}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">附件（{e.attachments.length}）</h3>
            {e.attachments.length === 0 ? <p className="text-xs text-muted">沒有附件{e.legacyReceiptNumber ? `（舊收據 ${e.legacyReceiptNumber}）` : ''}</p> : (
              <ul className="grid grid-cols-3 gap-2">
                {e.attachments.map((a) => (
                  <li key={a.id} className="overflow-hidden rounded-lg border border-[rgb(var(--border))]">
                    {a.isPdf ? (
                      <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="flex h-24 flex-col items-center justify-center gap-1 text-xs text-muted hover:surface-2"><FileText className="h-6 w-6" aria-hidden />PDF</a>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <button type="button" onClick={() => setPreview(attachmentUrl(a.id))} className="block h-24 w-full"><img src={attachmentUrl(a.id, true)} alt={a.originalName ?? '收據'} className="h-full w-full object-cover" /></button>
                    )}
                    <a href={attachmentUrl(a.id) + '&download=1'} className="block truncate px-1.5 py-1 text-[11px] text-muted hover:underline" title={a.originalName ?? undefined}>下載・{Math.round(a.sizeBytes / 1024)} KB</a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[11px] text-muted">附件為私有檔案，只有擁有者與申請人本人可檢視或下載。</p>
          </section>

          {e.revisions.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">更正歷史</h3>
              <ul className="space-y-1.5">
                {e.revisions.map((r) => {
                  const b = r.before as Record<string, unknown>; const a = r.after as Record<string, unknown>
                  const diff = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
                  return (
                    <li key={r.id} className="rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-xs">
                      <p className="text-muted">{fmtDateTime(r.createdAt)}・{whoLabel(r.changedBy, me, displayName)}{r.note ? `・${r.note}` : ''}</p>
                      <p>{diff.map((k) => `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(a[k])}`).join('；') || '無欄位變更'}</p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <div className="space-y-2 border-t border-[rgb(var(--border))] pt-4">
            {(e.status === 'SUBMITTED' && review) || (e.status === 'APPROVED' && review && e.attachments.length === 0) ? (
              <Input value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="審核說明（退回必填；核准可填核對方式）" aria-label="審核說明" />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {e.status === 'DRAFT' && (own || review) && <Button size="sm" loading={busy} onClick={() => change('SUBMITTED')}>提交審核</Button>}
              {e.status === 'SUBMITTED' && review && <Button size="sm" loading={busy} onClick={() => change('APPROVED', e.attachments.length === 0)}>核准</Button>}
              {e.status === 'SUBMITTED' && review && <Button size="sm" variant="danger" disabled={busy} onClick={() => change('REJECTED', true)}>退回</Button>}
              {e.status === 'SUBMITTED' && own && !review && <Button size="sm" variant="secondary" loading={busy} onClick={() => change('DRAFT')}>撤回為草稿</Button>}
              {e.status === 'REJECTED' && (own || review) && <Button size="sm" variant="secondary" loading={busy} onClick={() => change('DRAFT')}>改回草稿修改</Button>}
              {canEdit && <Button size="sm" variant="secondary" onClick={onEdit}>{e.status === 'APPROVED' ? '更正（留存歷史）' : '編輯'}</Button>}
            </div>
            <p className="text-xs text-muted">{review ? '核准或退回會寫入資料庫與操作紀錄；已核准資料的更正會留存歷史，不會無痕覆寫。' : '送審中與已核准的申請不能自行修改；需要更正請聯絡擁有者。'}</p>
          </div>
        </div>
        {preview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)} role="dialog" aria-label="附件預覽">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="附件" className="max-h-full max-w-full rounded-lg object-contain" />
            <button type="button" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90" aria-label="關閉預覽" onClick={() => setPreview(null)}><X className="h-5 w-5" aria-hidden /></button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ───────────────────────────── 登錄／編輯 ───────────────────────────── */

interface Draft { category: Category; amount: string; currency: string; expenseDate: string; vendorName: string; description: string; docNumber: string }

function EntrySheet({ mode, existing, initialFiles, onClose, onCreated }: { mode: 'camera' | 'upload' | 'manual' | 'edit'; existing?: ExpenseDTO; initialFiles: File[]; onClose: () => void; onCreated: (e: ExpenseDTO) => void }) {
  const { toast } = useToast()
  const isEdit = mode === 'edit'
  const [step, setStep] = React.useState<1 | 2 | 3>(mode === 'manual' || isEdit ? 2 : 1)
  const [attachments, setAttachments] = React.useState<(AttachmentDTO & { bust: number })[]>(() => existing?.attachments.map((a) => ({ ...a, bust: 0 })) ?? [])
  const [uploading, setUploading] = React.useState(0)
  const [form, setForm] = React.useState<Draft>({
    category: existing?.category ?? 'OTHER',
    amount: existing ? String(existing.amount) : '',
    currency: existing?.currency ?? 'TWD',
    expenseDate: existing?.expenseDate ? existing.expenseDate.slice(0, 10) : todayStr(),
    vendorName: existing?.vendorName ?? '',
    description: existing?.description ?? '',
    docNumber: existing?.docNumber ?? '',
  })
  const [note, setNote] = React.useState('')
  const [dups, setDups] = React.useState<Array<{ expenseNumber: string; reason: string; amount: number; status: string }>>([])
  const [saving, setSaving] = React.useState<'DRAFT' | 'SUBMITTED' | 'EDIT' | null>(null)
  const keyRef = React.useRef(newKey())
  const moreRef = React.useRef<HTMLInputElement>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }))
  const valid = Number(form.amount) > 0 && Number.isInteger(Number(form.amount)) && form.description.trim().length > 0

  const addFiles = React.useCallback(async (files: File[]) => {
    for (const file of files) {
      if (attachments.length + 1 > 6) { toast('附件最多 6 張', 'error'); break }
      setUploading((n) => n + 1)
      const res = await uploadAttachmentApi(file)
      setUploading((n) => n - 1)
      if (!res.ok) { toast(`「${file.name}」上傳失敗：${res.error}`, 'error'); continue }
      setAttachments((list) => [...list, { ...res.data, bust: 0 }])
      if (res.data.duplicateOfExisting) toast('這張圖片先前已登錄過，請確認是否重複', 'info')
    }
  }, [attachments.length, toast])
  const started = React.useRef(false)
  React.useEffect(() => {
    if (started.current || initialFiles.length === 0) return
    started.current = true
    void addFiles(initialFiles)
  }, [initialFiles, addFiles])

  const rotate = async (id: string) => {
    const res = await rotateAttachmentApi(id, 90)
    if (!res.ok) return toast(res.error, 'error')
    setAttachments((list) => list.map((a) => (a.id === id ? { ...a, bust: a.bust + 1 } : a)))
  }
  const remove = async (id: string) => {
    if (!isEdit) await deleteAttachmentApi(id)
    setAttachments((list) => list.filter((a) => a.id !== id))
  }
  const checkDups = async () => {
    if (!(Number(form.amount) > 0)) return setDups([])
    const res = await duplicateHintsApi({ amount: Number(form.amount), vendorName: form.vendorName || undefined, expenseDate: form.expenseDate || undefined, docNumber: form.docNumber || undefined, excludeId: existing?.id })
    setDups(res.ok ? res.data : [])
  }

  const submit = async (status: 'DRAFT' | 'SUBMITTED' | 'EDIT') => {
    if (!valid) return
    if (saving) return // 連點保護
    setSaving(status)
    const payload = { category: form.category, amount: Number(form.amount), currency: form.currency, description: form.description.trim(), vendorName: form.vendorName.trim() || null, expenseDate: form.expenseDate || null, docNumber: form.docNumber.trim() || null, attachmentIds: attachments.map((a) => a.id) }
    const res = status === 'EDIT' && existing
      ? await updateExpenseApi(existing.id, { ...payload, note: note.trim() || null })
      : await createExpenseApi({ ...payload, status, idempotencyKey: keyRef.current })
    setSaving(null)
    if (!res.ok) return toast(res.error, 'error')
    if (res.meta?.duplicateSubmit) toast('這筆先前已送出，未重複建立', 'info')
    onCreated(res.data)
  }

  const title = isEdit ? `${existing?.status === 'APPROVED' ? '更正' : '編輯'}費用 ${existing?.expenseNumber}` : mode === 'manual' ? '手動登錄費用' : mode === 'camera' ? '拍照登錄' : '上傳收據'
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={title} description={isEdit ? '每次修改都會留存更正歷史' : `步驟 ${step}／3：${step === 1 ? '預覽附件' : step === 2 ? '填寫欄位（OCR 尚未串接，請人工填寫）' : '人工確認後儲存'}`}>
        <div className="space-y-4 text-sm">
          {(step === 1 || isEdit || attachments.length > 0 || mode !== 'manual') && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">附件 {attachments.length}／6{uploading > 0 && <span className="ml-2 inline-flex items-center gap-1 normal-case"><Loader2 className="h-3 w-3 animate-spin" aria-hidden />上傳中 {uploading}</span>}</h3>
                <input ref={moreRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; void addFiles(f) }} aria-label="再上傳附件" />
                <Button size="sm" variant="ghost" onClick={() => moreRef.current?.click()} disabled={attachments.length >= 6}><Upload className="h-4 w-4" aria-hidden />{attachments.length > 0 ? '重新上傳／新增' : '選擇檔案'}</Button>
              </div>
              {attachments.length === 0 ? <p className="rounded-lg border border-dashed border-[rgb(var(--border))] p-4 text-center text-xs text-muted">{mode === 'manual' || isEdit ? '可不附檔；沒有附件的費用核准時需填寫核對說明' : '尚未成功上傳任何附件'}</p> : (
                <ul className="grid grid-cols-3 gap-2">
                  {attachments.map((a) => (
                    <li key={a.id} className="overflow-hidden rounded-lg border border-[rgb(var(--border))]">
                      {a.isPdf ? <div className="flex h-24 flex-col items-center justify-center gap-1 text-xs text-muted"><FileText className="h-6 w-6" aria-hidden />PDF</div> : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachmentUrl(a.id, true, a.bust)} alt={a.originalName ?? '收據'} className="h-24 w-full object-cover" />
                      )}
                      <div className="flex items-center justify-between px-1 py-0.5">
                        {!a.isPdf ? <button type="button" onClick={() => rotate(a.id)} className="grid h-7 w-7 place-items-center rounded hover:surface-2" aria-label="旋轉 90 度"><RotateCw className="h-3.5 w-3.5" aria-hidden /></button> : <span />}
                        <button type="button" onClick={() => remove(a.id)} className="grid h-7 w-7 place-items-center rounded text-red-600 hover:surface-2" aria-label="移除附件"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {step === 1 && <Button className="mt-3" block disabled={uploading > 0 || attachments.length === 0} onClick={() => setStep(2)}>下一步：填寫欄位</Button>}
            </section>
          )}

          {step >= 2 && (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="支出日期" htmlFor="exp-date"><Input id="exp-date" type="date" value={form.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} onBlur={checkDups} /></Field>
                <Field label="費用類別" htmlFor="exp-category">
                  <select id="exp-category" value={form.category} onChange={(e) => set('category', e.target.value as Category)} className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]">
                    {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                  </select>
                </Field>
                <Field label="商家／供應商" htmlFor="exp-vendor"><Input id="exp-vendor" value={form.vendorName} onChange={(e) => set('vendorName', e.target.value)} onBlur={checkDups} placeholder="例：全聯、台電" /></Field>
                <Field label="發票／收據號碼（如有）" htmlFor="exp-doc"><Input id="exp-doc" value={form.docNumber} onChange={(e) => set('docNumber', e.target.value.toUpperCase())} onBlur={checkDups} placeholder="例：AB-12345678" /></Field>
                <Field label="金額" htmlFor="exp-amount"><Input id="exp-amount" type="number" inputMode="numeric" min={1} step={1} value={form.amount} onChange={(e) => set('amount', e.target.value)} onBlur={checkDups} /></Field>
                <Field label="幣別" htmlFor="exp-currency">
                  <select id="exp-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)} className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]">
                    <option value="TWD">TWD 新台幣</option><option value="USD">USD</option><option value="JPY">JPY</option>
                  </select>
                </Field>
              </div>
              <Field label="說明" htmlFor="exp-desc"><Input id="exp-desc" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="例：球場地板打蠟保養" /></Field>
              {isEdit && <Field label="更正說明（選填，會留在歷史）" htmlFor="exp-note"><Input id="exp-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>}
              {dups.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p className="flex items-center gap-1 font-semibold"><TriangleAlert className="h-3.5 w-3.5" aria-hidden />可能重複的收據（只提醒，不阻擋）</p>
                  <ul className="mt-1 space-y-0.5">{dups.map((d) => <li key={d.expenseNumber}>{d.expenseNumber}・{d.reason}・{fmtMoney(d.amount)}・{STATUS_META[d.status as Status]?.label ?? d.status}</li>)}</ul>
                </div>
              )}
              {step === 2 && !isEdit && <Button block disabled={!valid || uploading > 0} onClick={() => setStep(3)}>下一步：人工確認</Button>}
            </section>
          )}

          {(step === 3 || isEdit) && (
            <section className="space-y-3 border-t border-[rgb(var(--border))] pt-4">
              {!isEdit && (
                <dl className="grid grid-cols-2 gap-2 rounded-lg surface-2 p-3 text-xs">
                  <dt className="text-muted">支出日期</dt><dd>{form.expenseDate || '—'}</dd>
                  <dt className="text-muted">類別</dt><dd>{CATEGORY_LABEL[form.category]}</dd>
                  <dt className="text-muted">商家</dt><dd>{form.vendorName || '未填寫'}</dd>
                  <dt className="text-muted">金額</dt><dd className="font-mono">{fmtMoney(Number(form.amount) || 0, form.currency)}</dd>
                  <dt className="text-muted">單據號碼</dt><dd>{form.docNumber || '無'}</dd>
                  <dt className="text-muted">附件</dt><dd>{attachments.length} 張</dd>
                </dl>
              )}
              <div className="flex flex-wrap gap-2">
                {isEdit ? (
                  <Button size="sm" disabled={!valid || uploading > 0} loading={saving === 'EDIT'} onClick={() => submit('EDIT')}>儲存更正</Button>
                ) : (
                  <>
                    <Button size="sm" disabled={!valid || uploading > 0} loading={saving === 'SUBMITTED'} onClick={() => submit('SUBMITTED')}>提交審核</Button>
                    <Button size="sm" variant="secondary" disabled={!valid || uploading > 0 || saving !== null} loading={saving === 'DRAFT'} onClick={() => submit('DRAFT')}>儲存草稿</Button>
                    <Button size="sm" variant="ghost" onClick={() => setStep(2)}>返回修改</Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted">提交人：本人。重複點擊不會建立多筆；附件與費用同時儲存，不會只存其中一邊。</p>
            </section>
          )}
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
