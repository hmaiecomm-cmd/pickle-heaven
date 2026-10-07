'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { computeSessionTimes } from '@/lib/session-schedule'
import { zonedParts } from '@/lib/timezone'
import { adminCreateSession, type OneOffInput } from '@/server/session-admin-actions'

/**
 * 新增單次球敘（不重複）。
 * 欄位與週期性範本相同，改以指定日期取代重複星期；
 * 下方的時間預覽與伺服器用的是同一個 computeSessionTimes，預覽即最終結果。
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
const pad = (n: number) => String(n).padStart(2, '0')
const toTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
const fromTime = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function todayIn(tz: string) {
  const p = zonedParts(new Date(), tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

function fmt(d: Date, tz: string) {
  const p = zonedParts(d, tz)
  return `${p.month}/${p.day}（${WEEKDAYS[p.weekday]}）${pad(p.hour)}:${pad(p.minute)}`
}

export function CreateSessionButton({ timezone, autoOpen = false }: { timezone: string; autoOpen?: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = React.useState(autoOpen)
  const [pending, startTransition] = React.useTransition()

  const empty = React.useCallback(
    (): OneOffInput => ({
      title: '',
      date: addDays(todayIn(timezone), 7),
      startMinute: 12 * 60,
      endMinute: 14 * 60,
      capacity: 8,
      reservedCapacity: 0,
      skillLevelMin: null,
      skillLevelMax: null,
      price: 500,
      bookingOpenDaysBefore: 7,
      bookingOpenHourOffset: 1,
      cancellationMode: 'PREVIOUS_DAY_MIDNIGHT',
      cancellationHoursBefore: null,
      waitlistEnabled: true,
      autoPromote: true,
      allowPostLockReplacement: false,
    }),
    [timezone],
  )
  const [form, setForm] = React.useState<OneOffInput>(empty)
  const set = <K extends keyof OneOffInput>(k: K, v: OneOffInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const preview = React.useMemo(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.date)
    if (!m || form.endMinute <= form.startMinute) return null
    const [, y, mo, d] = m.map(Number)
    try {
      const t = computeSessionTimes(
        { year: y, month: mo, day: d, hour: 0, minute: 0, second: 0, weekday: 0 },
        {
          timezone,
          startMinute: form.startMinute,
          endMinute: form.endMinute,
          bookingOpenDaysBefore: form.bookingOpenDaysBefore,
          bookingOpenHourOffset: form.bookingOpenHourOffset,
          cancellationMode: form.cancellationMode,
          cancellationHoursBefore: form.cancellationHoursBefore,
        },
      )
      const now = new Date()
      return { ...t, inPast: t.startAt <= now, opensNow: t.bookingOpenAt <= now }
    } catch {
      return null
    }
  }, [form, timezone])

  const submit = () => {
    startTransition(async () => {
      const res = await adminCreateSession(form)
      toast(res.message, res.ok ? 'success' : 'error')
      if (res.ok) {
        setOpen(false)
        setForm(empty())
        if (res.sessionId) router.push(`/admin/sessions/${res.sessionId}`)
        else router.refresh()
      }
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        新增單次球敘
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="新增單次球敘" description="只舉辦一次的場次；固定每週的請用週期性範本">
          <div className="space-y-4">
            <Field label="名稱" htmlFor="s-title" required>
              <Input id="s-title" value={form.title} maxLength={60} placeholder="例：週六夜間友誼賽" onChange={(e) => set('title', e.target.value)} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="日期" htmlFor="s-date">
                <Input id="s-date" type="date" min={todayIn(timezone)} value={form.date} onChange={(e) => set('date', e.target.value)} />
              </Field>
              <Field label="開始" htmlFor="s-start">
                <Input id="s-start" type="time" value={toTime(form.startMinute)} onChange={(e) => set('startMinute', fromTime(e.target.value))} />
              </Field>
              <Field label="結束" htmlFor="s-end">
                <Input id="s-end" type="time" value={toTime(form.endMinute)} onChange={(e) => set('endMinute', fromTime(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="總容量" htmlFor="s-cap">
                <Input id="s-cap" type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
              </Field>
              <Field label="保留名額" htmlFor="s-res" hint="主辦保留給自己人">
                <Input id="s-res" type="number" min={0} value={form.reservedCapacity} onChange={(e) => set('reservedCapacity', Number(e.target.value))} />
              </Field>
              <Field label="價格" htmlFor="s-price">
                <Input id="s-price" type="number" min={0} value={form.price} onChange={(e) => set('price', Number(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="程度下限" hint="留空表示不限" htmlFor="s-smin">
                <Input id="s-smin" type="number" step="0.5" value={form.skillLevelMin ?? ''} onChange={(e) => set('skillLevelMin', e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
              <Field label="程度上限" htmlFor="s-smax">
                <Input id="s-smax" type="number" step="0.5" value={form.skillLevelMax ?? ''} onChange={(e) => set('skillLevelMax', e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="提前幾天開放報名" htmlFor="s-days">
                <Input id="s-days" type="number" min={0} value={form.bookingOpenDaysBefore} onChange={(e) => set('bookingOpenDaysBefore', Number(e.target.value))} />
              </Field>
              <Field label="開放時間位移（小時）" hint="+1 表示比開打時刻晚 1 小時" htmlFor="s-off">
                <Input id="s-off" type="number" value={form.bookingOpenHourOffset} onChange={(e) => set('bookingOpenHourOffset', Number(e.target.value))} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="取消截止規則" htmlFor="s-mode">
                <select
                  id="s-mode"
                  value={form.cancellationMode}
                  onChange={(e) => {
                    const mode = e.target.value as OneOffInput['cancellationMode']
                    setForm((f) => ({ ...f, cancellationMode: mode, cancellationHoursBefore: mode === 'HOURS_BEFORE_START' ? (f.cancellationHoursBefore ?? 24) : null }))
                  }}
                  className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]"
                >
                  <option value="PREVIOUS_DAY_MIDNIGHT">前一日 00:00</option>
                  <option value="HOURS_BEFORE_START">開打前 N 小時</option>
                </select>
              </Field>
              {form.cancellationMode === 'HOURS_BEFORE_START' && (
                <Field label="開打前幾小時截止" htmlFor="s-hours">
                  <Input
                    id="s-hours"
                    type="number"
                    min={0}
                    value={form.cancellationHoursBefore ?? ''}
                    onChange={(e) => set('cancellationHoursBefore', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </Field>
              )}
            </div>

            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1 text-sm font-medium">候補</legend>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.waitlistEnabled} onChange={(e) => set('waitlistEnabled', e.target.checked)} />
                開放候補
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.autoPromote} disabled={!form.waitlistEnabled} onChange={(e) => set('autoPromote', e.target.checked)} />
                有人取消時自動遞補
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.allowPostLockReplacement} onChange={(e) => set('allowPostLockReplacement', e.target.checked)} />
                名單鎖定後仍允許替補
              </label>
            </fieldset>

            <div className="rounded-xl border border-[rgb(var(--border))] p-3 text-sm" aria-live="polite">
              <p className="mb-1.5 text-xs font-semibold text-muted">時間預覽（{timezone}）</p>
              {!preview ? (
                <p className="text-muted">請確認日期與時間（結束須晚於開始）</p>
              ) : preview.inPast ? (
                <p className="text-red-600">開打時間已經過了，請改日期或時間。</p>
              ) : (
                <dl className="grid grid-cols-[6rem_1fr] gap-y-1">
                  <dt className="text-muted">開打</dt>
                  <dd>{fmt(preview.startAt, timezone)} – {fmt(preview.endAt, timezone).slice(-5)}</dd>
                  <dt className="text-muted">開放報名</dt>
                  <dd>{fmt(preview.bookingOpenAt, timezone)}{preview.opensNow ? '（建立後立即開放）' : ''}</dd>
                  <dt className="text-muted">取消截止</dt>
                  <dd>{fmt(preview.cancelDeadline, timezone)}，同時鎖定最終名單</dd>
                </dl>
              )}
            </div>

            <div className="flex gap-2 border-t border-[rgb(var(--border))] pt-4">
              <Button size="sm" loading={pending} disabled={!form.title.trim() || !preview || preview.inPast} onClick={submit}>
                建立
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
