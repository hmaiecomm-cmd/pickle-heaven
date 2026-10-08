'use client'

import * as React from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2, MessageCircleQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { useAi, useAiSelection } from '@/components/admin/ai-context'
import type { OrderDetail } from '@/server/admin-orders'
import type { RefundMethod } from '@/server/refund-service'
import { invoiceResendAction, invoiceVoidReissueAction, manualRefundDoneAction, orderDetailAction, refundAction } from '@/server/admin-ops-actions'
import { adminCancelBooking } from '@/server/admin-actions'
import { CloseButton, INVOICE, ORDER, PAYMENT, REFUND, StatusPill } from './transactions-client'

const money = (n: number) => `NT${n.toLocaleString()}`
/** 沒有財務權限時，金額一律顯示為「—」（資料已在伺服器端清除） */
const amt = (hidden: boolean, n: number) => (hidden ? '—' : money(n))
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—')
const REFUND_STATE: Record<string, [string, 'blue' | 'green' | 'red' | 'amber' | 'gray']> = {
  PROCESSING: ['處理中', 'blue'],
  SUCCEEDED: ['成功', 'green'],
  FAILED: ['失敗', 'red'],
  MANUAL_PENDING: ['待人工處理', 'amber'],
  MANUAL_DONE: ['人工已完成', 'green'],
}
const METHOD_LABEL: Record<string, string> = { ORIGINAL: '原付款方式', POINTS: '會員點數', MANUAL: '人工退款' }

