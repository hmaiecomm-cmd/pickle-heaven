'use client'

import * as React from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Clock3, CreditCard, FileText, History, Loader2, LockKeyhole, MessageCircleQuestion, ReceiptText, RotateCcw, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { useAi, useAiSelection } from '@/components/admin/ai-context'
import type { OrderDetail } from '@/server/admin-orders'
import type { RefundMethod } from '@/server/refund-service'
import { invoiceResendAction, invoiceVoidReissueAction, manualRefundDoneAction, orderDetailAction, refundAction } from '@/server/admin-ops-actions'
import { adminCancelBooking } from '@/server/admin-actions'
import { bookingGrantAction, createBookingGrantAction, type BookingGrantView } from './door-grant-actions'
import { CloseButton, INVOICE, StatusPill } from './transactions-client'

const money = (n: number) => `NT$${n.toLocaleString()}`
const amt = (hidden: boolean, n: number) => (hidden ? '—' : money(n))
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')
const dayLabel = (date: string) => `${date.replaceAll('-', '/')}（${'日一二三四五六'[new Date(`${date}T00:00:00Z`).getUTCDay()]}）`

/** 淡綠：成功／已建立　淡黃：需注意、替代方式　淡紅：不可逆或失敗 */
const TONE = {
  ok: 'bg-emerald-50 ring-emerald-200 text-emerald-900',
  warn: 'bg-amber-50 ring-amber-200 text-amber-900',
  danger: 'bg-red-50 ring-red-200 text-red-900',
  neutral: 'bg-zinc-50 ring-zinc-200 text-zinc-700',
} as const

const REFUND_STATE: Record<string, [string, 'blue' | 'green' | 'red' | 'amber' | 'gray']> = {
  PROCESSING: ['處理中', 'blue'],
  SUCCEEDED: ['退款完成', 'green'],
  FAILED: ['退款失敗', 'red'],
  MANUAL_PENDING: ['待人工處理', 'amber'],
  MANUAL_DONE: ['人工已完成', 'green'],
}
const REFUND_METHOD_LABEL: Record<string, string> = { ORIGINAL: '原付款方式', POINTS: '點數退費', MANUAL: '現金轉帳（人工）' }

