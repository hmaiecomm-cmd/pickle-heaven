'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { useAiFilters } from '@/components/admin/ai-context'
import type { OrderListResult } from '@/server/admin-orders'
import { searchOrdersAction } from '@/server/admin-ops-actions'
import { OrderDetailPanel, orderStateOf } from './order-detail-panel'
import type { PointsLedger, Voucher, User } from '@prisma/client'

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

export const POINTS_KIND = {
  ADMIN_ADD: '後台加點',
  ADMIN_DEDUCT: '後台扣點',
  REDEEM: '結帳折抵',
  REFUND: '退款回補',
  RELEASE: '訂單取消歸還',
} as const

export const VOUCHER_STATUS = {
  ACTIVE: '有效',
  USED: '已使用',
  EXPIRED: '已過期',
  REVOKED: '已撤銷',
} as const

export function StatusPill({ map, value }: { map: Record<string, readonly [string, string]>; value: string }) {
  const [label, tone] = map[value] ?? [value, 'gray']
  return <Pill tone={tone as 'gray'}>{label}</Pill>
}

type Query = OrderListResult['query']
type PointsLedgerWithUser = PointsLedger & { user: User | null }
type VoucherWithUser = Voucher & { user: User | null }

const sel = 'h-10 rounded-lg border border-zinc-300 bg-white px-2 text-sm'

