'use client'

import * as React from 'react'
import { MapPin, Phone, RefreshCw } from 'lucide-react'
import { DateStrip } from './date-strip'
import { MatrixLegend, SlotMatrix } from './slot-matrix'
import { CartBar } from './cart-bar'
import { SessionPanel } from '@/components/activities/session-panel'
import { DayActivities } from '@/components/activities/day-activities'
import { Card, CardContent, Separator } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useSetCart } from '@/store/cart'
import { fetchAvailability, toggleSlot } from '@/server/actions'
import { formatDateFull } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { AvailabilityDTO, CartDTO, SlotState } from '@/lib/types'

/** 背景自動更新間隔（毫秒）：讓其他人剛訂走的時段能盡快反映 */
const REFRESH_INTERVAL = 30_000

export function BookingBoard({
  slug,
  dates,
  initialDate,
  initialData,
  initialCart,
  initialSessionId = null,
  initialQuantity,
}: {
  slug: string
  dates: string[]
  initialDate: string
  initialData: AvailabilityDTO
  initialCart: CartDTO
  /** 由網址 ?session= 帶入（例如登入後返回），直接打開該活動 */
  initialSessionId?: string | null
  initialQuantity?: number
}) {
  const { toast } = useToast()
  const setCartStore = useSetCart()

  const [date, setDate] = React.useState(initialDate)
  const [data, setData] = React.useState<AvailabilityDTO>(initialData)
  const [cart, setCart] = React.useState<CartDTO>(initialCart)
  const [loading, setLoading] = React.useState(false)
  const [pendingKey, setPendingKey] = React.useState<string | null>(null)
  const [openSession, setOpenSession] = React.useState<string | null>(initialSessionId)

  // 日期與開啟中的活動寫回網址：重新整理或 LINE 登入返回時能回到同一個位置
  const syncUrl = React.useCallback((nextDate: string, sessionId: string | null) => {
    const url = new URL(window.location.href)
    url.searchParams.set('date', nextDate)
    if (sessionId) url.searchParams.set('session', sessionId)
    else {
      url.searchParams.delete('session')
      url.searchParams.delete('qty')
    }
    window.history.replaceState(null, '', url.toString())
  }, [])

  const applyCart = React.useCallback(
    (next: CartDTO) => {
      setCart(next)
      setCartStore(next)
    },
    [setCartStore],
  )

  const reload = React.useCallback(
    async (targetDate: string, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true)
      try {
        const res = await fetchAvailability(slug, targetDate)
        if (res.ok) {
          setData(res.data)
          applyCart(res.cart)
        } else if (!opts.silent) {
          toast(res.error, 'error')
        }
      } finally {
        if (!opts.silent) setLoading(false)
      }
    },
    [slug, applyCart, toast],
  )

  const handleDateChange = React.useCallback(
    (next: string) => {
      setDate(next)
      syncUrl(next, null)
      void reload(next)
    },
    [reload, syncUrl],
  )

  const openEvent = React.useCallback(
    (sessionId: string) => {
      setOpenSession(sessionId)
      syncUrl(date, sessionId)
    },
    [date, syncUrl],
  )
  const closeEvent = React.useCallback(() => {
    setOpenSession(null)
    syncUrl(date, null)
    // 關閉時更新名額與購物車
    void reload(date, { silent: true })
  }, [date, reload, syncUrl])

  const handleToggle = React.useCallback(
    async (courtId: string, start: number, state: SlotState) => {
      const key = `${courtId}@${start}`
      setPendingKey(key)

      // 樂觀更新：先把格子切換過去，讓點擊立即有回饋
      const courtIdx = data.courts.findIndex((c) => c.id === courtId)
      const rowIdx = data.times.findIndex((t) => t.start === start)
      const optimistic = state === 'AVAILABLE' ? 'SELECTED' : 'AVAILABLE'
      if (courtIdx >= 0 && rowIdx >= 0) {
        setData((prev) => {
          const cells = prev.cells.map((row) => [...row])
          cells[rowIdx][courtIdx] = optimistic
          return { ...prev, cells }
        })
      }

      try {
        const res = await toggleSlot({
          slug,
          date,
          courtId,
          start,
          action: state === 'AVAILABLE' ? 'hold' : 'release',
        })

        if (res.data) setData(res.data)
        if (res.cart) applyCart(res.cart)

        if (!res.ok) {
          toast(res.error, res.code === 'SLOT_TAKEN' ? 'error' : 'info')
          // 伺服器未回傳最新狀態時，強制重新載入以修正樂觀更新
          if (!res.data) await reload(date, { silent: true })
        }
      } catch {
        toast('連線異常，請稍後再試', 'error')
        await reload(date, { silent: true })
      } finally {
        setPendingKey(null)
      }
    },
    [applyCart, data.courts, data.times, date, reload, slug, toast],
  )

  // 分頁回到前景或定時更新
  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void reload(date, { silent: true })
    }
    const timer = setInterval(tick, REFRESH_INTERVAL)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [date, reload])

  const handleExpire = React.useCallback(() => {
    toast('選取的時段保留已逾時，已自動釋放', 'info')
    void reload(date, { silent: true })
  }, [date, reload, toast])

  const venue = data.venue

  return (
    <div className="space-y-4">
      {/* 場館資訊 */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">{venue.name}</h1>
              {venue.address.trim() && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{venue.address}</span>
                </p>
              )}
            </div>
            {venue.phone.trim() && (
            <a
              href={`tel:${venue.phone}`}
              className="flex shrink-0 items-center gap-1.5 rounded-xl surface-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              致電
            </a>
            )}
          </div>
          {venue.notice && (
            <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs leading-relaxed text-brand-800 dark:bg-brand-900/30 dark:text-brand-200">
              {venue.notice}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 步驟一：選日期 */}
      <section aria-labelledby="step-date" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="step-date" className="flex items-center gap-2 text-sm font-semibold">
            <StepDot n={1} />
            選擇日期
          </h2>
          <button
            type="button"
            onClick={() => void reload(date)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted transition-colors hover:text-brand-600"
            aria-label="重新整理時段"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            更新
          </button>
        </div>
        <DateStrip dates={dates} value={date} onChange={handleDateChange} disabled={loading} />
      </section>

      {/* 步驟二：選場地與時段 */}
      <section aria-labelledby="step-slot" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="step-slot" className="flex items-center gap-2 text-sm font-semibold">
            <StepDot n={2} />
            選擇場地與時段
          </h2>
          <span className="text-[11px] text-muted tabular">{formatDateFull(date)}</span>
        </div>

        <p className="text-xs text-muted">點選可預約的時段加入購物車；紫色區塊是活動場次，點擊可查看活動並報名。</p>

        <SlotMatrix data={data} pendingKey={pendingKey} onToggle={handleToggle} onOpenEvent={openEvent} busy={loading} />

        <div className="pt-1">
          <MatrixLegend />
        </div>
        <p className="text-[11px] text-muted">
          加入購物車後系統會為您保留 {venue.holdMinutes} 分鐘，逾時將自動釋放給其他球友。
        </p>
      </section>

      <DayActivities date={date} events={data.events} onOpen={openEvent} />

      {/* 場館規則 */}
      {venue.policy && (
        <Card>
          <CardContent className="space-y-2">
            <h3 className="text-sm font-semibold">取消與退款政策</h3>
            <Separator />
            <p className="text-xs leading-relaxed text-muted">{venue.policy}</p>
          </CardContent>
        </Card>
      )}

      <CartBar cart={cart} onExpire={handleExpire} />

      <SessionPanel
        sessionId={openSession}
        onClose={closeEvent}
        onCartChange={applyCart}
        initialQuantity={initialQuantity}
      />
    </div>
  )
}

function StepDot({ n }: { n: number }) {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
      {n}
    </span>
  )
}