function Section({ icon: Icon, title, defaultOpen = true, right, children, id }: { icon: typeof FileText; title: string; defaultOpen?: boolean; right?: React.ReactNode; children: React.ReactNode; id?: string }) {
  const [open, setOpen] = React.useState(defaultOpen)
  const bodyId = React.useId()
  return (
    <section id={id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-[#e3e8dc]">
      <div className="flex items-center gap-2 pr-2">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={bodyId} className="flex min-h-12 flex-1 items-center gap-2.5 px-4 text-left">
          <Icon className="h-5 w-5 shrink-0 text-[#1f4d34]" strokeWidth={1.9} aria-hidden />
          <span className="flex-1 text-[15px] font-bold text-[#1f2a22]">{title}</span>
          <ChevronDown className={cn('h-5 w-5 shrink-0 text-zinc-400 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {right}
      </div>
      {open && <div id={bodyId} className="border-t border-[#eef1e9] p-4 text-sm">{children}</div>}
    </section>
  )
}

function Block({ tone, children, className }: { tone: keyof typeof TONE; children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-xl p-3 ring-1', TONE[tone], className)}>{children}</div>
}

/* ─────────────── 付款方式 → 預設退費方式 ─────────────── */

type RefundChoice = 'CARD' | 'POINTS' | 'BANK' | 'LINEPAY'
const CHOICE_LABEL: Record<RefundChoice, string> = { CARD: '刷卡退刷（原付款方式）', POINTS: '點數退費', BANK: '現金轉帳退費', LINEPAY: 'LINE Pay 退費' }
const CHOICE_METHOD: Record<RefundChoice, RefundMethod> = { CARD: 'ORIGINAL', LINEPAY: 'ORIGINAL', POINTS: 'POINTS', BANK: 'MANUAL' }
const REASONS = ['客人取消', '預約取消', '交易逾期', '原付款方式無法處理', '其他'] as const
const ALT_REASONS: readonly string[] = ['交易逾期', '原付款方式無法處理', '其他']

function paymentKind(detail: OrderDetail) {
  const pay = detail.payments.find((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED')
  if (!pay || pay.provider === 'internal') return { pay, kind: 'POINTS' as const }
  if (pay.provider === 'linepay' || pay.method === 'LINE_PAY') return { pay, kind: 'LINEPAY' as const }
  return { pay, kind: 'CARD' as const }
}

function refundChoices(detail: OrderDetail) {
  const { kind } = paymentKind(detail)
  const m = (x: RefundMethod) => detail.refundOptions.methods.find((o) => o.method === x)
  const original = m('ORIGINAL')
  const choices: { key: RefundChoice; available: boolean; why: string | null }[] = [
    { key: 'CARD', available: kind === 'CARD' && !!original?.available, why: kind !== 'CARD' ? '此訂單不是信用卡付款' : original?.available ? null : original?.note ?? '原付款方式無法處理' },
    { key: 'POINTS', available: !!m('POINTS')?.available, why: m('POINTS')?.available ? null : m('POINTS')?.note ?? '不可用' },
    { key: 'BANK', available: !!m('MANUAL')?.available, why: m('MANUAL')?.available ? null : '沒有可退的實付金額' },
    { key: 'LINEPAY', available: kind === 'LINEPAY' && !!original?.available, why: kind !== 'LINEPAY' ? '此訂單不是 LINE Pay 付款' : original?.available ? null : original?.note ?? '原付款方式無法處理' },
  ]
  const lastOriginalFail = [...detail.refunds].reverse().find((r) => r.method === 'ORIGINAL' && r.status === 'FAILED')
  return { kind, choices, originalUsable: kind === 'POINTS' || !!original?.available, originalNote: original?.note ?? null, lastOriginalFail }
}

function destinationOf(choice: RefundChoice, detail: OrderDetail) {
  const { pay } = paymentKind(detail)
  if (choice === 'CARD') return `退回原信用卡${pay?.card ? `（${pay.card}）` : ''}，入帳時間依發卡銀行作業`
  if (choice === 'LINEPAY') return '退回顧客原 LINE Pay 帳戶'
  if (choice === 'POINTS') return '轉為會員點數（1 點＝NT$1），立即入帳'
  return '由人員以銀行轉帳退款；系統先記錄為「待人工處理」，匯款完成後再標記完成'
}

/* ─────────────────────────── 主元件 ─────────────────────────── */

export function OrderDetailPanel({
  orderId,
  perms,
  startWithRefund,
  onBack,
  onChanged,
}: {
  orderId: string
  perms: { refund: boolean; invoice: boolean; access: boolean; accessGrant: boolean }
  startWithRefund: boolean
  onBack: () => void
  onChanged: () => void
}) {
  const { ask } = useAi()
  const { toast } = useToast()
  const [detail, setDetail] = React.useState<OrderDetail | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [invoiceAction, setInvoiceAction] = React.useState<{ type: 'RESEND' | 'VOID'; invoiceId: string } | null>(null)

  const load = React.useCallback(async () => {
    const res = await orderDetailAction(orderId)
    if (!res.ok) return setError(res.error)
    if (!res.data) return setError('找不到這筆訂單')
    setError(null)
    setDetail(res.data)
  }, [orderId])
  React.useEffect(() => {
    setDetail(null)
    void load()
  }, [load])
  React.useEffect(() => {
    if (startWithRefund && detail) document.getElementById('order-refund')?.scrollIntoView({ block: 'start' })
  }, [startWithRefund, detail])

  useAiSelection(detail ? { type: 'booking', id: detail.id, label: `訂單 ${detail.code}` } : null)

  const refreshAll = async () => {
    await load()
    onChanged()
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-start gap-2 pb-3">
        <button type="button" onClick={onBack} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#e3e8dc] bg-white lg:hidden" aria-label="返回訂單列表">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-mono text-xl font-bold text-[#1f2a22]">{detail?.code ?? '讀取中…'}</h2>
          <p className="text-sm text-muted">訂單明細</p>
        </div>
        {detail && (
          <button type="button" onClick={() => ask('這筆訂單可以退哪些項目？')} className="flex h-12 items-center gap-1 rounded-lg border border-[#e3e8dc] bg-white px-2.5 text-xs hover:bg-violet-50 lg:h-10">
            <MessageCircleQuestion className="h-4 w-4" aria-hidden />
            問小P
          </button>
        )}
        <span className="hidden lg:block"><CloseButton onClick={onBack} /></span>
      </div>

      {error && <Block tone="danger">{error}</Block>}
      {!detail && !error && (
        <p className="flex items-center gap-2 py-6 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          讀取中…
        </p>
      )}

      {detail && (
        <div className="space-y-3">
          {detail.demo && <Block tone="warn" className="text-xs font-semibold">展示資料：付款、退款、發票操作只會產生模擬結果</Block>}
          <SummarySection detail={detail} canCancel={perms.refund} onDone={refreshAll} />
          <PaymentSection detail={detail} reload={load} />
          <RefundSection key={`${detail.id}-${detail.refunds.length}`} detail={detail} canRefund={perms.refund} onDone={refreshAll} />
          <DoorSection bookingId={detail.id} code={detail.code} canView={perms.access} canCreate={perms.accessGrant} onChanged={load} />
          <InvoiceSection detail={detail} canInvoice={perms.invoice} onAction={setInvoiceAction} />
          <TimelineSection detail={detail} />
        </div>
      )}

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
    </div>
  )
}

/* ─────────────────────────── 訂單摘要 ─────────────────────────── */

const ORDER_STATE: Record<string, [string, 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'violet']> = {
  PENDING: ['待付款', 'amber'],
  PAID: ['已付款', 'green'],
  COMPLETED: ['已完成', 'green'],
  CANCELLED: ['已取消', 'gray'],
  EXPIRED: ['已逾時', 'gray'],
  REFUND_PENDING: ['款項待退', 'red'],
}

export function orderStateOf(status: string, refundStatus: string): [string, 'green' | 'amber' | 'red' | 'gray' | 'blue' | 'violet'] {
  if (refundStatus === 'FULL') return ['已退款', 'violet']
  if (refundStatus === 'PARTIAL') return ['部分退款', 'amber']
  if (refundStatus === 'FAILED') return ['退款失敗', 'red']
  if (refundStatus === 'MANUAL') return ['待人工退款', 'amber']
  return ORDER_STATE[status] ?? [status, 'gray']
}

function SummarySection({ detail, canCancel, onDone }: { detail: OrderDetail; canCancel: boolean; onDone: () => Promise<void> }) {
  const first = detail.courtItems[0]
  const courts = [...new Set(detail.courtItems.map((i) => i.courtName))].join('、')
  const times = detail.courtItems.length ? `${detail.courtItems.map((i) => i.timeLabel).join('、')}` : '—'
  const [label, tone] = orderStateOf(detail.status, detail.refundStatus)
  return (
    <Section icon={FileText} title="訂單摘要">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
        <div><dt className="text-xs text-muted">訂場日期</dt><dd className="mt-0.5 font-semibold">{first ? dayLabel(first.date) : dayLabel(detail.playDate)}</dd></div>
        <div><dt className="text-xs text-muted">訂場時間</dt><dd className="mt-0.5 font-semibold">{times}</dd></div>
        <div><dt className="text-xs text-muted">場地</dt><dd className="mt-0.5 font-semibold">{courts || '—'}</dd></div>
        <div><dt className="text-xs text-muted">訂單金額</dt><dd className="mt-0.5 font-semibold tabular">{amt(detail.amountsHidden, detail.amounts.total)}</dd></div>
        <div><dt className="text-xs text-muted">訂單狀態</dt><dd className="mt-0.5"><Pill tone={tone}>{label}</Pill></dd></div>
      </dl>

      <dl className="mt-4 grid grid-cols-[5.5rem_1fr] gap-y-1 border-t border-[#eef1e9] pt-3">
        <dt className="text-muted">訂購人</dt><dd>{detail.customer.name}</dd>
        <dt className="text-muted">電話</dt><dd>{detail.customer.phone}</dd>
        <dt className="text-muted">LINE 名稱</dt><dd>{detail.customer.lineName}</dd>
        <dt className="text-muted">Email</dt><dd className="break-all">{detail.customer.email ?? '—'}</dd>
        <dt className="text-muted">會員</dt>
        <dd>
          <Link href={`/admin/members/${detail.customer.userId}`} className="inline-flex min-h-12 items-center text-brand-700 hover:underline lg:min-h-0">#{detail.customer.userId.slice(-6)} 查看會員紀錄</Link>
          {!detail.amountsHidden && <span className="ml-2 text-xs text-muted">目前點數 {detail.customer.points}</span>}
        </dd>
        {detail.note && (<><dt className="text-muted">訂單備註</dt><dd className="whitespace-pre-wrap">{detail.note}</dd></>)}
        <dt className="text-muted">建立時間</dt><dd>{dt(detail.createdAt)}</dd>
      </dl>

      {(detail.courtItems.length + detail.activityItems.length > 1 || detail.activityItems.length > 0) && (
        <ul className="mt-3 space-y-1 border-t border-[#eef1e9] pt-3 text-xs">
          {detail.courtItems.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>場地 {i.courtName}・{i.date} {i.timeLabel}<span className="ml-1 text-muted">{i.rateName}</span></span>
              <span className="flex items-center gap-2">{!detail.amountsHidden && money(i.price)}<Pill tone={i.status === 'ACTIVE' ? 'blue' : 'gray'}>{i.status === 'ACTIVE' ? '有效' : '已取消'}</Pill></span>
            </li>
          ))}
          {detail.activityItems.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>活動 {i.title}・{i.date} {i.timeLabel}</span>
              <span className="flex items-center gap-2">{!detail.amountsHidden && `${i.quantity} × ${money(i.unitPrice)}`}<Pill tone={i.status === 'ACTIVE' ? 'blue' : 'gray'}>{{ ACTIVE: '有效', CANCELLED: '已取消', REFUNDED: '場次取消已退' }[i.status] ?? i.status}</Pill></span>
            </li>
          ))}
        </ul>
      )}

      {!detail.amountsHidden && (detail.amounts.discount > 0 || detail.amounts.pointsUsed > 0 || detail.amounts.refundedAmount > 0) && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 border-t border-[#eef1e9] pt-3 text-xs">
          <dt className="text-muted">原價合計</dt><dd className="text-right">{money(detail.amounts.subtotal)}</dd>
          {detail.amounts.discount > 0 && (<><dt className="text-muted">折價券 {detail.amounts.voucherCode}</dt><dd className="text-right">−{money(detail.amounts.discount)}</dd></>)}
          {detail.amounts.pointsUsed > 0 && (<><dt className="text-muted">點數折抵</dt><dd className="text-right">−{detail.amounts.pointsUsed} 點</dd></>)}
          {detail.amounts.refundedAmount > 0 && (<><dt className="text-muted">已退款（實付）</dt><dd className="text-right">{money(detail.amounts.refundedAmount)}</dd></>)}
        </dl>
      )}
      {detail.amountsHidden && <p className="mt-3 text-xs text-muted">金額與金流明細僅擁有者可見。</p>}

      {detail.status === 'PENDING' && canCancel && <CancelPending bookingId={detail.id} onDone={onDone} />}
    </Section>
  )
}

function CancelPending({ bookingId, onDone }: { bookingId: string; onDone: () => Promise<void> }) {
  const { toast } = useToast()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  if (!confirming)
    return (
      <button type="button" onClick={() => setConfirming(true)} className="mt-3 h-12 w-full rounded-xl border border-red-300 px-3 text-sm font-semibold text-red-700 sm:w-auto">
        取消待付款訂單
      </button>
    )
  return (
    <Block tone="danger" className="mt-3 space-y-2">
      <p className="text-sm font-semibold">確定取消這筆待付款訂單？</p>
      <p className="text-xs">時段與名額會立即釋放；已折抵的點數與折價券會歸還。</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-sm">返回</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const res = await adminCancelBooking(bookingId)
            setBusy(false)
            if (!res.ok) return toast(res.error, 'error')
            toast(res.message ?? '已取消', 'success')
            setConfirming(false)
            await onDone()
          }}
          className="h-12 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? '處理中…' : '確認取消訂單'}
        </button>
      </div>
    </Block>
  )
}

/* ─────────────────────────── 付款紀錄 ─────────────────────────── */

function payMethodLabel(p: OrderDetail['payments'][number]) {
  if (p.provider === 'internal') return '點數／折價券全額折抵'
  if (p.provider === 'linepay' || p.method === 'LINE_PAY') return 'LINE Pay'
  return `信用卡${p.card ? ` • ${p.card}` : ''}`
}

function PaymentSection({ detail, reload }: { detail: OrderDetail; reload: () => Promise<void> }) {
  const { toast } = useToast()
  const [query, setQuery] = React.useState<{ busy: boolean; at: string | null; error: string | null }>({ busy: false, at: null, error: null })

  const runQuery = async () => {
    setQuery({ busy: true, at: null, error: null })
    const res = await orderDetailAction(detail.id)
    if (!res.ok || !res.data) {
      const error = res.ok ? '找不到這筆訂單' : res.error
      setQuery({ busy: false, at: new Date().toISOString(), error })
      return toast(`查詢失敗：${error}`, 'error')
    }
    await reload()
    setQuery({ busy: false, at: new Date().toISOString(), error: null })
  }

  const main = [...detail.payments].reverse().find((p) => p.status === 'SUCCESS' || p.status === 'REFUNDED') ?? detail.payments[detail.payments.length - 1]
  return (
    <Section icon={CreditCard} title="付款紀錄">
      {detail.payments.length === 0 ? (
        <Block tone="neutral">尚無付款紀錄</Block>
      ) : (
        <div className="space-y-2">
          {detail.payments.map((p) => {
            const tone = p.status === 'SUCCESS' ? 'ok' : p.status === 'FAILED' ? 'danger' : p.status === 'REFUNDED' ? 'neutral' : 'warn'
            const Icon = p.status === 'SUCCESS' ? CheckCircle2 : p.status === 'FAILED' ? XCircle : Clock3
            const label = { SUCCESS: '付款成功', FAILED: '付款失敗', REFUNDED: '已退款', PENDING: '待付款' }[p.status] ?? p.status
            return (
              <Block key={p.id} tone={tone} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="flex items-center gap-2 font-bold sm:w-28 sm:shrink-0">
                  <Icon className="h-6 w-6 shrink-0" aria-hidden />
                  {label}
                </span>
                <div className="min-w-0 flex-1 text-xs leading-relaxed sm:border-l sm:border-current/20 sm:pl-3">
                  <p className="text-sm font-semibold">{payMethodLabel(p)}{p.simulated && <span className="ml-1 font-normal">（模擬金流）</span>}</p>
                  <p>交易編號 <span className="font-mono">{detail.amountsHidden ? '—' : p.providerRef ?? '—'}</span></p>
                  <p>付款時間 {dt(p.at)}{!detail.amountsHidden && `・${money(p.amount)}`}</p>
                  {p.failReason && <p className="font-semibold">失敗原因：{p.failReason}</p>}
                </div>
                {p.id === main?.id && (
                  <button type="button" disabled={query.busy} onClick={runQuery} className="h-12 w-full shrink-0 rounded-xl border-2 border-[#1f4d34] bg-white px-4 text-sm font-semibold text-[#1f4d34] disabled:opacity-50 sm:w-auto">
                    {query.busy ? '查詢中…' : '查詢交易'}
                  </button>
                )}
              </Block>
            )
          })}
          {query.at && main && (
            <Block tone={query.error ? 'danger' : 'neutral'} className="text-xs">
              <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1">
                <dt className="text-muted">交易是否成功</dt><dd className="font-semibold">{query.error ? '查詢失敗' : main.status === 'SUCCESS' || main.status === 'REFUNDED' ? '成功' : main.status === 'FAILED' ? '失敗' : '尚未完成'}</dd>
                <dt className="text-muted">交易編號</dt><dd className="font-mono">{detail.amountsHidden ? '—' : main.providerRef ?? '—'}</dd>
                <dt className="text-muted">付款時間</dt><dd>{dt(main.at)}</dd>
                <dt className="text-muted">付款方式</dt><dd>{payMethodLabel(main)}</dd>
                <dt className="text-muted">查詢失敗原因</dt><dd>{query.error ?? main.failReason ?? '—'}</dd>
              </dl>
              <p className="mt-2 text-muted">查詢時間 {dt(query.at)}。目前顯示系統內的付款紀錄；金流商即時查詢尚未串接。</p>
            </Block>
          )}
        </div>
      )}
    </Section>
  )
}

/* ─────────────────────────── 退款方式 ─────────────────────────── */

function RefundSection({ detail, canRefund, onDone }: { detail: OrderDetail; canRefund: boolean; onDone: () => Promise<void> }) {
  const opt = detail.refundOptions
  const refundable = opt.items.filter((i) => !i.blocked)
  const info = refundChoices(detail)
  const defaultChoice: RefundChoice = info.originalUsable ? info.kind : (info.choices.find((c) => c.available && c.key === 'POINTS') ?? info.choices.find((c) => c.available))?.key ?? 'POINTS'
  const [choice, setChoice] = React.useState<RefundChoice>(defaultChoice)
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set(refundable.map((i) => i.itemId)))
  const [cancelItems, setCancelItems] = React.useState(false)
  const [reason, setReason] = React.useState<string>('')
  const [reasonNote, setReasonNote] = React.useState('')
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<{ status: string; simulated: boolean; failReason: string | null; duplicate: boolean; cash: number; points: number } | null>(null)
  const keyRef = React.useRef<string | null>(null)

  const items = opt.items.filter((i) => picked.has(i.itemId))
  const cash = items.reduce((s, i) => s + i.refundableCash, 0)
  const points = items.reduce((s, i) => s + i.refundablePoints, 0)
  const isAlternative = choice !== info.kind
  const reasonOk = !!reason && (reason !== '其他' || reasonNote.trim().length > 0) && (!isAlternative || ALT_REASONS.includes(reason))
  const expired = !!info.lastOriginalFail?.failReason && /逾期|期限|超過|expire/i.test(info.lastOriginalFail.failReason)
  const choiceInfo = info.choices.find((c) => c.key === choice)
  const fullReason = `${reason}${reasonNote.trim() ? `：${reasonNote.trim()}` : ''}${isAlternative ? `（替代退費：${CHOICE_LABEL[choice]}）` : ''}`

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    keyRef.current ??= `rf-${crypto.randomUUID()}`
    try {
      const res = await refundAction({ bookingId: detail.id, itemIds: [...picked], method: CHOICE_METHOD[choice], cancelItems, reason: fullReason, idempotencyKey: keyRef.current, expectedCash: cash, expectedPoints: points })
      if (!res.ok) return setError(res.error)
      setResult({ status: res.data.status, simulated: res.data.simulated, failReason: res.data.failReason, duplicate: res.data.duplicate, cash: res.data.cashAmount, points: res.data.pointsAmount })
      setConfirming(false)
      keyRef.current = null
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section icon={RotateCcw} title="退款方式" id="order-refund">
      <div className="space-y-3">
        {opt.simulated && <Block tone="neutral" className="text-xs">模擬金流或展示資料：退款只會產生「模擬結果」，不會退真實款項。</Block>}
        {opt.note && <Block tone="warn" className="text-xs">{opt.note}</Block>}

        {detail.refunds.length > 0 && (
          <ul className="space-y-2">
            {detail.refunds.map((r) => {
              const [label, tone] = REFUND_STATE[r.status] ?? [r.status, 'gray']
              const block = r.status === 'FAILED' ? 'danger' : r.status === 'MANUAL_PENDING' || r.status === 'PROCESSING' ? 'warn' : 'ok'
              return (
                <li key={r.id}>
                  <Block tone={block} className="text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={tone}>{label}</Pill>
                      {r.simulated && <Pill tone="violet">模擬結果</Pill>}
                      <span className="font-semibold">{detail.amountsHidden ? '' : `${money(r.cashAmount)}${r.pointsAmount ? `＋${r.pointsAmount} 點` : ''}・`}{REFUND_METHOD_LABEL[r.method] ?? r.method}</span>
                      <span className="text-muted">{dt(r.createdAt)}・{r.createdBy.replace(/^admin:/, '')}</span>
                    </div>
                    <p className="mt-1">原因：{r.reason}{r.cancelItems ? '・同時取消預約' : ''}</p>
                    {r.failReason && <p className="mt-0.5 font-semibold">失敗原因：{r.failReason}</p>}
                    {r.note && <p className="mt-0.5">{r.note}</p>}
                    {r.status === 'MANUAL_PENDING' && canRefund && <ManualDone refundId={r.id} onDone={onDone} />}
                  </Block>
                </li>
              )
            })}
          </ul>
        )}

        {result && (
          <Block tone={result.status === 'FAILED' ? 'danger' : result.status === 'MANUAL_PENDING' || result.status === 'PROCESSING' ? 'warn' : 'ok'} className="text-sm">
            <p className="font-semibold">{(REFUND_STATE[result.status] ?? [result.status])[0]}：{money(result.cash)}{result.points ? `＋${result.points} 點` : ''}{result.simulated ? '（模擬結果）' : ''}</p>
            {result.duplicate && <p className="text-xs">這筆退款先前已送出，沒有重複處理。</p>}
            {result.status === 'MANUAL_PENDING' && <p className="text-xs">已記錄為待人工處理，完成匯款後請在上方紀錄標記完成。</p>}
            {result.failReason && <p className="text-xs">失敗原因：{result.failReason}。預約未取消，可改選其他退費方式。</p>}
          </Block>
        )}

        {!canRefund ? (
          <p className="text-xs text-muted">目前帳號沒有退款權限。</p>
        ) : refundable.length === 0 ? (
          <p className="text-xs text-muted">{opt.items[0]?.blocked ?? '沒有可退款的項目'}</p>
        ) : (
          <div className={cn('space-y-3 rounded-xl p-3 ring-1', isAlternative || !info.originalUsable ? TONE.warn : 'bg-[#fafcf7] ring-[#e3e8dc]')}>
            <p className="text-xs">原付款方式無法處理時，可選擇其他退費方式</p>
            {(!info.originalUsable || expired) && (
              <div className="flex gap-2 rounded-lg bg-amber-100/70 p-2 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {expired ? '此筆交易已超過原付款方式可處理期限' : `原付款方式無法處理：${info.lastOriginalFail?.failReason ?? info.originalNote ?? ''}`}
                  <br />請選擇其他退費方式
                </span>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold">選擇退費方式</span>
                <select value={choice} onChange={(e) => setChoice(e.target.value as RefundChoice)} disabled={confirming} className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm">
                  {info.choices.map((c) => (
                    <option key={c.key} value={c.key} disabled={!c.available}>
                      {CHOICE_LABEL[c.key]}{c.key === info.kind ? '（預設）' : ''}{c.available ? '' : `－${c.why}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">退款金額</span>
                <output className="mt-1 flex h-12 items-center rounded-xl border border-zinc-300 bg-white px-3 text-sm font-semibold tabular">
                  {money(cash)}{points ? `＋${points} 點` : ''}
                </output>
              </label>
            </div>

            {opt.items.length > 1 && (
              <fieldset className="space-y-1.5" disabled={confirming}>
                <legend className="text-xs font-semibold">退款項目</legend>
                {opt.items.map((i) => (
                  <label key={i.itemId} className={cn('flex min-h-12 items-center gap-2 rounded-lg border bg-white px-2 text-xs', i.blocked ? 'border-zinc-200 text-zinc-400' : picked.has(i.itemId) ? 'border-[#7cb342]' : 'border-zinc-200')}>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={Boolean(i.blocked)}
                      checked={picked.has(i.itemId)}
                      onChange={(e) => {
                        const n = new Set(picked)
                        if (e.target.checked) n.add(i.itemId)
                        else n.delete(i.itemId)
                        setPicked(n)
                      }}
                    />
                    <span className="min-w-0 flex-1">{i.label}<span className="block text-[11px] text-muted">{i.detail}</span></span>
                    <span className="shrink-0 font-semibold">{i.blocked ?? `${money(i.refundableCash)}${i.refundablePoints ? `＋${i.refundablePoints}點` : ''}`}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold">退費原因</span>
                <select value={reason} onChange={(e) => setReason(e.target.value)} disabled={confirming} className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm">
                  <option value="">請選擇</option>
                  {REASONS.map((r) => (
                    <option key={r} value={r} disabled={isAlternative && !ALT_REASONS.includes(r)}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold">補充說明{reason === '其他' ? '（必填）' : '（選填）'}</span>
                <input value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} disabled={confirming} maxLength={200} className="mt-1 h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm" placeholder="例：客人臨時無法到場" />
              </label>
            </div>
            {isAlternative && <p className="text-xs font-semibold text-amber-900">使用替代退費方式時，退費原因須為「交易逾期」「原付款方式無法處理」或「其他」。</p>}

            <label className="flex min-h-12 items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={cancelItems} disabled={confirming} onChange={(e) => setCancelItems(e.target.checked)} />
              <span>同時取消所選項目的預約（場地時段會釋放給其他人；原路退款在金流成功後才取消）</span>
            </label>

            {!confirming ? (
              <button type="button" disabled={picked.size === 0 || !reasonOk || !choiceInfo?.available} onClick={() => { setError(null); setConfirming(true) }} className="h-12 w-full rounded-xl border-2 border-[#1f4d34] bg-white text-sm font-semibold text-[#1f4d34] disabled:opacity-40">
                確認退費
              </button>
            ) : (
              <Block tone="danger" className="space-y-3">
                <p className="text-sm font-bold">請確認退費內容，送出後無法復原</p>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-y-1.5 text-sm">
                  <dt>退款金額</dt><dd className="font-bold">{money(cash)}{points ? `＋${points} 點` : ''}</dd>
                  <dt>退款方式</dt><dd>{CHOICE_LABEL[choice]}{isAlternative && <span className="ml-1 text-xs font-semibold">（替代方式）</span>}</dd>
                  <dt>退款原因</dt><dd>{reason}{reasonNote.trim() ? `：${reasonNote.trim()}` : ''}</dd>
                  <dt>款項去向</dt><dd>{destinationOf(choice, detail)}</dd>
                  <dt>預約</dt><dd className={cancelItems ? 'font-semibold' : ''}>{cancelItems ? '取消所選項目並釋放場地' : '不取消，預約維持有效'}</dd>
                </dl>
                {error && <p className="rounded-lg bg-white/70 px-2 py-1.5 text-xs font-semibold">{error}</p>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="h-12 rounded-xl border border-zinc-300 bg-white px-4 text-sm">返回修改</button>
                  <button type="button" disabled={busy} onClick={submit} className="h-12 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? '處理中，請勿關閉…' : `確認退費 ${money(cash)}`}
                  </button>
                </div>
              </Block>
            )}
            {!confirming && error && <p className="text-xs font-semibold text-red-700">{error}</p>}
          </div>
        )}
      </div>
    </Section>
  )
}

function ManualDone({ refundId, onDone }: { refundId: string; onDone: () => Promise<void> }) {
  const { toast } = useToast()
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="處理說明，例如匯款日期與帳號末五碼" className="h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 text-xs" aria-label="人工退款處理說明" />
      <button
        type="button"
        disabled={busy || !note.trim()}
        onClick={async () => {
          setBusy(true)
          const res = await manualRefundDoneAction(refundId, note)
          setBusy(false)
          if (!res.ok) return toast(res.error, 'error')
          toast('已標記人工退款完成', 'success')
          await onDone()
        }}
        className="h-12 rounded-lg bg-[#1f4d34] px-3 text-xs font-semibold text-white disabled:opacity-40"
      >
        {busy ? '處理中…' : '標記人工退款完成'}
      </button>
    </div>
  )
}

/* ─────────────────────────── 門禁授權 ─────────────────────────── */

function DoorSection({ bookingId, code, canView, canCreate, onChanged }: { bookingId: string; code: string; canView: boolean; canCreate: boolean; onChanged: () => Promise<void> }) {
  const { toast } = useToast()
  const [state, setState] = React.useState<{ loading: boolean; grant: BookingGrantView | null; error: string | null }>({ loading: canView, grant: null, error: null })
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!canView) return
    let alive = true
    setState({ loading: true, grant: null, error: null })
    bookingGrantAction(bookingId).then((res) => {
      if (!alive) return
      setState(res.ok ? { loading: false, grant: res.data, error: null } : { loading: false, grant: null, error: res.error })
    })
    return () => {
      alive = false
    }
  }, [bookingId, canView])

  const create = async () => {
    if (busy) return
    setBusy(true)
    const res = await createBookingGrantAction(bookingId)
    setBusy(false)
    if (!res.ok) return toast(res.error, 'error')
    setState({ loading: false, grant: res.data.grant, error: null })
    if (res.data.grant && res.data.grant.phase !== 'REVOKED') toast('已建立門禁授權', 'success')
    else toast('無法建立：訂單需已付款、有有效時段，且會員未列入黑名單', 'error')
    await onChanged()
  }

  const g = state.grant
  const live = g && (g.phase === 'ACTIVE' || g.phase === 'UPCOMING')
  return (
    <Section icon={LockKeyhole} title="門禁授權">
      {!canView ? (
        <p className="text-xs text-muted">目前帳號沒有門禁檢視權限。</p>
      ) : state.loading ? (
        <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />讀取中…</p>
      ) : state.error ? (
        <Block tone="danger" className="text-xs">{state.error}</Block>
      ) : (
        <Block tone={live ? 'ok' : g?.phase === 'REVOKED' ? 'danger' : g ? 'neutral' : 'warn'} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex items-center gap-2 font-bold sm:w-44 sm:shrink-0">
            {live ? <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden /> : g ? <XCircle className="h-6 w-6 shrink-0" aria-hidden /> : <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden />}
            {g ? (live ? '本訂單已建立授權' : `授權${g.phaseLabel}`) : '尚未建立授權'}
          </span>
          {g ? (
            <dl className="grid min-w-0 flex-1 grid-cols-[4.5rem_1fr] gap-y-0.5 text-xs sm:border-l sm:border-current/20 sm:pl-3">
              <dt>有效時間</dt><dd>{dt(g.validFrom)} – {new Date(g.validUntil).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, hour: '2-digit', minute: '2-digit' })}</dd>
              <dt>授權對象</dt><dd>{g.holderName}{g.holderPhone ? `・${g.holderPhone}` : ''}</dd>
              <dt>授權狀態</dt><dd className="font-semibold">{g.phaseLabel}{g.revokeReason ? `（${g.revokeReason}）` : ''}</dd>
              <dt>訂單</dt><dd className="font-mono">{code}</dd>
            </dl>
          ) : (
            <p className="min-w-0 flex-1 text-xs">付款成功後系統會自動建立；若未建立，可在此補建。</p>
          )}
          {g ? (
            <Link href="/admin/access" className="flex h-12 w-full shrink-0 items-center justify-center rounded-xl border-2 border-[#1f4d34] bg-white px-4 text-sm font-semibold text-[#1f4d34] sm:w-auto">查看門禁授權</Link>
          ) : canCreate ? (
            <button type="button" disabled={busy} onClick={create} className="h-12 w-full shrink-0 rounded-xl bg-[#1f4d34] px-4 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
              {busy ? '建立中…' : '建立門禁授權'}
            </button>
          ) : null}
        </Block>
      )}
    </Section>
  )
}

/* ─────────────────────────── 發票（保留既有功能） ─────────────────────────── */

function InvoiceSection({ detail, canInvoice, onAction }: { detail: OrderDetail; canInvoice: boolean; onAction: (a: { type: 'RESEND' | 'VOID'; invoiceId: string }) => void }) {
  return (
    <Section icon={ReceiptText} title="發票" defaultOpen={false}>
      <p className="text-xs text-muted">發票服務：{detail.invoiceIntegration.label}{detail.invoiceIntegration.reason ? `（${detail.invoiceIntegration.reason}）` : ''}。退款完成不代表發票已同步處理。</p>
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
              {canInvoice && inv.providerStatus !== 'VOIDED' && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button type="button" disabled={!detail.invoiceIntegration.connected} onClick={() => onAction({ type: 'RESEND', invoiceId: inv.id })} className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs disabled:opacity-40" title={detail.invoiceIntegration.reason ?? undefined}>補寄發票通知</button>
                  <button type="button" disabled={!detail.invoiceIntegration.connected} onClick={() => onAction({ type: 'VOID', invoiceId: inv.id })} className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-xs disabled:opacity-40" title={detail.invoiceIntegration.reason ?? undefined}>申請作廢重開</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

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
                <p className="text-xs text-muted">作廢原發票並開立新發票，兩者會保存關聯。是否適用作廢重開，依發票服務商規則與訂單狀態判斷。</p>
              </>
            )}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="h-12 rounded-xl border border-zinc-300 px-4">取消</button>
            <button type="button" disabled={busy || (!resend && !reason.trim()) || (resend && !inv.recipientEmail)} onClick={submit} className="h-12 flex-1 rounded-xl bg-brand-600 font-semibold text-white disabled:opacity-40">
              {busy ? '處理中…' : resend ? '確認補寄' : '確認作廢重開'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ─────────────────────────── 操作時間軸 ─────────────────────────── */

type Outcome = '成功' | '失敗' | '待處理' | '完成'
const OUTCOME_TONE: Record<Outcome, 'green' | 'red' | 'amber'> = { 成功: 'green', 完成: 'green', 失敗: 'red', 待處理: 'amber' }
const AUDIT_NAME: Record<string, [string, Outcome]> = {
  DOOR_GRANT_AUTO_CREATE: ['建立門禁授權', '成功'],
  DOOR_GRANT_AUTO_UPDATE: ['更新門禁授權', '成功'],
  DOOR_GRANT_AUTO_REVOKE: ['撤銷門禁授權', '完成'],
  DOOR_GRANT_SYNC_FROM_ORDER: ['補建門禁授權', '完成'],
}

function describe(t: OrderDetail['timeline'][number]): { name: string; outcome: Outcome; actor: string } {
  const actor = !t.actor ? '系統' : t.actor === 'system' ? '系統' : t.actor.replace(/^admin:/, '')
  const l = t.label
  if (l === '建立訂單') return { name: '訂單建立', outcome: '完成', actor: t.actor ? actor : '顧客' }
  if (l === '訂單取消') return { name: '訂單取消', outcome: '完成', actor }
  if (l.startsWith('付款成功')) return { name: '付款成功', outcome: '成功', actor: t.actor ? actor : '金流' }
  if (l.startsWith('付款失敗')) return { name: '付款失敗', outcome: '失敗', actor: t.actor ? actor : '金流' }
  if (l.startsWith('退款')) {
    const amount = l.split('：')[1] ?? ''
    if (/失敗/.test(l)) return { name: `退款失敗 ${amount}`, outcome: '失敗', actor }
    if (/處理中|待人工/.test(l)) return { name: `退款申請 ${amount}`, outcome: '待處理', actor }
    return { name: `退款完成 ${amount}`, outcome: '成功', actor }
  }
  const audit = AUDIT_NAME[l]
  if (audit) return { name: audit[0], outcome: audit[1], actor }
  return { name: l, outcome: /失敗|FAILED/i.test(l) ? '失敗' : '完成', actor }
}

function TimelineSection({ detail }: { detail: OrderDetail }) {
  return (
    <Section icon={History} title="操作時間軸" defaultOpen={false}>
      {detail.timeline.length === 0 ? <p className="text-muted">尚無紀錄</p> : (
        <ol className="space-y-0">
          {detail.timeline.map((t, i) => {
            const d = describe(t)
            return (
              <li key={i} className="relative flex gap-3 pb-3 pl-1 last:pb-0">
                <span className="relative flex w-3 shrink-0 justify-center">
                  <span className={cn('z-10 mt-1 h-3 w-3 rounded-full border-2 bg-white', d.outcome === '失敗' ? 'border-red-500' : d.outcome === '待處理' ? 'border-amber-500' : 'border-[#2f7d3b]')} />
                  {i < detail.timeline.length - 1 && <span className="absolute top-4 h-full w-0.5 bg-[#cfe3c0]" aria-hidden />}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span className="font-semibold">{d.name}</span>
                  <Pill tone={OUTCOME_TONE[d.outcome]}>{d.outcome}</Pill>
                  <span className="text-xs text-muted">{d.actor}</span>
                  <span className="w-full text-xs text-muted sm:ml-auto sm:w-auto">{dt(t.at)}</span>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Section>
  )
}