export function TransactionsClient({
  initial,
  courts,
  pointsLedger = [],
  vouchers = [],
  openOrderId,
  openRefund,
  openTab,
  perms,
}: {
  initial: OrderListResult
  courts: { id: string; name: string }[]
  pointsLedger?: PointsLedgerWithUser[]
  vouchers?: VoucherWithUser[]
  openOrderId: string | null
  openRefund: boolean
  openTab?: 'venue' | 'activity' | 'products' | 'points'
  perms: { refund: boolean; invoice: boolean; access?: boolean; accessGrant?: boolean }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [tab, setTab] = React.useState<'venue' | 'activity' | 'products' | 'points'>(openTab || 'venue')
  const [data, setData] = React.useState(initial)
  const [draft, setDraft] = React.useState<Query>(initial.query)
  const [loading, setLoading] = React.useState(false)
  const [orderId, setOrderId] = React.useState<string | null>(openOrderId)
  const [expandAdvanced, setExpandAdvanced] = React.useState(false)
  const [pointsSearch, setPointsSearch] = React.useState('')
  const [vouchersSearch, setVouchersSearch] = React.useState('')

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
      const params = new URLSearchParams()
      const entries: [string, string | number][] = [
        ['q', q.q], ['dateType', q.dateType], ['from', q.from], ['to', q.to], ['courtId', q.courtId], ['type', q.type],
        ['payment', q.payment], ['order_status', q.order], ['refund_status', q.refund], ['invoice', q.invoice], ['sort', q.sort], ['page', q.page],
      ]
      for (const [k, v] of entries) if (v && !(k === 'dateType' && v === 'play') && !(k === 'type' && v === 'all') && !(k === 'sort' && v === 'created_desc') && !(k === 'page' && v === 1)) params.set(k, String(v))
      if (orderId) params.set('order', orderId)
      params.set('tab', tab)
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
  // 選取訂單只改網址參數，不重新向伺服器取列表；重新整理後仍停在同一筆
  const selectOrder = (id: string | null) => {
    setOrderId(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('order', id)
    else url.searchParams.delete('order')
    url.searchParams.delete('refund')
    window.history.replaceState(null, '', url.toString())
  }
  // 桌機與平板橫式左右並排：沒有指定訂單時預設選第一筆；手機維持先看列表
  React.useEffect(() => {
    if (tab === 'venue' && !openOrderId && initial.rows[0] && window.matchMedia('(min-width: 1024px)').matches) setOrderId(initial.rows[0].id)
  }, [tab, openOrderId, initial.rows])

  const filteredLedger = pointsLedger.filter(p => {
    const search_text = pointsSearch.toLowerCase()
    if (!search_text) return true
    return (
      p.user?.displayName.toLowerCase().includes(search_text) ||
      p.user?.email?.toLowerCase().includes(search_text) ||
      p.reason.toLowerCase().includes(search_text)
    )
  })

  const filteredVouchers = vouchers.filter(v => {
    const search_text = vouchersSearch.toLowerCase()
    if (!search_text) return true
    return (
      v.user?.displayName.toLowerCase().includes(search_text) ||
      v.user?.email?.toLowerCase().includes(search_text) ||
      v.title.toLowerCase().includes(search_text) ||
      v.code.toLowerCase().includes(search_text)
    )
  })

  const getVoucherStatus = (v: Voucher) => {
    if (v.revokedAt) return 'REVOKED'
    if (v.usedAt) return 'USED'
    if (v.expiresAt && v.expiresAt < new Date()) return 'EXPIRED'
    return 'ACTIVE'
  }

  return (
    <div className="space-y-4">
      {tab === 'venue' && (
        <div className="lg:grid lg:grid-cols-[minmax(0,41fr)_minmax(0,59fr)] lg:items-start lg:gap-4">
          <div className={cn('space-y-3', orderId && 'hidden lg:block')}>
            <form onSubmit={search} className="space-y-2">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
                  <input
                    value={draft.q}
                    onChange={(e) => setDraft({ ...draft, q: e.target.value })}
                    placeholder="輸入姓名、Email、電話或訂單編號"
                    className="h-12 w-full rounded-xl border border-[#d7dfcf] bg-white pl-9 pr-3 text-sm"
                    aria-label="搜尋姓名、Email、電話或訂單編號"
                  />
                </div>
                <button type="submit" disabled={loading} className="h-12 shrink-0 rounded-xl bg-[#1f4d34] px-4 text-sm font-semibold text-white disabled:opacity-40">
                  搜尋
                </button>
                <button
                  type="button"
                  onClick={() => setExpandAdvanced(!expandAdvanced)}
                  aria-expanded={expandAdvanced}
                  className={cn('flex h-12 shrink-0 items-center gap-1.5 rounded-xl border bg-white px-3 text-sm', expandAdvanced ? 'border-[#7cb342] text-[#1f4d34]' : 'border-[#d7dfcf]')}
                >
                  <Filter className="h-4 w-4" aria-hidden />
                  篩選
                  <ChevronDown className={cn('h-4 w-4 transition-transform', expandAdvanced && 'rotate-180')} aria-hidden />
                </button>
              </div>

              {expandAdvanced && (
                <div className="space-y-2 rounded-2xl border border-[#e3e8dc] bg-white p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">日期類型</span>
                      <select className={cn(sel, 'w-full')} value={draft.dateType} onChange={(e) => setDraft({ ...draft, dateType: e.target.value as Query['dateType'] })}>
                        <option value="play">預約日期</option>
                        <option value="created">下單日期</option>
                        <option value="paid">付款日期</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">場地</span>
                      <select className={cn(sel, 'w-full')} value={draft.courtId} onChange={(e) => setDraft({ ...draft, courtId: e.target.value })}>
                        <option value="">全部場地</option>
                        {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">起始日期</span>
                      <input type="date" className={cn(sel, 'w-full')} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">結束日期</span>
                      <input type="date" className={cn(sel, 'w-full')} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">付款狀態</span>
                      <select className={cn(sel, 'w-full')} value={draft.payment} onChange={(e) => setDraft({ ...draft, payment: e.target.value as Query['payment'] })}>
                        <option value="">全部狀態</option>
                        {Object.entries(PAYMENT).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">訂單狀態</span>
                      <select className={cn(sel, 'w-full')} value={draft.order} onChange={(e) => setDraft({ ...draft, order: e.target.value as Query['order'] })}>
                        <option value="">全部狀態</option>
                        {Object.entries(ORDER).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">退款狀態</span>
                      <select className={cn(sel, 'w-full')} value={draft.refund} onChange={(e) => setDraft({ ...draft, refund: e.target.value as Query['refund'] })}>
                        <option value="">全部狀態</option>
                        {Object.entries(REFUND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">發票狀態</span>
                      <select className={cn(sel, 'w-full')} value={draft.invoice} onChange={(e) => setDraft({ ...draft, invoice: e.target.value as Query['invoice'] })}>
                        <option value="">全部狀態</option>
                        <option value="NONE">未開立</option>
                        <option value="HAS">已有發票紀錄</option>
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-xs font-medium text-muted">排序</span>
                      <select className={cn(sel, 'w-full')} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value as Query['sort'] })}>
                        <option value="created_desc">下單日期（新到舊）</option>
                        <option value="created_asc">下單日期（舊到新）</option>
                        <option value="play_desc">預約日期（新到舊）</option>
                        <option value="play_asc">預約日期（舊到新）</option>
                        <option value="total_desc">金額（高到低）</option>
                        <option value="total_asc">金額（低到高）</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={loading} className="h-11 flex-1 rounded-xl bg-[#1f4d34] text-sm font-semibold text-white disabled:opacity-40">套用篩選</button>
                    <button type="button" onClick={clear} className="h-11 rounded-xl border border-zinc-300 px-4 text-sm">清除條件</button>
                  </div>
                </div>
              )}
            </form>

            <div className={cn('overflow-hidden rounded-2xl border border-[#e3e8dc] bg-white transition-opacity', loading && 'opacity-60')}>
              <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1.25fr)_auto_auto] gap-3 border-b border-[#eef1e9] bg-[#fafcf7] px-3 py-2.5 text-xs font-semibold text-[#3d4a40] sm:grid">
                <span>訂單編號</span>
                <span>訂場資訊</span>
                <span className="text-right">訂單金額</span>
                <span className="w-[4.5rem] text-center">訂單狀態</span>
              </div>
              {data.rows.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-muted">沒有符合條件的訂單</p>
              ) : (
                <ul className="divide-y divide-[#eef1e9]">
                  {data.rows.map((r) => {
                    const [stateLabel, stateTone] = orderStateOf(r.orderStatus === 'COMPLETED' ? 'COMPLETED' : r.paymentStatus === 'PAID' && r.orderStatus === 'ACTIVE' ? 'PAID' : r.orderStatus === 'ACTIVE' ? 'PENDING' : r.orderStatus, r.refundStatus)
                    const selected = orderId === r.id
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => selectOrder(r.id)}
                          aria-current={selected ? 'true' : undefined}
                          className={cn(
                            'grid min-h-[4.5rem] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-2 px-3 py-2.5 text-left transition-colors sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1.25fr)_auto_auto]',
                            selected ? 'border-[#7cb342] bg-[#eef7e6]' : 'border-transparent hover:bg-[#fafcf7]',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[13px] font-bold text-[#1f2a22]">{r.code}</span>
                            <span className="block truncate text-xs text-muted">{r.customer.name}</span>
                          </span>
                          <span className="col-span-2 row-start-2 min-w-0 text-xs sm:col-span-1 sm:row-start-auto">
                            <span className="block truncate text-[#1f2a22]">{r.playDate.replaceAll('-', '/')}（{'日一二三四五六'[new Date(`${r.playDate}T00:00:00Z`).getUTCDay()]}）</span>
                            <span className="block truncate text-muted">{[r.slotLabel, r.courtNames ? `場地 ${r.courtNames}` : r.summary].filter(Boolean).join('・')}</span>
                          </span>
                          <span className="row-start-1 text-right text-sm font-bold tabular text-[#1f2a22] sm:row-start-auto">{data.amountsHidden ? '—' : `NT$${r.total.toLocaleString()}`}</span>
                          <span className="col-start-2 row-start-2 flex justify-end sm:col-start-auto sm:row-start-auto sm:w-[4.5rem] sm:justify-center">
                            <Pill tone={stateTone}>{stateLabel}</Pill>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 text-sm">
              <span className="text-muted">第 {data.query.page}／{data.pages} 頁・共 {data.total} 筆</span>
              <button type="button" disabled={data.query.page <= 1 || loading} onClick={() => run({ ...data.query, page: data.query.page - 1 })} className="grid h-11 w-11 place-items-center rounded-xl border border-[#d7dfcf] bg-white disabled:opacity-40" aria-label="上一頁">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={data.query.page >= data.pages || loading} onClick={() => run({ ...data.query, page: data.query.page + 1 })} className="grid h-11 w-11 place-items-center rounded-xl border border-[#d7dfcf] bg-white disabled:opacity-40" aria-label="下一頁">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          <div className={cn('lg:sticky lg:top-0 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl lg:bg-[#f6f7f2] lg:pr-1', !orderId && 'hidden lg:block')}>
            {orderId ? (
              <OrderDetailPanel
                key={orderId}
                orderId={orderId}
                perms={{ ...perms, access: !!perms.access, accessGrant: !!perms.accessGrant }}
                startWithRefund={openRefund && orderId === openOrderId}
                onBack={() => selectOrder(null)}
                onChanged={() => void run(data.query)}
              />
            ) : (
              <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#d7dfcf] bg-white p-8 text-center text-sm text-muted">
                點選左側訂單以查看明細
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
          商品訂單尚未開放：系統目前沒有商城與商品資料（商品、庫存、出貨）。開放前不會顯示任何商品訂單。
        </div>
      )}

      {tab === 'points' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">點數交易</h3>
                <span className="text-xs text-muted">{filteredLedger.length} 筆</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
                <input
                  value={pointsSearch}
                  onChange={(e) => setPointsSearch(e.target.value)}
                  placeholder="搜尋會員或原因"
                  className="h-9 w-full rounded-lg border border-zinc-300 pl-9 pr-3 text-sm"
                  aria-label="搜尋點數交易"
                />
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden max-h-96 overflow-y-auto">
                {filteredLedger.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted">沒有點數交易紀錄</div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {filteredLedger.map((p) => (
                      <div key={p.id} className="p-3 hover:bg-zinc-50">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs">{p.user?.displayName || '未知會員'}</div>
                            <div className="text-[11px] text-muted mt-0.5">{POINTS_KIND[p.kind as keyof typeof POINTS_KIND] || p.kind}</div>
                          </div>
                          <div className="text-right whitespace-nowrap shrink-0">
                            <div className={cn('font-semibold text-sm', p.delta > 0 ? 'text-green-600' : 'text-red-600')}>
                              {p.delta > 0 ? '+' : ''}{p.delta}
                            </div>
                            <div className="text-xs text-muted">餘額 {p.balanceAfter}</div>
                          </div>
                        </div>
                        <div className="text-[11px] text-muted">{new Date(p.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">票券</h3>
                <span className="text-xs text-muted">{filteredVouchers.length} 張</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
                <input
                  value={vouchersSearch}
                  onChange={(e) => setVouchersSearch(e.target.value)}
                  placeholder="搜尋票券或會員"
                  className="h-9 w-full rounded-lg border border-zinc-300 pl-9 pr-3 text-sm"
                  aria-label="搜尋票券"
                />
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden max-h-96 overflow-y-auto">
                {filteredVouchers.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted">沒有票券紀錄</div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {filteredVouchers.map((v) => (
                      <div key={v.id} className="p-3 hover:bg-zinc-50">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs line-clamp-1">{v.title}</div>
                            <div className="text-[11px] text-muted mt-0.5">{v.user?.displayName || '未分配'}</div>
                          </div>
                          <div className="text-right whitespace-nowrap shrink-0">
                            <Pill tone={
                              getVoucherStatus(v) === 'ACTIVE' ? 'green' :
                              getVoucherStatus(v) === 'USED' ? 'gray' :
                              getVoucherStatus(v) === 'EXPIRED' ? 'red' : 'gray'
                            }>
                              {VOUCHER_STATUS[getVoucherStatus(v) as keyof typeof VOUCHER_STATUS] || '未知'}
                            </Pill>
                          </div>
                        </div>
                        <div className="text-[11px] text-muted">{v.code}</div>
                        {v.expiresAt && (
                          <div className="text-[11px] text-muted mt-1">
                            有效期至 {new Date(v.expiresAt).toLocaleDateString('zh-TW')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
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
