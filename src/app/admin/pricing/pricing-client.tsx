'use client'

import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { ErrorState, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { getCoaches, getCourts, getEvents } from '@/lib/api-service'
import type { Coach, Court, Event } from '@/lib/models'

/**
 * 定價（Phase 1I）。
 * 球場時租、活動費用、教練時薪來自 mock api-service；
 * 尖峰倍率與會員折扣目前為頁內常數，Phase 2 改為可編輯的定價規則。
 */

const TIME_RULES = [
  { label: '離峰（平日 09:00–17:00）', multiplier: 1 },
  { label: '尖峰（平日 17:00–22:00）', multiplier: 1.3 },
  { label: '假日（全日）', multiplier: 1.5 },
]
const MEMBER_DISCOUNT = [
  { level: '一般', discount: 0 },
  { level: '進階', discount: 10 },
  { level: 'VIP', discount: 20 },
]
const EVENT_TYPE_LABEL: Record<Event['type'], string> = { TOURNAMENT: '比賽', SOCIAL: '交流賽', TRAINING: '訓練課程', OTHER: '其他' }

const fmtMoney = (n: number) => `NT$${Math.round(n).toLocaleString()}`

export function PricingClient() {
  const [courts, setCourts] = useState<Court[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, e, k] = await Promise.all([getCourts(), getEvents(), getCoaches()])
      if (!c.success) throw new Error(c.error?.message ?? '無法載入球場')
      setCourts(c.data)
      setEvents(e.success ? e.data : [])
      setCoaches(k.success ? k.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState description={error} retry={load} />

  const EditBtn = () => (
    <Button size="sm" variant="ghost" disabled title="Phase 2 實作">
      <Pencil className="h-3.5 w-3.5" aria-hidden />
      編輯
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="定價" subtitle="球場時租、時段倍率、活動與教練費用、會員折扣" />

      {/* 球場時租 × 時段倍率 */}
      <Section title="球場時租" subtitle="基本時租乘上時段倍率即為實際價格" aside={<EditBtn />}>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-[rgb(var(--border))]">
              <th className="px-4 py-2.5 font-medium">球場</th>
              <th className="px-4 py-2.5 text-right font-medium">基本時租</th>
              {TIME_RULES.map((r) => (
                <th key={r.label} className="px-4 py-2.5 text-right font-medium">{r.label.split('（')[0]}<span className="ml-1 font-normal">×{r.multiplier}</span></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--border))]">
            {courts.map((c) => (
              <tr key={c.id} className={c.status !== 'ACTIVE' ? 'text-muted' : ''}>
                <td className="px-4 py-2.5">
                  {c.name}
                  {c.status !== 'ACTIVE' && <StatusBadge status={c.status === 'MAINTENANCE' ? '維護中' : '停用'} variant="warning" size="sm" />}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(c.pricePerHour)}</td>
                {TIME_RULES.map((r) => (
                  <td key={r.label} className="px-4 py-2.5 text-right font-mono">{fmtMoney(c.pricePerHour * r.multiplier)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 pb-3 pt-2 text-xs text-muted">{TIME_RULES.map((r) => r.label).join('；')}</p>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 活動費用 */}
        <Section title="活動費用" subtitle="每人報名費" aside={<EditBtn />}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="px-4 py-2.5 font-medium">活動</th>
                <th className="px-4 py-2.5 font-medium">類型</th>
                <th className="px-4 py-2.5 text-right font-medium">費用</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5">{e.name}</td>
                  <td className="px-4 py-2.5 text-muted">{EVENT_TYPE_LABEL[e.type]}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(e.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* 教練課程 */}
        <Section title="教練課程" subtitle="每小時" aside={<EditBtn />}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="px-4 py-2.5 font-medium">教練</th>
                <th className="px-4 py-2.5 font-medium">專長</th>
                <th className="px-4 py-2.5 text-right font-medium">時薪</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {coaches.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">{c.name}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{c.specialties.join('、')}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(c.hourlyRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      {/* 會員折扣 */}
      <Section title="會員折扣" subtitle="套用於球場時租與教練課程，活動費用不折扣" aside={<EditBtn />}>
        <div className="grid grid-cols-3 divide-x divide-[rgb(var(--border))]">
          {MEMBER_DISCOUNT.map((m) => (
            <div key={m.level} className="px-4 py-4 text-center">
              <p className="text-xs text-muted">{m.level}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{m.discount}%</p>
              <p className="text-xs text-muted">例：{fmtMoney(500)} → {fmtMoney(500 * (1 - m.discount / 100))}</p>
            </div>
          ))}
        </div>
      </Section>

      <p className="text-xs text-muted">時段倍率與會員折扣目前為固定規則，Phase 2 會改為可編輯並寫入資料庫。</p>
    </div>
  )
}

function Section({ title, subtitle, aside, children }: { title: string; subtitle?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {aside}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}
