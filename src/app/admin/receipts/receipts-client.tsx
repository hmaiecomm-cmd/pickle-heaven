'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Download, FileScan, Loader2, Receipt as ReceiptIcon, ScanLine, Search, Upload } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { getReceipts, postOCRScan } from '@/lib/api-service'
import { downloadCsv } from '@/lib/csv'
import type { Receipt } from '@/lib/models'

/**
 * 收據（Phase 1G）。
 * OCR 流程為模擬：上傳 → 處理 → 完成，結果一律先以「草稿」呈現，
 * 由人工檢視、修改後才按「確認」；絕不自動成為會計分錄。
 */

type OcrStep = 'idle' | 'uploading' | 'processing' | 'complete'
const METHOD_LABEL: Record<string, string> = { CREDIT_CARD: '信用卡', LINE_PAY: 'LINE Pay', BANK_TRANSFER: '銀行轉帳', CASH: '現金' }
const CATEGORY_LABEL: Record<string, string> = { MAINTENANCE: '維護', SUPPLIES: '耗材', UTILITIES: '水電', LABOR: '人事', OTHER: '其他' }

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`
const ocrState = (r: Receipt) => (r.ocrData ? r.ocrData.status : 'MANUAL')

export function ReceiptsClient() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'ALL' | 'DRAFT' | 'CONFIRMED' | 'MANUAL'>('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getReceipts()
      if (!r.success) throw new Error(r.error?.message ?? '無法載入收據')
      setReceipts(r.data)
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
    const q = query.trim().toLowerCase()
    return receipts
      .filter((r) => source === 'ALL' || ocrState(r) === source)
      .filter((r) => !q || `${r.receiptNumber} ${r.vendorName} ${r.paymentId}`.toLowerCase().includes(q))
      .sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime())
  }, [receipts, query, source])

  const kpi = useMemo(
    () => ({
      count: receipts.length,
      total: receipts.reduce((s, r) => s + r.amount, 0),
      draft: receipts.filter((r) => ocrState(r) === 'DRAFT').length,
      confirmed: receipts.filter((r) => ocrState(r) === 'CONFIRMED').length,
    }),
    [receipts],
  )

  const selected = receipts.find((r) => r.id === selectedId) ?? null

  const confirmReceipt = (id: string) => {
    setReceipts((list) => list.map((r) => (r.id === id && r.ocrData ? { ...r, ocrData: { ...r.ocrData, status: 'CONFIRMED' } } : r)))
    toast('已確認辨識結果；會計分錄仍需於費用頁另行建立', 'success')
  }

  const addDraft = (r: Receipt) => {
    setReceipts((list) => [r, ...list])
    toast(`已儲存草稿 ${r.receiptNumber}，待人工確認`, 'info')
  }

  const exportCsv = () =>
    downloadCsv(
      `receipts-${fmtDate(new Date()).replace(/\//g, '')}.csv`,
      ['收據號碼', '日期', '廠商', '付款方式', '金額', '來源'],
      filtered.map((r) => [r.receiptNumber, fmtDate(r.issueDate), r.vendorName, METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod, r.amount, sourceLabel(ocrState(r))]),
    )

  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader
        title="收據"
        subtitle="收據歸檔與 OCR 辨識（辨識結果一律先為草稿）"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" aria-hidden />
              匯出 CSV
            </Button>
            <Button size="sm" onClick={() => setScanning(true)}>
              <ScanLine className="h-4 w-4" aria-hidden />
              OCR 掃描
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<ReceiptIcon className="h-5 w-5" />} label="收據數" value={kpi.count} unit="張" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="總金額" value={kpi.total.toLocaleString()} unit="元" />
        <KPICard icon={<FileScan className="h-5 w-5" />} label="OCR 草稿待確認" value={kpi.draft} unit="張" />
        <KPICard icon={<CheckCircle2 className="h-5 w-5" />} label="OCR 已確認" value={kpi.confirmed} unit="張" />
      </div>

      <div className={`flex flex-col gap-3 p-3 md:flex-row md:items-center ${panelClass}`}>
        <select aria-label="來源" value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm">
          <option value="ALL">全部來源</option>
          <option value="MANUAL">系統開立</option>
          <option value="DRAFT">OCR 草稿</option>
          <option value="CONFIRMED">OCR 已確認</option>
        </select>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋收據號碼、廠商或付款編號"
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
          <EmptyState title="沒有符合條件的收據" description="可用右上角 OCR 掃描新增" icon="🧾" />
        </div>
      ) : (
        <div className={`overflow-x-auto ${panelClass}`}>
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">收據號碼</th>
                <th className="px-4 py-3 font-medium">日期</th>
                <th className="px-4 py-3 font-medium">廠商</th>
                <th className="px-4 py-3 font-medium">付款方式</th>
                <th className="px-4 py-3 text-right font-medium">金額</th>
                <th className="px-4 py-3 font-medium">來源</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setSelectedId(r.id)} className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:surface-2">
                  <td className="px-4 py-3 font-mono font-medium">{r.receiptNumber}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtDate(r.issueDate)}</td>
                  <td className="px-4 py-3">{r.vendorName}</td>
                  <td className="px-4 py-3">{METHOD_LABEL[r.paymentMethod] ?? r.paymentMethod}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmtMoney(r.amount)}</td>
                  <td className="px-4 py-3"><SourceBadge state={ocrState(r)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 收據詳情 */}
      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={`收據 ${selected.receiptNumber}`} description={`${fmtDate(selected.issueDate)}　${selected.vendorName}`}>
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge state={ocrState(selected)} />
                <span className="font-mono text-base font-semibold">{fmtMoney(selected.amount)}</span>
                {selected.ocrData && <span className="text-xs text-muted">辨識信心 {Math.round(selected.ocrData.confidence * 100)}%</span>}
              </div>
              <section className="grid grid-cols-2 gap-3">
                <Info label="付款方式" value={METHOD_LABEL[selected.paymentMethod] ?? selected.paymentMethod} />
                <Info label="付款編號" value={selected.paymentId} mono />
              </section>
              {selected.ocrData && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">OCR 辨識欄位</h3>
                  <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-[rgb(var(--border))]">
                    {Object.entries(selected.ocrData.fields).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between px-3 py-2">
                        <span className="text-muted">{fieldLabel(k)}</span>
                        <span className="font-mono text-xs">{k === 'category' ? (CATEGORY_LABEL[v] ?? v) : v}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                {ocrState(selected) === 'DRAFT' && (
                  <Button size="sm" onClick={() => confirmReceipt(selected.id)}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    確認辨識結果
                  </Button>
                )}
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">建立費用</Button>
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">下載影像</Button>
              </div>
              <p className="text-xs text-muted">確認只代表欄位已由人工核對；會計分錄仍需在「費用」頁另行建立與審核。</p>
            </div>
          </SheetContent>
        )}
      </Sheet>

      <OcrSheet open={scanning} onOpenChange={setScanning} onSaveDraft={addDraft} />
    </div>
  )
}