/** 寬側邊面板（手機全螢幕）：客戶、項目、金額、付款、退款、發票、時間軸 */
export function OrderDrawer({
  orderId,
  perms,
  startWithRefund,
  onClose,
  onChanged,
}: {
  orderId: string
  perms: { refund: boolean; invoice: boolean }
  startWithRefund: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const { ask } = useAi()
  const [detail, setDetail] = React.useState<OrderDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [refundOpen, setRefundOpen] = React.useState(false)
  const [invoiceAction, setInvoiceAction] = React.useState<{ type: 'RESEND' | 'VOID'; invoiceId: string } | null>(null)

  const load = React.useCallback(async () => {
    const res = await orderDetailAction(orderId)
    if (!res.ok) return setError(res.error)
    if (!res.data) return setError('找不到這筆訂單')
    setDetail(res.data)
  }, [orderId])
  React.useEffect(() => {
    void load()
  }, [load])
  React.useEffect(() => {
    if (startWithRefund && detail && perms.refund) setRefundOpen(true)
  }, [startWithRefund, detail, perms.refund])

  // 讓 AI 助理知道目前選取的是哪一筆訂單（切換或關閉即更新）
  useAiSelection(detail ? { type: 'booking', id: detail.id, label: `訂單 ${detail.code}` } : null)

  const refreshAll = async () => {
    await load()
    onChanged()
  }

  return (
    <Dialog.Root open modal={false} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {/* 非強制對話框：開著明細時仍可使用右側的 AI 助理；面板開啟時明細往左讓出位置 */}
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-40 flex flex-col bg-zinc-50 shadow-2xl outline-none md:inset-y-0 md:left-auto md:right-[var(--ai-panel-w,0px)] md:w-[min(760px,calc(100vw-var(--ai-panel-w,0px)))] md:border-l md:border-zinc-200"
          aria-describedby={undefined}
        >
          <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3">
            <Dialog.Title className="min-w-0 flex-1 truncate text-base font-semibold">
              訂單明細{detail ? `・${detail.code}` : ''}
            </Dialog.Title>
            {detail && (
              <button type="button" onClick={() => ask('這筆訂單可以退哪些項目？')} className="flex h-9 items-center gap-1 rounded-lg border border-zinc-300 px-2 text-xs hover:bg-violet-50">
                <MessageCircleQuestion className="h-4 w-4" aria-hidden />
                問小P
              </button>
            )}
            <CloseButton onClick={onClose} />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {error && <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
            {!detail && !error && (
              <p className="flex items-center gap-2 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                讀取中…
              </p>
            )}
            {detail && (
              <>
                {detail.demo && <p className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">展示資料：付款、退款、發票操作只會產生模擬結果</p>}
                <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted">付款</span><StatusPill map={PAYMENT} value={detail.paymentStatus} />
                    <span className="ml-2 text-xs text-muted">訂單</span><StatusPill map={ORDER} value={detail.orderStatus} />
                    <span className="ml-2 text-xs text-muted">退款</span><StatusPill map={REFUND} value={detail.refundStatus} />
                    <span className="ml-2 text-xs text-muted">發票</span><StatusPill map={INVOICE} value={detail.invoiceStatus} />
                  </div>
                  <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-1">
                    <dt className="text-muted">建立時間</dt><dd>{dt(detail.createdAt)}</dd>
                    <dt className="text-muted">付款時間</dt><dd>{dt(detail.paidAt)}</dd>
                    <dt className="text-muted">場館</dt><dd>{detail.venueName}</dd>
                  </dl>
                </section>

                <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <h3 className="font-semibold">客戶與聯絡</h3>
                  <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-y-1">
                    <dt className="text-muted">聯絡人</dt><dd>{detail.customer.name}</dd>
                    <dt className="text-muted">電話</dt><dd>{detail.customer.phone}</dd>
                    <dt className="text-muted">LINE 名稱</dt><dd>{detail.customer.lineName}</dd>
                    <dt className="text-muted">Email</dt><dd>{detail.customer.email ?? '—'}</dd>
                    <dt className="text-muted">會員</dt>
                    <dd>
                      <Link href={`/admin/members/${detail.customer.userId}`} className="text-brand-700 hover:underline">#{detail.customer.userId.slice(-6)} 查看會員紀錄</Link>
                      {!detail.amountsHidden && <span className="ml-2 text-xs text-muted">目前點數 {detail.customer.points}</span>}
                    </dd>
                    {detail.note && (<><dt className="text-muted">訂單備註</dt><dd className="whitespace-pre-wrap">{detail.note}</dd></>)}
                  </dl>
                </section>

                <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">項目</h3>
                    {perms.refund && detail.refundOptions.items.some((i) => !i.blocked) && (
                      <button type="button" onClick={() => setRefundOpen(true)} className="h-9 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white">選擇項目退款</button>
                    )}
                  </div>
                  <table className="mt-2 w-full text-sm">
                    <thead className="text-left text-xs text-muted">
                      <tr><th className="py-1 font-medium">項目</th><th className="py-1 font-medium">日期時段</th>{!detail.amountsHidden && <><th className="py-1 text-right font-medium">數量×單價</th><th className="py-1 text-right font-medium">小計</th></>}<th className="py-1 font-medium">狀態</th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {detail.courtItems.map((i) => (
                        <tr key={i.id}>
                          <td className="py-1.5">場地 {i.courtName}<span className="block text-[11px] text-muted">{i.rateName}</span></td>
                          <td className="py-1.5 text-xs">{i.date} {i.timeLabel}</td>
                          {!detail.amountsHidden && (<><td className="py-1.5 text-right text-xs">1 × {money(i.price)}</td>
                          <td className="py-1.5 text-right">{money(i.price)}{(i.refundedAmount > 0 || i.refundedPoints > 0) && <span className="block text-[11px] text-muted">已退 {money(i.refundedAmount)}{i.refundedPoints ? `＋${i.refundedPoints}點` : ''}</span>}</td></>)}
                          <td className="py-1.5"><Pill tone={i.status === 'ACTIVE' ? 'blue' : 'gray'}>{i.status === 'ACTIVE' ? '有效' : '已取消'}</Pill></td>
                        </tr>
                      ))}
                      {detail.activityItems.map((i) => (
                        <tr key={i.id}>
                          <td className="py-1.5">活動 {i.title}<span className="block text-[11px] text-muted">{i.courtNames}</span></td>
                          <td className="py-1.5 text-xs">{i.date} {i.timeLabel}</td>
                          {!detail.amountsHidden && (<><td className="py-1.5 text-right text-xs">{i.quantity} × {money(i.unitPrice)}</td>
                          <td className="py-1.5 text-right">{money(i.amount)}{(i.refundedAmount > 0 || i.refundedPoints > 0) && <span className="block text-[11px] text-muted">已退 {money(i.refundedAmount)}{i.refundedPoints ? `＋${i.refundedPoints}點` : ''}</span>}</td></>)}
                          <td className="py-1.5"><Pill tone={i.status === 'ACTIVE' ? 'blue' : 'gray'}>{{ ACTIVE: '有效', CANCELLED: '已取消', REFUNDED: '場次取消已退' }[i.status] ?? i.status}</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.amountsHidden ? (
                    <p className="mt-3 border-t border-zinc-100 pt-2 text-xs text-muted">金額、折抵與金流明細僅擁有者可見；此處只顯示付款是否已確認。</p>
                  ) : (
                  <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 border-t border-zinc-100 pt-2 text-sm">
                    <dt className="text-muted">原價合計</dt><dd className="text-right">{money(detail.amounts.subtotal)}</dd>
                    {detail.amounts.discount > 0 && (<><dt className="text-muted">折價券 {detail.amounts.voucherCode}</dt><dd className="text-right">−{money(detail.amounts.discount)}</dd></>)}
                    {detail.amounts.pointsUsed > 0 && (<><dt className="text-muted">點數折抵</dt><dd className="text-right">−{detail.amounts.pointsUsed} 點</dd></>)}
                    <dt className="font-semibold">實際付款</dt><dd className="text-right font-semibold">{money(detail.amounts.total)}</dd>
                    <dt className="text-muted">已退款（實付）</dt><dd className="text-right">{money(detail.amounts.refundedAmount)}</dd>
                  </dl>
                  )}
                  {detail.status === 'PENDING' && perms.refund && <CancelPending bookingId={detail.id} onDone={refreshAll} />}
                </section>

                <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <h3 className="font-semibold">付款紀錄</h3>
                  {detail.payments.length === 0 ? <p className="mt-2 text-muted">尚無付款紀錄</p> : (
                    <ul className="mt-2 space-y-1">
                      {detail.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-2">
                          <Pill tone={p.status === 'SUCCESS' ? 'green' : p.status === 'FAILED' ? 'red' : p.status === 'REFUNDED' ? 'violet' : 'gray'}>{p.status}</Pill>
                          {amt(detail.amountsHidden, p.amount)}・{p.provider}{p.simulated && '（模擬金流）'}・{p.method}{p.card ? `・${p.card}` : ''}
                          <span className="text-[11px] text-muted">{detail.amountsHidden ? '' : `交易編號 ${p.providerRef ?? '—'}・`}{dt(p.at)}</span>
                          {p.failReason && <span className="text-xs text-red-700">{p.failReason}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <h3 className="font-semibold">退款紀錄</h3>
                  {detail.refunds.length === 0 ? <p className="mt-2 text-muted">無退款</p> : (
                    <ul className="mt-2 space-y-2">
                      {detail.refunds.map((r) => {
                        const [label, tone] = REFUND_STATE[r.status] ?? [r.status, 'gray']
                        return (
                          <li key={r.id} className="rounded-xl bg-zinc-50 p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Pill tone={tone}>{label}</Pill>
                              {r.simulated && <Pill tone="violet">模擬結果</Pill>}
                              <span>{detail.amountsHidden ? '' : `${money(r.cashAmount)}${r.pointsAmount ? `＋${r.pointsAmount} 點` : ''}・`}{METHOD_LABEL[r.method] ?? r.method}</span>
                              <span className="text-[11px] text-muted">{dt(r.createdAt)}・{r.createdBy}</span>
                            </div>
                            <p className="mt-1 text-xs">原因：{r.reason}{r.cancelItems ? '・同時取消預約' : '・不取消預約'}</p>
                            {r.items.length > 0 && <p className="text-[11px] text-muted">{r.items.map((i) => i.label).join('；')}</p>}
                            {r.failReason && <p className="text-xs text-red-700">失敗原因：{r.failReason}</p>}
                            {r.note && <p className="text-xs">{r.note}</p>}
                            {r.status === 'MANUAL_PENDING' && perms.refund && <ManualDone refundId={r.id} onDone={refreshAll} />}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <h3 className="font-semibold">發票</h3>
                  <p className="mt-1 text-xs text-muted">發票服務：{detail.invoiceIntegration.label}{detail.invoiceIntegration.reason ? `（${detail.invoiceIntegration.reason}）` : ''}。退款完成不代表發票已同步處理。</p>
                  {detail.invoices.length === 0 ? <p className="mt-2 text-muted">這筆訂單沒有發票紀錄</p> : (
                    <ul className="mt-2 space-y-2">
                      {detail.invoices.map((inv) => (
                        <li key={inv.id} className="rounded-xl bg-zinc-50 p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs">{inv.number}</span>
                            <StatusPill map={INVOICE} value={inv.providerStatus ?? 'INTERNAL'} />
                            {!detail.amountsHidden && <span>{money(inv.amount)}</span>}
                            <span className="text-[11px] text-muted">開立 {dt(inv.issueDate)}・收件 {inv.recipientEmail ?? '—'}</span>
                          </div>
                          {inv.events.map((e) => (
                            <p key={e.id} className="text-[11px] text-muted">
                              {e.type === 'RESEND' ? '補寄' : '作廢重開'}：{e.status}{e.simulated ? '（模擬）' : ''}・{dt(e.at)}{e.reason ? `・${e.reason}` : ''}{e.error ? `・${e.error}` : ''}
                            </p>
                          ))}
                          {perms.invoice && inv.providerStatus !== 'VOIDED' && (
                            <div className="mt-1.5 flex gap-2">
                              <button type="button" disabled={!detail.invoiceIntegration.connected} onClick={() => setInvoiceAction({ type: 'RESEND', invoiceId: inv.id })} className="h-8 rounded-lg border border-zinc-300 px-2 text-xs disabled:opacity-40" title={detail.invoiceIntegration.reason ?? undefined}>補寄發票通知</button>
                              <button type="button" disabled={!detail.invoiceIntegration.connected} onClick={() => setInvoiceAction({ type: 'VOID', invoiceId: inv.id })} className="h-8 rounded-lg border border-zinc-300 px-2 text-xs disabled:opacity-40" title={detail.invoiceIntegration.reason ?? undefined}>申請作廢重開</button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                  <h3 className="font-semibold">操作時間軸</h3>
                  <ol className="mt-2 space-y-1 border-l border-zinc-200 pl-3">
                    {detail.timeline.map((t, i) => (
                      <li key={i} className="text-xs">
                        <span className="text-muted">{dt(t.at)}</span>　{t.label}{t.actor ? <span className="text-muted">（{t.actor}）</span> : null}
                      </li>
                    ))}
                  </ol>
                </section>
              </>
            )}
          </div>

          {detail && refundOpen && <RefundDialog detail={detail} onClose={() => setRefundOpen(false)} onDone={refreshAll} />}
          {detail && invoiceAction && (
            <InvoiceDialog
              detail={detail}
              action={invoiceAction}
              onClose={() => setInvoiceAction(null)}
              onDone={async (msg) => {
                toast(msg, 'success')
                setInvoiceAction(null)
                await refreshAll()
              }}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CancelPending({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm('取消這筆待付款訂單？時段與名額會立即釋放；已折抵的點數與折價券會歸還。')) return
        setBusy(true)
        const res = await adminCancelBooking(bookingId)
        setBusy(false)
        if (!res.ok) toast(res.error, 'error')
        else {
          toast(res.message ?? '已取消', 'success')
          onDone()
        }
      }}
      className="mt-3 h-9 rounded-lg border border-red-300 px-3 text-xs font-semibold text-red-700"
    >
      取消待付款訂單
    </button>
  )
}

function ManualDone({ refundId, onDone }: { refundId: string; onDone: () => void }) {
  const { toast } = useToast()
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  return (
    <div className="mt-2 flex gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="處理說明，例如匯款日期與帳號末五碼" className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 text-xs" aria-label="人工退款處理說明" />
      <button
        type="button"
        disabled={busy || !note.trim()}
        onClick={async () => {
          setBusy(true)
          const res = await manualRefundDoneAction(refundId, note)
          setBusy(false)
          if (!res.ok) toast(res.error, 'error')
          else onDone()
        }}
        className="h-9 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white disabled:opacity-40"
      >
        標記人工退款完成
      </button>
    </div>
  )
}

/* ─────────────────────────── 退款確認 ─────────────────────────── */

function RefundDialog({ detail, onClose, onDone }: { detail: OrderDetail; onClose: () => void; onDone: () => Promise<void> }) {
  const opt = detail.refundOptions
  const refundable = opt.items.filter((i) => !i.blocked)
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const [method, setMethod] = React.useState<RefundMethod>(opt.methods.find((m) => m.available)?.method ?? 'POINTS')
  const [cancelItems, setCancelItems] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [step, setStep] = React.useState<'select' | 'confirm' | 'result'>('select')
  const [busy, setBusy] = React.useState(false)
  const [result, setResult] = React.useState<{ status: string; simulated: boolean; failReason: string | null; duplicate: boolean; cash: number; points: number } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  // 每次開啟確認畫面產生一次識別碼：連點或重送只會處理一次
  const keyRef = React.useRef(`rf-${crypto.randomUUID()}`)

  const items = opt.items.filter((i) => picked.has(i.itemId))
  const cash = items.reduce((s, i) => s + i.refundableCash, 0)
  const points = items.reduce((s, i) => s + i.refundablePoints, 0)
  const methodInfo = opt.methods.find((m) => m.method === method)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await refundAction({
        bookingId: detail.id,
        itemIds: [...picked],
        method,
        cancelItems,
        reason,
        idempotencyKey: keyRef.current,
        expectedCash: cash,
        expectedPoints: points,
      })
      if (!res.ok) return setError(res.error)
      setResult({ status: res.data.status, simulated: res.data.simulated, failReason: res.data.failReason, duplicate: res.data.duplicate, cash: res.data.cashAmount, points: res.data.pointsAmount })
      setStep('result')
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-white outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-[min(36rem,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl" aria-describedby={undefined}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <Dialog.Title className="font-semibold">{step === 'result' ? '退款結果' : step === 'confirm' ? '確認退款' : `退款・訂單 ${opt.code}`}</Dialog.Title>
            {!busy && <CloseButton onClick={onClose} />}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {opt.simulated && <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">這筆款項使用模擬金流或展示資料：退款只會產生「模擬結果」，不會退真實款項。</p>}
            {opt.note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{opt.note}</p>}

            {step === 'select' && (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">選擇項目</p>
                    <button type="button" onClick={() => setPicked(new Set(refundable.map((i) => i.itemId)))} className="text-xs font-semibold text-brand-700">全部可退款項目</button>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {opt.items.map((i) => (
                      <li key={i.itemId}>
                        <label className={cn('flex items-start gap-2 rounded-xl border p-2', i.blocked ? 'border-zinc-200 bg-zinc-50 text-zinc-400' : picked.has(i.itemId) ? 'border-brand-500 bg-brand-50' : 'border-zinc-200')}>
                          <input
                            type="checkbox"
                            className="mt-1"
                            disabled={Boolean(i.blocked)}
                            checked={picked.has(i.itemId)}
                            onChange={(e) => {
                              const n = new Set(picked)
                              if (e.target.checked) n.add(i.itemId)
                              else n.delete(i.itemId)
                              setPicked(n)
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            {i.label}
                            <span className="block text-[11px]">{i.detail}・原價 {money(i.gross)}・分攤實付 {money(i.cashShare)}{i.pointsShare ? `＋${i.pointsShare}點` : ''}・已退 {money(i.refundedCash)}{i.refundedPoints ? `＋${i.refundedPoints}點` : ''}</span>
                          </span>
                          <span className="shrink-0 text-right text-xs font-semibold">{i.blocked ?? `可退 ${money(i.refundableCash)}${i.refundablePoints ? `＋${i.refundablePoints}點` : ''}`}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-muted">可退金額＝依折扣與點數分攤後的實付金額−已退部分（由系統計算，不是原價）。</p>
                </div>

                <fieldset>
                  <legend className="font-semibold">退回方式</legend>
                  <div className="mt-1 space-y-1">
                    {opt.methods.map((m) => (
                      <label key={m.method} className={cn('flex items-start gap-2 rounded-xl border p-2', !m.available && 'opacity-50', method === m.method && 'border-brand-500 bg-brand-50')}>
                        <input type="radio" name="method" className="mt-1" disabled={!m.available} checked={method === m.method} onChange={() => setMethod(m.method)} />
                        <span>
                          {m.label}
                          <span className="block text-[11px] text-muted">{m.note}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label className="flex items-start gap-2 rounded-xl border border-zinc-200 p-2">
                  <input type="checkbox" className="mt-1" checked={cancelItems} onChange={(e) => setCancelItems(e.target.checked)} />
                  <span>
                    同時取消所選項目的預約
                    <span className="block text-[11px] text-muted">勾選：場地時段與活動名額會釋放給其他人（原路退款在金流成功後才取消）。不勾選：只退款，預約保留有效。</span>
                  </span>
                </label>

                <label className="block">
                  <span className="font-semibold">退款原因</span>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300} className="mt-1 w-full rounded-lg border border-zinc-300 p-2" placeholder="例：客人臨時無法到場，與場館協調後退款" />
                </label>
              </>
            )}

            {step === 'confirm' && (
              <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
                <dt className="text-muted">訂單</dt><dd>{opt.code}（{detail.venueName}）</dd>
                <dt className="text-muted">退款項目</dt><dd>{items.map((i) => <span key={i.itemId} className="block">{i.label}　{money(i.refundableCash)}{i.refundablePoints ? `＋${i.refundablePoints}點` : ''}</span>)}</dd>
                <dt className="text-muted">退款金額</dt><dd className="font-semibold">{money(cash)}</dd>
                <dt className="text-muted">點數處理</dt><dd>{points > 0 ? `退回 ${points} 點` : '無'}{method === 'POINTS' && cash > 0 ? `；實付 ${money(cash)} 改以 ${cash} 點回補` : ''}</dd>
                <dt className="text-muted">退回方式</dt><dd>{methodInfo?.label}<span className="block text-[11px] text-muted">{methodInfo?.note}</span></dd>
                <dt className="text-muted">預約</dt><dd className={cancelItems ? 'font-semibold text-red-700' : ''}>{cancelItems ? '取消所選項目並釋放場地／名額' : '不取消，預約維持有效'}</dd>
                <dt className="text-muted">原因</dt><dd>{reason}</dd>
              </dl>
            )}

            {step === 'result' && result && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-base font-semibold">
                  <Pill tone={(REFUND_STATE[result.status] ?? ['', 'gray'])[1]}>{(REFUND_STATE[result.status] ?? [result.status])[0]}</Pill>
                  {result.simulated && <Pill tone="violet">模擬結果</Pill>}
                </p>
                <p>{money(result.cash)}{result.points ? `＋${result.points} 點` : ''}</p>
                {result.duplicate && <p className="text-xs text-muted">這個退款先前已送出，沒有重複處理。</p>}
                {result.status === 'MANUAL_PENDING' && <p className="text-xs">已記錄為待人工處理，請完成匯款後在退款紀錄標記完成。</p>}
                {result.failReason && <p className="text-xs text-red-700">失敗原因：{result.failReason}。已釋放預留金額，預約未取消。</p>}
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>
          <div className="flex gap-2 border-t border-zinc-200 p-3">
            {step === 'select' && (
              <button type="button" disabled={picked.size === 0 || !reason.trim()} onClick={() => setStep('confirm')} className="h-11 flex-1 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-40">
                下一步：確認（{money(cash)}{points ? `＋${points}點` : ''}）
              </button>
            )}
            {step === 'confirm' && (
              <>
                <button type="button" disabled={busy} onClick={() => setStep('select')} className="h-11 rounded-xl border border-zinc-300 px-4">返回修改</button>
                <button type="button" disabled={busy} onClick={submit} className="h-11 flex-1 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-60">
                  {busy ? '處理中，請勿關閉…' : '確認退款'}
                </button>
              </>
            )}
            {step === 'result' && <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-zinc-300">關閉</button>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ─────────────────────────── 發票補寄／作廢重開 ─────────────────────────── */

function InvoiceDialog({ detail, action, onClose, onDone }: { detail: OrderDetail; action: { type: 'RESEND' | 'VOID'; invoiceId: string }; onClose: () => void; onDone: (msg: string) => Promise<void> }) {
  const inv = detail.invoices.find((i) => i.id === action.invoiceId)!
  const [reason, setReason] = React.useState('')
  const [email, setEmail] = React.useState(inv.recipientEmail ?? '')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const keyRef = React.useRef(`inv-${crypto.randomUUID()}`)
  const resend = action.type === 'RESEND'

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = resend
        ? await invoiceResendAction(inv.id, keyRef.current)
        : await invoiceVoidReissueAction({ invoiceId: inv.id, reason, recipientEmail: email || null, idempotencyKey: keyRef.current })
      if (!res.ok) return setError(res.error)
      await onDone(`${resend ? '補寄' : '作廢重開'}：${res.data.status === 'SUCCEEDED' ? '完成' : res.data.status}${res.data.simulated ? '（模擬結果）' : ''}${res.data.duplicate ? '（先前已送出，未重複處理）' : ''}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => !o && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white p-4 outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(30rem,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl" aria-describedby={undefined}>
          <Dialog.Title className="font-semibold">{resend ? '補寄發票通知' : '申請作廢重開'}</Dialog.Title>
          <div className="mt-3 space-y-2 text-sm">
            {detail.invoiceIntegration.simulated && <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">展示環境：只會產生模擬結果，不會寄出任何信件或異動真實發票。</p>}
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1">
              <dt className="text-muted">原發票</dt><dd className="font-mono">{inv.number}</dd>
              <dt className="text-muted">金額</dt><dd>{money(inv.amount)}</dd>
              <dt className="text-muted">訂單</dt><dd>{detail.code}</dd>
              {resend && (<><dt className="text-muted">收件地址</dt><dd>{inv.recipientEmail ?? '（沒有 Email，無法補寄）'}</dd></>)}
            </dl>
            {resend ? (
              <p className="text-xs text-muted">只會補寄這張既有發票，不會重新開立新發票。</p>
            ) : (
              <>
                <label className="block">
                  <span className="font-semibold">異動原因</span>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-zinc-300 p-2" placeholder="例：客人要求更正買受人資料" />
                </label>
                <label className="block">
                  <span className="font-semibold">更正內容：收件 Email</span>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2" />
                </label>
                <p className="text-xs text-muted">作廢原發票並開立新發票，兩者會保存關聯。原發票異動中時不能再次送出。是否適用作廢重開，依發票服務商規則與訂單狀態判斷，系統不會自行決定稅務處理。</p>
              </>
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="h-11 rounded-xl border border-zinc-300 px-4">取消</button>
            <button type="button" disabled={busy || (!resend && !reason.trim()) || (resend && !inv.recipientEmail)} onClick={submit} className="h-11 flex-1 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-40">
              {busy ? '處理中…' : resend ? '確認補寄' : '確認作廢重開'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
