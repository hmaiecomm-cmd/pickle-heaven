'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { useAiFilters } from '@/components/admin/ai-context'
import type { OrderListResult } from '@/server/admin-orders'
import { searchOrdersAction } from '@/server/admin-ops-actions'
import { OrderDrawer } from './order-drawer'

export const PAYMENT = { PENDING: ['待付款', 'amber'], PAID: ['已付款', 'green'], FAILED: ['付款失敗', 'red'], UNPAID: ['未付款', 'gray'] } as const
export const ORDER = { ACTIVE: ['有效', 'blue'], CANCELLED: ['已取消', 'gray'], EXPIRED: ['已過期', 'gray'], COMPLETED: ['已完成', 'green'], REFUND_PENDING: ['款項待退', 'red'] } as const
export const REFUND = { NONE: ['無退款', 'gray'], PROCESSING: ['處理中', 'blue'], PARTIAL: ['部分退款', 'amber'], FULL: ['全額退款', 'violet'], FAILED: ['退款失敗', 'red'], MANUAL: ['待人工退款', 'amber'] } as const
export const INVOICE = {
  NONE: ['未開立', 'gray'],
  INTERNAL: ['內部紀錄', 'gray'],
  ISSUING: ['開立中', 'blue'],
  ISSUED: ['已開立', 'green'],
  MODIFYING: ['異動中', 'blue'],
  MODIFY_FAILED: ['異動失敗', 'red'],
  VOIDED: ['已作廢', 'gray'],
} as const

export function StatusPill({ map, value }: { map: Record<string, readonly [string, string]>; value: string }) {
  const [label, tone] = map[value] ?? [value, 'gray']
  return <Pill tone={tone as 'gray'}>{label}</Pill>
}

type Query = OrderListResult['query']

const sel = 'h-10 rounded-lg border border-zinc-300 bg-white px-2 text-sm'

