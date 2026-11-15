'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Pencil, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { updateVenueSettings } from '@/lib/api-service'
import type { VenueSettingsPatch } from '@/lib/models'

export interface VenueRules {
  id: string
  openMinute: number
  closeMinute: number
  slotMinutes: number
  bookAheadDays: number
  holdMinutes: number
  bookingCutoffMinutes: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmtMinute = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const selectCls = 'h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]'

/** 營業時間與預約規則：前台可預約時段、可預約天數、購物車保留與截止時間的唯一編輯處。 */
export function VenueRulesCard({ venue, canEdit }: { venue: VenueRules; canEdit: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<VenueSettingsPatch>({})
  const [saving, setSaving] = useState(false)
  const step = venue.slotMinutes
  const times = (from: number, to: number) => {
    const out: number[] = []
    for (let m = from; m <= to; m += step) out.push(m)
    return out
  }
  const set = <K extends keyof VenueSettingsPatch>(k: K, v: VenueSettingsPatch[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const start = () => {
    setDraft({ openMinute: venue.openMinute, closeMinute: venue.closeMinute, bookAheadDays: venue.bookAheadDays, holdMinutes: venue.holdMinutes, bookingCutoffMinutes: venue.bookingCutoffMinutes })
    setEditing(true)
  }
  const save = async () => {
    setSaving(true)
    try {
      const res = await updateVenueSettings(venue.id, draft)
      if (!res.success) return toast(`儲存失敗：${res.error?.message ?? '未知錯誤'}`, 'error')
      setEditing(false)
      toast(res.data.changed.length ? '營業時間與預約規則已更新，前台立即生效' : '沒有變更', res.data.changed.length ? 'success' : 'info')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const rows: [string, string][] = [
    ['營業時間', `${fmtMinute(venue.openMinute)}–${fmtMinute(venue.closeMinute)}，每日`],
    ['時段長度', `${venue.slotMinutes} 分鐘`],
    ['可預約', `未來 ${venue.bookAheadDays} 天`],
    ['購物車保留', `${venue.holdMinutes} 分鐘`],
    ['預約截止', venue.bookingCutoffMinutes > 0 ? `開打前 ${venue.bookingCutoffMinutes} 分鐘` : '可預約到開打前一刻'],
  ]

  return (
    <section aria-labelledby="rules-title" className="rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <h2 id="rules-title" className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-[#2f7d3b]" aria-hidden />
          營業時間與預約規則
        </h2>
        {canEdit &&
          (editing ? (
            <div className="flex gap-2">
              <Button size="sm" loading={saving} onClick={save}>
                <Save className="h-3.5 w-3.5" aria-hidden />
                儲存
              </Button>
              <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
                取消
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={start}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              編輯
            </Button>
          ))}
      </div>

      {editing ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="營業開始" htmlFor="v-open">
            <select id="v-open" className={selectCls} value={draft.openMinute} onChange={(e) => set('openMinute', Number(e.target.value))}>
              {times(0, 1440 - step).map((m) => (
                <option key={m} value={m}>{fmtMinute(m)}</option>
              ))}
            </select>
          </Field>
          <Field label="營業結束" htmlFor="v-close">
            <select id="v-close" className={selectCls} value={draft.closeMinute} onChange={(e) => set('closeMinute', Number(e.target.value))}>
              {times((draft.openMinute ?? 0) + step, 1440).map((m) => (
                <option key={m} value={m}>{fmtMinute(m)}</option>
              ))}
            </select>
          </Field>
          <Field label="可預約未來天數" htmlFor="v-ahead" hint="1–90 天">
            <Input id="v-ahead" type="number" min={1} max={90} value={draft.bookAheadDays ?? ''} onChange={(e) => set('bookAheadDays', Number(e.target.value))} />
          </Field>
          <Field label="購物車保留（分鐘）" htmlFor="v-hold" hint="3–60 分鐘">
            <Input id="v-hold" type="number" min={3} max={60} value={draft.holdMinutes ?? ''} onChange={(e) => set('holdMinutes', Number(e.target.value))} />
          </Field>
          <Field label="預約截止（開打前分鐘）" htmlFor="v-cutoff" hint="0 = 可預約到開打前一刻">
            <Input id="v-cutoff" type="number" min={0} max={1440} value={draft.bookingCutoffMinutes ?? ''} onChange={(e) => set('bookingCutoffMinutes', Number(e.target.value))} />
          </Field>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-5">時段長度 {venue.slotMinutes} 分鐘不開放修改，避免打亂既有預約。縮短營業時間不會取消已成立的訂單。</p>
        </div>
      ) : (
        <dl className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
