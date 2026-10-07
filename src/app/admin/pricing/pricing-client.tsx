'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Save } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { ErrorState, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getCoaches, getPricing, getSessionEvents, updateMembershipTiers } from '@/lib/api-service'
import type { Coach, MembershipTierRow, PriceRuleRow, SessionEvent } from '@/lib/models'

/**
 * 定價（Phase 2）。
 * 場地費率規則、會員折扣、活動（球敘）費用、教練時薪皆來自資料庫。
 * 費率規則即前台計價所用（lib/pricing.ts），這裡先唯讀，編輯列為後續項目。
 */

const KIND_LABEL: Record<PriceRuleRow['kind'], string> = { PEAK: '尖峰', OFFPEAK: '離峰' }
const DAY_LABEL: Record<PriceRuleRow['dayType'], string> = { ALL: '每天', WEEKDAY: '平日', WEEKEND: '假日' }

const fmtMoney = (n: number) => `NT$${Math.round(n).toLocaleString()}`
const fmtMinute = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

export function PricingClient() {
  const { toast } = useToast()
  const [rules, setRules] = useState<PriceRuleRow[]>([])
  const [tiers, setTiers] = useState<MembershipTierRow[]>([])
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingTiers, setEditingTiers] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, e, k] = await Promise.all([getPricing(), getSessionEvents('upcoming'), getCoaches()])
      if (!p.success) throw new Error(p.error?.message ?? '無法載入定價')
      setRules(p.data.priceRules)
      setTiers(p.data.tiers)
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

  const byVenue = useMemo(() => {
    const m = new Map<string, PriceRuleRow[]>()
    for (const r of rules) m.set(r.venueName, [...(m.get(r.venueName) ?? []), r])
    return [...m]
  }, [rules])

  /** 未來場次依名稱與價格歸併，只列出不同的收費組合 */
  const eventPrices = useMemo(() => {
    const m = new Map<string, { title: string; price: number; count: number; source: string }>()
    for (const e of events) {
      const k = `${e.title}|${e.price}`
      const cur = m.get(k)
      if (cur) cur.count++
      else m.set(k, { title: e.title, price: e.price, count: 1, source: e.templateTitle ? '週期範本' : '單次' })
    }
    return [...m.values()]
  }, [events])

  /** 會員折扣範例以最低離峰價計算 */
  const basePrice = useMemo(() => Math.min(...rules.filter((r) => r.kind === 'OFFPEAK').map((r) => r.price), ...rules.map((r) => r.price), Infinity), [rules])
  const example = Number.isFinite(basePrice) ? basePrice : 500

  const startEdit = () => {
    setDraft(Object.fromEntries(tiers.map((t) => [t.level, String(t.discountPct)])))
    setEditingTiers(true)
  }

  const saveTiers = async () => {
    const payload = tiers.map((t) => ({ level: t.level, discountPct: Number(draft[t.level]) }))
    if (payload.some((p) => !Number.isInteger(p.discountPct) || p.discountPct < 0 || p.discountPct > 100)) {
      toast('折扣需為 0 到 100 的整數', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await updateMembershipTiers(payload)
      if (!res.success) {
        toast(`儲存失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
        return
      }
      setTiers(res.data)
      setEditingTiers(false)
      toast('會員折扣已更新', 'success')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState description={error} retry={load} />

  const ReadOnlyBtn = ({ title }: { title: string }) => (
    <Button size="sm" variant="ghost" disabled title={title}>
      <Pencil className="h-3.5 w-3.5" aria-hidden />
      編輯
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="定價" subtitle="場地費率規則、會員折扣、活動與教練費用" />

      {/* 場地費率規則（資料庫） */}
      <Section
        title="場地費率規則"
        subtitle="前台計價依此表：先比對平日／假日，再依優先序取價；每時段 60 分鐘"
        aside={<ReadOnlyBtn title="費率規則影響前台計價，編輯功能列為後續項目" />}
      >
        {byVenue.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">尚未設定費率規則</p>
        ) : (
          byVenue.map(([venue, list]) => (
            <div key={venue}>
              {byVenue.length > 1 && <p className="border-b border-[rgb(var(--border))] px-4 py-2 text-xs font-medium text-muted">{venue}</p>}
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-[rgb(var(--border))]">
                    <th className="px-4 py-2.5 font-medium">名稱</th>
                    <th className="px-4 py-2.5 font-medium">類型</th>
                    <th className="px-4 py-2.5 font-medium">適用日</th>
                    <th className="px-4 py-2.5 font-medium">時段</th>
                    <th className="px-4 py-2.5 text-right font-medium">每時段價格</th>
                    <th className="px-4 py-2.5 text-right font-medium">優先序</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border))]">
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5">{r.name}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={KIND_LABEL[r.kind]} variant={r.kind === 'PEAK' ? 'warning' : 'info'} size="sm" />
                      </td>
                      <td className="px-4 py-2.5">{DAY_LABEL[r.dayType]}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{fmtMinute(r.startMinute)}–{fmtMinute(r.endMinute)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(r.price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted">{r.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </Section>

      {/* 會員折扣（資料庫，可編輯） */}
      <Section
        title="會員折扣"
        subtitle="套用於場地時租與教練課程，活動費用不折扣"
        aside={
          editingTiers ? (
            <div className="flex gap-2">
              <Button size="sm" loading={saving} onClick={saveTiers}>
                <Save className="h-3.5 w-3.5" aria-hidden />
                儲存
              </Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditingTiers(false)}>取消</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              編輯
            </Button>
          )
        }
      >
        <div className="grid grid-cols-3 divide-x divide-[rgb(var(--border))]">
          {tiers.map((t) => (
            <div key={t.level} className="px-4 py-4 text-center">
              <p className="text-xs text-muted">{t.label}</p>
              {editingTiers ? (
                <label className="mt-1 inline-flex items-center justify-center gap-1 text-2xl font-semibold tabular-nums">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft[t.level] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [t.level]: e.target.value }))}
                    aria-label={`${t.label}折扣`}
                    className="w-20 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-center text-xl"
                  />
                  %
                </label>
              ) : (
                <p className="mt-1 text-2xl font-semibold tabular-nums">{t.discountPct}%</p>
              )}
              <p className="text-xs text-muted">例：{fmtMoney(example)} → {fmtMoney(example * (1 - (editingTiers ? Number(draft[t.level]) || 0 : t.discountPct) / 100))}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="活動（球敘）費用" subtitle="未來場次的每人報名費" aside={<a href="/admin/templates" className="text-xs text-brand-600 hover:underline">到範本修改 →</a>}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="px-4 py-2.5 font-medium">活動</th>
                <th className="px-4 py-2.5 font-medium">來源</th>
                <th className="px-4 py-2.5 text-right font-medium">費用</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {eventPrices.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted">目前沒有未來場次</td>
                </tr>
              ) : (
                eventPrices.map((e) => (
                  <tr key={`${e.title}|${e.price}`}>
                    <td className="px-4 py-2.5">{e.title}<span className="ml-1 text-xs text-muted">（{e.count} 場）</span></td>
                    <td className="px-4 py-2.5 text-muted">{e.source}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmtMoney(e.price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Section>

        <Section title="教練課程" subtitle="每小時" aside={<a href="/admin/events" className="text-xs text-brand-600 hover:underline">到教練頁修改 →</a>}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-[rgb(var(--border))]">
                <th className="px-4 py-2.5 font-medium">教練</th>
                <th className="px-4 py-2.5 font-medium">專長</th>
                <th className="px-4 py-2.5 text-right font-medium">時薪</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {coaches.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted">尚未建立教練</td>
                </tr>
              )}
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

      <p className="text-xs text-muted">會員折扣的實際套用（結帳時依等級打折）為後續項目；目前先維護設定值。</p>
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