export function TransactionsClient({
  initial,
  courts,
  openOrderId,
  openRefund,
  perms,
}: {
  initial: OrderListResult
  courts: { id: string; name: string }[]
  openOrderId: string | null
  openRefund: boolean
  perms: { refund: boolean; invoice: boolean }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [tab, setTab] = React.useState<'orders' | 'products'>('orders')
  const [data, setData] = React.useState(initial)
  const [draft, setDraft] = React.useState<Query>(initial.query)
  const [loading, setLoading] = React.useState(false)
  const [orderId, setOrderId] = React.useState<string | null>(openOrderId)

  const filterSummary = [
    data.query.q && `關鍵字「${data.query.q}」`,
    (data.query.from || data.query.to) && `${{ created: '下單', play: '預約', paid: '付款' }[data.query.dateType]}日期 ${data.query.from || '…'}～${data.query.to || '…'}`,
    data.query.payment && `付款：${PAYMENT[data.query.payment][0]}`,
    data.query.order && `訂單：${ORDER[data.query.order][0]}`,
    data.query.refund && `退款：${REFUND[data.query.refund][0]}`,
  ]
    .filter(Boolean)
    .join('、')
  useAiFilters(filterSummary || null)

  const run = async (q: Query) => {
    setLoading(true)
    try {
      const res = await searchOrdersAction(q)
      if (!res.ok) return toast(res.error, 'error')
      setData(res.data)
      // 篩選條件保留在網址，重新整理或分享連結都能回到同一個結果
      const params = new URLSearchParams()
      const entries: [string, string | number][] = [
        ['q', q.q], ['dateType', q.dateType], ['from', q.from], ['to', q.to], ['courtId', q.courtId], ['type', q.type],
        ['payment', q.payment], ['order_status', q.order], ['refund_status', q.refund], ['invoice', q.invoice], ['sort', q.sort], ['page', q.page],
      ]
      for (const [k, v] of entries) if (v && !(k === 'dateType' && v === 'play') && !(k === 'type' && v === 'all') && !(k === 'sort' && v === 'created_desc') && !(k === 'page' && v === 1)) params.set(k, String(v))
      if (orderId) params.set('order', orderId)
      router.replace(`/admin/bookings${params.size ? `?${params}` : ''}`, { scroll: false })
    } finally {
      setLoading(false)
    }
  }

  const search = (e?: React.FormEvent) => {
    e?.preventDefault()
    void run({ ...draft, page: 1 })
  }
  const clear = () => {
    const empty: Query = { ...initial.query, q: '', from: '', to: '', courtId: '', type: 'all', payment: '', order: '', refund: '', invoice: '', dateType: 'play', sort: 'created_desc', page: 1 }
    setDraft(empty)
    void run(empty)
  }
  const sortBy = (key: 'created' | 'play' | 'total') => {
    const next = data.query.sort === `${key}_desc` ? `${key}_asc` : `${key}_desc`
    const q = { ...data.query, sort: next as Query['sort'], page: 1 }
    setDraft(q)
    void run(q)
  }
  const sortMark = (key: string) => (data.query.sort === `${key}_desc` ? ' ↓' : data.query.sort === `${key}_asc` ? ' ↑' : '')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'orders'} onClick={() => setTab('orders')} className={cn('h-9 flex-1 rounded-lg font-medium', tab === 'orders' && 'bg-white shadow-sm')}>
          訂場／活動訂單
        </button>
        <button type="button" role="tab" aria-selected={tab === 'products'} onClick={() => setTab('products')} className={cn('h-9 flex-1 rounded-lg font-medium', tab === 'products' && 'bg-white shadow-sm')}>
          商品訂單
        </button>
      </div>

      {tab === 'products' ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
          商品訂單尚未開放：系統目前沒有商城與商品資料（商品、庫存、出貨）。開放前不會顯示任何商品訂單。
        </div>
      ) : (
        <>
          <form onSubmit={search} className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[14rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
                <input
                  value={draft.q}
                  onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                  placeholder="姓名、Email、電話或訂單編號（Enter 搜尋）"
                  className="h-10 w-full rounded-lg border border-zinc-300 pl-9 pr-3 text-sm"
                  aria-label="搜尋姓名、Email、電話或訂單編號"
                />
              </div>
              <button type="submit" className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white" disabled={loading}>
                搜尋
              </button>
              <button type="button" onClick={clear} className="h-10 rounded-lg border border-zinc-300 px-3 text-sm">
                清除條件
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={sel} value={draft.dateType} onChange={(e) => setDraft({ ...draft, dateType: e.target.value as Query['dateType'] })} aria-label="日期類型">
                <option value="play">預約／活動日期</option>
                <option value="created">下單日期</option>
                <option value="paid">付款日期</option>
              </select>
              <input type="date" className={sel} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} aria-label="起日" />
              <span className="text-xs text-muted">～</span>
              <input type="date" className={sel} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} aria-label="迄日" />
              <select className={sel} value={draft.courtId} onChange={(e) => setDraft({ ...draft, courtId: e.target.value })} aria-label="場地">
                <option value="">全部場地</option>
                {courts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select className={sel} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Query['type'] })} aria-label="訂單類型">
                <option value="all">全部類型</option>
                <option value="court">場地租借</option>
                <option value="activity">活動報名</option>
                <option value="mixed">場地＋活動</option>
              </select>
              <select className={sel} value={draft.payment} onChange={(e) => setDraft({ ...draft, payment: e.target.value as Query['payment'] })} aria-label="付款狀態">
                <option value="">付款：全部</option>
                {Object.entries(PAYMENT).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select className={sel} value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value as Query['order'] })} aria-label="訂單狀態">
                <option value="">訂單：全部</option>
                {Object.entries(ORDER).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select className={sel} value={draft.refund} onChange={(e) => setDraft({ ...draft, refund: e.target.value as Query['refund'] })} aria-label="退款狀態">
                <option value="">退款：全部</option>
                {Object.entries(REFUND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select className={sel} value={draft.invoice} onChange={(e) => setDraft({ ...draft, invoice: e.target.value as Query['invoice'] })} aria-label="發票">
                <option value="">發票：全部</option>
                <option value="NONE">未開立</option>
                <option value="HAS">已有發票紀錄</option>
              </select>
            </div>
          </form>

          <div className="flex items-center justify-between text-sm">
            <p>
              共 <strong>{data.total}</strong> 筆{filterSummary && <span className="text-muted">（{filterSummary}）</span>}
            </p>
            <p className="text-[11px] text-muted">查詢時間 {new Date(data.queriedAt).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}</p>
          </div>

          <div className={cn('overflow-x-auto rounded-2xl border border-zinc-200 bg-white transition-opacity', loading && 'opacity-60')}>
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">訂單編號</th>
                  <th className="px-3 py-2 font-medium">客戶</th>
                  <th className="px-3 py-2 font-medium">項目</th>
                  <th className="px-3 py-2 font-medium"><button type="button" onClick={() => sortBy('play')} className="font-medium hover:text-zinc-900">預約日期{sortMark('play')}</button></th>
                  <th className="px-3 py-2 font-medium">付款</th>
                  <th className="px-3 py-2 font-medium">訂單</th>
                  <th className="px-3 py-2 font-medium">退款</th>
                  <th className="px-3 py-2 text-right font-medium"><button type="button" onClick={() => sortBy('total')} className="font-medium hover:text-zinc-900">實付{sortMark('total')}</button></th>
                  <th className="px-3 py-2 font-medium">發票</th>
                  <th className="px-3 py-2 font-medium"><button type="button" onClick={() => sortBy('created')} className="font-medium hover:text-zinc-900">下單日期{sortMark('created')}</button></th>
                  <th className="px-3 py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-muted">沒有符合條件的訂單</td>
                  </tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.id} className={cn(orderId === r.id && 'bg-violet-50')}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{r.customer.name}</span>
                      <span className="block text-[11px] text-muted">
                        {r.customer.phone}
                        {r.customer.email && `・${r.customer.email}`}・會員 #{r.customer.memberRef}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-3 py-2 text-xs">{r.summary}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.playDate}</td>
                    <td className="px-3 py-2"><StatusPill map={PAYMENT} value={r.paymentStatus} />{r.simulatedPayment && <span className="ml-1 text-[10px] text-violet-700">模擬</span>}</td>
                    <td className="px-3 py-2"><StatusPill map={ORDER} value={r.orderStatus} /></td>
                    <td className="px-3 py-2"><StatusPill map={REFUND} value={r.refundStatus} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular">
                      NT${r.total.toLocaleString()}
                      {r.refundedAmount > 0 && <span className="block text-[11px] text-muted">已退 NT${r.refundedAmount.toLocaleString()}</span>}
                    </td>
                    <td className="px-3 py-2"><StatusPill map={INVOICE} value={r.invoiceStatus} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{new Date(r.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setOrderId(r.id)} className="h-8 rounded-lg border border-zinc-300 px-3 text-xs font-semibold hover:bg-violet-50">
                        明細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 text-sm">
            <span className="text-muted">第 {data.query.page}／{data.pages} 頁</span>
            <button type="button" disabled={data.query.page <= 1 || loading} onClick={() => run({ ...data.query, page: data.query.page - 1 })} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-300 disabled:opacity-40" aria-label="上一頁">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" disabled={data.query.page >= data.pages || loading} onClick={() => run({ ...data.query, page: data.query.page + 1 })} className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-300 disabled:opacity-40" aria-label="下一頁">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </>
      )}

      {orderId && (
        <OrderDrawer
          key={orderId}
          orderId={orderId}
          perms={perms}
          startWithRefund={openRefund && orderId === openOrderId}
          onClose={() => {
            setOrderId(null)
            const url = new URL(window.location.href)
            url.searchParams.delete('order')
            url.searchParams.delete('refund')
            window.history.replaceState(null, '', url.toString())
          }}
          onChanged={() => void run(data.query)}
        />
      )}
    </div>
  )
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-zinc-100" aria-label="關閉">
      <X className="h-5 w-5" aria-hidden />
    </button>
  )
}