/* ───────────────────────────── OCR 流程 ───────────────────────────── */

function OcrSheet({ open, onOpenChange, onSaveDraft }: { open: boolean; onOpenChange: (o: boolean) => void; onSaveDraft: (r: Receipt) => void }) {
  const [step, setStep] = useState<OcrStep>('idle')
  const [fileName, setFileName] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('idle')
    setFileName(null)
    setFields({})
  }

  const start = async (file: File) => {
    setFileName(file.name)
    setStep('uploading')
    await wait(800)
    setStep('processing')
    const [res] = await Promise.all([postOCRScan(file), wait(1200)])
    if (res.success) setFields(res.data.fields)
    setStep('complete')
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) start(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) start(f)
  }

  const save = () => {
    const amount = Number(fields.amount) || 0
    const date = fields.date ? new Date(fields.date) : new Date()
    onSaveDraft({
      id: `receipt-ocr-${Date.now()}`,
      receiptNumber: `RCP-OCR-${String(Date.now()).slice(-6)}`,
      paymentId: '—',
      amount,
      issueDate: isNaN(date.getTime()) ? new Date() : date,
      paymentMethod: 'CASH',
      vendorName: fields.vendor || '未填寫',
      ocrData: { status: 'DRAFT', fields: { ...fields }, confidence: 0.82 },
    })
    reset()
    onOpenChange(false)
  }

  const STEPS: { key: OcrStep; label: string }[] = [
    { key: 'uploading', label: '上傳' },
    { key: 'processing', label: '辨識' },
    { key: 'complete', label: '完成' },
  ]
  const stepIdx = STEPS.findIndex((s) => s.key === step)

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <SheetContent title="OCR 掃描收據" description="辨識結果會以草稿儲存，需人工確認">
        <div className="space-y-5 text-sm">
          {step === 'idle' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className="grid cursor-pointer place-items-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--border))] px-4 py-10 text-center hover:surface-2"
            >
              <Upload className="h-8 w-8 text-muted" aria-hidden />
              <p className="font-medium">拖曳收據照片到這裡，或點擊選擇檔案</p>
              <p className="text-xs text-muted">支援 JPG、PNG、PDF。目前為模擬辨識，不會上傳檔案。</p>
              <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={onPick} />
            </div>
          ) : (
            <>
              <ol className="flex items-center gap-2 text-xs">
                {STEPS.map((s, i) => {
                  const done = i < stepIdx || step === 'complete'
                  const active = i === stepIdx && step !== 'complete'
                  return (
                    <li key={s.key} className="flex flex-1 items-center gap-2">
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                          done ? 'bg-brand-600 text-white' : active ? 'border-2 border-brand-600 text-brand-600' : 'border border-[rgb(var(--border))] text-muted'
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : i + 1}
                      </span>
                      <span className={done || active ? 'font-medium' : 'text-muted'}>{s.label}</span>
                      {i < STEPS.length - 1 && <span className={`h-px flex-1 ${done ? 'bg-brand-600' : 'bg-[rgb(var(--border))]'}`} />}
                    </li>
                  )
                })}
              </ol>
              <p className="truncate text-xs text-muted">檔案：{fileName}</p>
            </>
          )}

          {step === 'complete' && (
            <>
              <div className="flex items-center gap-2">
                <StatusBadge status="草稿" variant="warning" />
                <span className="text-xs text-muted">請核對並修正辨識結果</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="日期" htmlFor="ocr-date">
                  <Input id="ocr-date" type="date" value={fields.date ?? ''} onChange={(e) => setFields((f) => ({ ...f, date: e.target.value }))} />
                </Field>
                <Field label="金額" htmlFor="ocr-amount">
                  <Input id="ocr-amount" type="number" inputMode="numeric" value={fields.amount ?? ''} onChange={(e) => setFields((f) => ({ ...f, amount: e.target.value }))} />
                </Field>
                <Field label="廠商" htmlFor="ocr-vendor">
                  <Input id="ocr-vendor" value={fields.vendor ?? ''} onChange={(e) => setFields((f) => ({ ...f, vendor: e.target.value }))} />
                </Field>
                <Field label="類別" htmlFor="ocr-category">
                  <select
                    id="ocr-category"
                    value={fields.category ?? 'OTHER'}
                    onChange={(e) => setFields((f) => ({ ...f, category: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]"
                  >
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                <Button size="sm" onClick={save}>儲存為草稿</Button>
                <Button size="sm" variant="secondary" onClick={reset}>重新掃描</Button>
              </div>
              <p className="text-xs text-muted">儲存後仍是草稿，不會自動建立任何會計分錄。</p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ───────────────────────────── 共用 ───────────────────────────── */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

const sourceLabel = (s: string) => (s === 'DRAFT' ? 'OCR 草稿' : s === 'CONFIRMED' ? 'OCR 已確認' : '系統開立')

function SourceBadge({ state }: { state: string }) {
  return <StatusBadge status={sourceLabel(state)} variant={state === 'DRAFT' ? 'warning' : state === 'CONFIRMED' ? 'success' : 'info'} />
}

const fieldLabel = (k: string) => ({ date: '日期', amount: '金額', vendor: '廠商', category: '類別' })[k] ?? k

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 truncate font-medium ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  )
}
