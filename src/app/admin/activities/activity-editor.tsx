'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck2, Eye, Plus, Save, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  ACTIVITY_TYPE_LABEL,
  ACTIVITY_TYPE_OPTIONS,
  MAX_OCCURRENCES,
  PRICE_UNIT_OPTION_LABEL,
  activityTimeLabel,
  shortDateLabel,
  type ActivityTypeKey,
  type PriceUnitKey,
} from '@/lib/activity-shared'
import { WEEKDAY_LABELS } from '@/lib/time'
import type { PreviewResult } from '@/server/activity-admin'
import { previewActivityAction, saveActivityAction } from '@/server/activity-admin-actions'
import { CoverUploader } from './cover-uploader'

export interface EditorForm {
  title: string
  type: ActivityTypeKey
  summary: string
  description: string
  levelLabel: string
  requirements: string
  includes: string
  refundNote: string
  coverAssetId: string | null
  coverFocusX: number
  coverFocusY: number
  price: number
  priceUnit: PriceUnitKey
  capacity: number
  maxPerOrder: number
  repeatKind: 'ONCE' | 'WEEKLY'
  weekdays: number[]
  intervalWeeks: number
  startMinute: number
  endMinute: number
  seriesStartDate: string
  endMode: 'DATE' | 'COUNT'
  seriesEndDate: string
  occurrenceCount: number
  skipDates: string[]
  courtIds: string[]
  openDaysBefore: number
  openMinute: number | null
  closeMinutesBefore: number
}

const sel = 'h-10 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-sm'
const fmt = (m: number) => (m >= 1440 ? (m === 1440 ? '24:00' : `翌日 ${String(Math.floor((m - 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`) : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-emerald-50 text-emerald-800',
  EXISTS: 'bg-zinc-100 text-zinc-700',
  CONFLICT: 'bg-red-50 text-red-700',
  PAST: 'bg-zinc-100 text-zinc-500',
  INVALID: 'bg-amber-50 text-amber-800',
}
const STATUS_TEXT: Record<string, string> = { NEW: '可建立', EXISTS: '已建立', CONFLICT: '衝突', PAST: '已過時', INVALID: '設定有誤' }

export function ActivityEditor({
  activityId,
  status,
  initial,
  venue,
  courts,
}: {
  activityId: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | null
  initial: EditorForm
  venue: { openMinute: number; closeMinute: number; slotMinutes: number }
  courts: { id: string; name: string; active: boolean }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = React.useState<EditorForm>(initial)
  const [preview, setPreview] = React.useState<PreviewResult | null>(null)
  const [previewKey, setPreviewKey] = React.useState<string | null>(null)
  const [exclude, setExclude] = React.useState<Set<string>>(new Set())
  const [holdDays, setHoldDays] = React.useState(0)
  const [skipInput, setSkipInput] = React.useState('')
  const [busy, setBusy] = React.useState<null | 'preview' | 'draft' | 'publish'>(null)
  const [result, setResult] = React.useState<{ message: string; failed: { date: string; reason: string }[] } | null>(null)

  const published = status === 'PUBLISHED'
  const set = <K extends keyof EditorForm>(k: K, v: EditorForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const payload = React.useCallback(
    (f: EditorForm) => ({
      title: f.title,
      type: f.type,
      summary: f.summary || null,
      description: f.description || null,
      levelLabel: f.levelLabel || null,
      requirements: f.requirements || null,
      includes: f.includes || null,
      refundNote: f.refundNote || null,
      coverAssetId: f.coverAssetId,
      coverFocusX: f.coverFocusX,
      coverFocusY: f.coverFocusY,
      price: Number(f.price) || 0,
      priceUnit: f.priceUnit,
      capacity: Number(f.capacity) || 0,
      maxPerOrder: Number(f.maxPerOrder) || 1,
      repeatKind: f.repeatKind,
      weekdays: f.weekdays,
      intervalWeeks: Number(f.intervalWeeks) || 1,
      startMinute: f.startMinute,
      endMinute: f.endMinute,
      seriesStartDate: f.seriesStartDate,
      seriesEndDate: f.repeatKind === 'WEEKLY' && f.endMode === 'DATE' ? f.seriesEndDate || null : null,
      occurrenceCount: f.repeatKind === 'WEEKLY' && f.endMode === 'COUNT' ? Number(f.occurrenceCount) || null : null,
      skipDates: f.skipDates,
      courtIds: f.courtIds,
      openDaysBefore: Number(f.openDaysBefore) || 0,
      openMinute: f.openMinute,
      closeMinutesBefore: Number(f.closeMinutesBefore) || 0,
    }),
    [],
  )

  // 只有影響場次的欄位變動時，預覽才需要重做
  const scheduleKey = JSON.stringify(
    (({ repeatKind, weekdays, intervalWeeks, startMinute, endMinute, seriesStartDate, endMode, seriesEndDate, occurrenceCount, skipDates, courtIds, openDaysBefore, openMinute, closeMinutesBefore }) => ({
      repeatKind, weekdays, intervalWeeks, startMinute, endMinute, seriesStartDate, endMode, seriesEndDate, occurrenceCount, skipDates, courtIds, openDaysBefore, openMinute, closeMinutesBefore,
    }))(form),
  )
  const previewFresh = preview !== null && previewKey === scheduleKey

  const runPreview = async () => {
    setBusy('preview')
    setResult(null)
    try {
      const res = await previewActivityAction(payload(form), activityId)
      if (!res.ok) return toast(res.message, 'error')
      setPreview(res.preview)
      setPreviewKey(scheduleKey)
      setExclude(new Set())
      if (res.preview.error) toast(res.preview.error, 'error')
    } finally {
      setBusy(null)
    }
  }

  const save = async (mode: 'draft' | 'publish') => {
    if (mode === 'publish' && !previewFresh) {
      toast('請先預覽場次並確認衝突', 'info')
      return
    }
    setBusy(mode)
    try {
      const res = await saveActivityAction({
        id: activityId,
        input: payload(form),
        mode,
        excludeDates: mode === 'publish' ? [...exclude] : [],
        holdDays: mode === 'draft' ? holdDays : 0,
      })
      if (!res.ok) return toast(res.message, 'error')
      toast(res.message ?? '已儲存', res.result.failed.length > 0 ? 'info' : 'success')
      setResult({ message: res.result.message, failed: res.result.failed })
      if (!activityId) router.replace(`/admin/activities/${res.result.activityId}`)
      else {
        router.refresh()
        setPreview(null)
      }
    } finally {
      setBusy(null)
    }
  }

  const slotOptions = React.useMemo(() => {
    const out: number[] = []
    const step = Math.min(30, venue.slotMinutes)
    for (let m = venue.openMinute; m <= venue.closeMinute; m += step) out.push(m)
    return out
  }, [venue])

  const conflictRows = preview?.rows.filter((r) => r.status === 'CONFLICT') ?? []
  const unresolved = conflictRows.filter((r) => !exclude.has(r.date))
  const lockSchedule = published // 已發布：時間、場地、價格、名額改用場次列表的「修改」

  return (
    <div className="space-y-4">
      {/* 基本資料 */}
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-sm font-semibold">基本資料</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="活動名稱" htmlFor="a-title" required>
              <Input id="a-title" value={form.title} maxLength={60} placeholder="例：新手友善 Open Play" onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="活動類型" htmlFor="a-type">
              <select id="a-type" className={sel} value={form.type} onChange={(e) => set('type', e.target.value as ActivityTypeKey)}>
                {ACTIVITY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="卡片簡介" htmlFor="a-summary" hint="顯示在活動卡片，一兩句話即可">
            <Input id="a-summary" value={form.summary} maxLength={120} onChange={(e) => set('summary', e.target.value)} />
          </Field>
          <Field label="活動介紹" htmlFor="a-desc">
            <Textarea id="a-desc" rows={4} value={form.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="適合程度" htmlFor="a-level" hint="例：新手友善、3.0 以上">
              <Input id="a-level" value={form.levelLabel} maxLength={40} onChange={(e) => set('levelLabel', e.target.value)} />
            </Field>
            <Field label="參加條件" htmlFor="a-req" hint="例：請著運動鞋，可借球拍">
              <Input id="a-req" value={form.requirements} maxLength={500} onChange={(e) => set('requirements', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 封面 */}
      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">封面圖片</h2>
          <CoverUploader
            assetId={form.coverAssetId}
            focusX={form.coverFocusX}
            focusY={form.coverFocusY}
            typeLabel={ACTIVITY_TYPE_LABEL[form.type]}
            onChange={(v) => setForm((f) => ({ ...f, coverAssetId: v.assetId, coverFocusX: v.focusX, coverFocusY: v.focusY }))}
          />
        </CardContent>
      </Card>

      {/* 費用與名額 */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">費用與名額</h2>
            {lockSchedule && <span className="text-xs text-muted">已發布：價格與名額請在下方場次列表「修改」並選擇套用範圍</span>}
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="費用（NT$）" htmlFor="a-price">
              <Input id="a-price" type="number" min={0} value={form.price} disabled={lockSchedule} onChange={(e) => set('price', Number(e.target.value))} />
            </Field>
            <Field label="計價單位" htmlFor="a-unit">
              <select id="a-unit" className={sel} value={form.priceUnit} disabled={lockSchedule} onChange={(e) => set('priceUnit', e.target.value as PriceUnitKey)}>
                {(Object.keys(PRICE_UNIT_OPTION_LABEL) as PriceUnitKey[]).map((k) => (
                  <option key={k} value={k}>
                    {PRICE_UNIT_OPTION_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="名額上限（人）" htmlFor="a-cap">
              <Input id="a-cap" type="number" min={1} value={form.capacity} disabled={lockSchedule} onChange={(e) => set('capacity', Number(e.target.value))} />
            </Field>
            <Field label="單筆最多報名" htmlFor="a-max" hint={form.priceUnit === 'PER_PAIR' ? '組' : '人'}>
              <Input id="a-max" type="number" min={1} max={20} value={form.maxPerOrder} onChange={(e) => set('maxPerOrder', Number(e.target.value))} />
            </Field>
          </div>
          <Field label="費用包含項目" htmlFor="a-inc" hint="例：場地、球、教練帶打">
            <Input id="a-inc" value={form.includes} maxLength={300} onChange={(e) => set('includes', e.target.value)} />
          </Field>
          <Field label="取消與退款補充說明" htmlFor="a-refund" hint="退款比例一律依系統規則（72 小時前全額…）計算，這裡只寫補充說明，不會改變退款金額">
            <Textarea id="a-refund" rows={2} value={form.refundNote} maxLength={500} onChange={(e) => set('refundNote', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* 場次排程 */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">場次排程（Asia/Taipei）</h2>
            {lockSchedule && <span className="text-xs text-muted">已發布：可延長系列或加入跳過日期；時間與場地請用場次「修改」</span>}
          </div>
          <div className="flex gap-2" role="radiogroup" aria-label="重複方式">
            {(['ONCE', 'WEEKLY'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={form.repeatKind === k}
                disabled={lockSchedule}
                onClick={() => set('repeatKind', k)}
                className={cn(
                  'h-10 rounded-xl border px-4 text-sm font-medium disabled:opacity-50',
                  form.repeatKind === k ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-[rgb(var(--border))]',
                )}
              >
                {k === 'ONCE' ? '單次活動' : '每週重複'}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={form.repeatKind === 'ONCE' ? '日期' : '系列開始日期'} htmlFor="a-start-date">
              <Input id="a-start-date" type="date" value={form.seriesStartDate} disabled={lockSchedule} onChange={(e) => set('seriesStartDate', e.target.value)} />
            </Field>
            <Field label="開始時間" htmlFor="a-st">
              <select id="a-st" className={sel} value={form.startMinute} disabled={lockSchedule} onChange={(e) => set('startMinute', Number(e.target.value))}>
                {slotOptions.slice(0, -1).map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="結束時間" htmlFor="a-et" hint={`可以 30 分鐘為單位；非整點的活動會占用所有重疊的 ${venue.slotMinutes} 分鐘時段格`}>
              <select id="a-et" className={sel} value={form.endMinute} disabled={lockSchedule} onChange={(e) => set('endMinute', Number(e.target.value))}>
                {slotOptions.filter((m) => m > form.startMinute).map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {form.repeatKind === 'WEEKLY' && (
            <div className="space-y-4 rounded-xl bg-zinc-50 p-3">
              <fieldset>
                <legend className="mb-2 text-sm font-medium">每週的哪幾天</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, d) => {
                    const on = form.weekdays.includes(d)
                    return (
                      <label key={d} className={cn('flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-sm', on ? 'border-brand-600 bg-brand-50' : 'border-[rgb(var(--border))] bg-white', lockSchedule && 'opacity-50')}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={lockSchedule}
                          onChange={(e) => set('weekdays', e.target.checked ? [...form.weekdays, d].sort() : form.weekdays.filter((x) => x !== d))}
                        />
                        {label}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="每隔幾週" htmlFor="a-int" hint="1 = 每週，2 = 隔週">
                  <Input id="a-int" type="number" min={1} max={8} value={form.intervalWeeks} disabled={lockSchedule} onChange={(e) => set('intervalWeeks', Number(e.target.value))} />
                </Field>
                <Field label="系列結束方式" htmlFor="a-endmode">
                  <select id="a-endmode" className={sel} value={form.endMode} onChange={(e) => set('endMode', e.target.value as 'DATE' | 'COUNT')}>
                    <option value="DATE">指定結束日期</option>
                    <option value="COUNT">指定重複次數</option>
                  </select>
                </Field>
                {form.endMode === 'DATE' ? (
                  <Field label="結束日期" htmlFor="a-end-date">
                    <Input id="a-end-date" type="date" value={form.seriesEndDate} onChange={(e) => set('seriesEndDate', e.target.value)} />
                  </Field>
                ) : (
                  <Field label="重複次數" htmlFor="a-count" hint={`最多 ${MAX_OCCURRENCES} 次，跳過的日期也計入`}>
                    <Input id="a-count" type="number" min={1} max={MAX_OCCURRENCES} value={form.occurrenceCount} onChange={(e) => set('occurrenceCount', Number(e.target.value))} />
                  </Field>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium">跳過日期（休館日等）</p>
            <div className="flex flex-wrap items-center gap-2">
              {form.skipDates.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs">
                  {shortDateLabel(d)}
                  <button type="button" aria-label={`取消跳過 ${d}`} onClick={() => set('skipDates', form.skipDates.filter((x) => x !== d))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Input type="date" className="h-9 w-40" value={skipInput} onChange={(e) => setSkipInput(e.target.value)} aria-label="新增跳過日期" />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!skipInput}
                onClick={() => {
                  if (skipInput && !form.skipDates.includes(skipInput)) set('skipDates', [...form.skipDates, skipInput].sort())
                  setSkipInput('')
                }}
              >
                <Plus className="h-4 w-4" aria-hidden />
                加入
              </Button>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">
              使用場地 <span className="text-red-600">＊必填</span>
              <span className="ml-1 text-xs font-normal text-muted">可選一面或多面；名額仍以整場計算。目前場館沒有棚區資料，直接選球場。</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={lockSchedule}
                onClick={() => set('courtIds', courts.filter((c) => c.active).map((c) => c.id))}
                className="h-10 rounded-xl border border-dashed border-brand-600 px-3 text-sm text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                使用全部場地（{courts.filter((c) => c.active).length} 面）
              </button>
              {courts.map((c) => {
                const on = form.courtIds.includes(c.id)
                return (
                  <label key={c.id} className={cn('flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-sm', on ? 'border-brand-600 bg-brand-50' : 'border-[rgb(var(--border))]', (lockSchedule || !c.active) && 'opacity-50')}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={lockSchedule || !c.active}
                      onChange={(e) => set('courtIds', e.target.checked ? [...form.courtIds, c.id] : form.courtIds.filter((x) => x !== c.id))}
                    />
                    {c.name}
                    {!c.active && '（停用中）'}
                  </label>
                )
              })}
            </div>
            {form.courtIds.length === 0 && <p className="mt-2 text-xs text-red-700">請選擇使用場地；未選場地不能發布需占用場地的球敘。</p>}
            {form.courtIds.length > 0 && (
              <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
                此活動將占用 {form.repeatKind === 'WEEKLY' ? `自 ${form.seriesStartDate} 起每週${form.weekdays.map((d) => WEEKDAY_LABELS[d].replace('週', '')).join('、') || '—'}` : form.seriesStartDate}{' '}
                {activityTimeLabel(form.startMinute, form.endMinute)} 的 {courts.filter((c) => form.courtIds.includes(c.id)).map((c) => c.name).join('、')}，期間不開放一般場地租借。
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="開始前幾天開放報名" htmlFor="a-open">
              <Input id="a-open" type="number" min={0} max={60} value={form.openDaysBefore} disabled={lockSchedule} onChange={(e) => set('openDaysBefore', Number(e.target.value))} />
            </Field>
            <Field label="開放時刻" htmlFor="a-open-min" hint="未設定則與活動開始時刻相同">
              <select
                id="a-open-min"
                className={sel}
                value={form.openMinute ?? ''}
                disabled={lockSchedule}
                onChange={(e) => set('openMinute', e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">與開始時刻相同</option>
                {Array.from({ length: 48 }, (_, i) => i * 30).map((m) => (
                  <option key={m} value={m}>
                    {fmt(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="報名截止" htmlFor="a-close">
              <select id="a-close" className={sel} value={form.closeMinutesBefore} disabled={lockSchedule} onChange={(e) => set('closeMinutesBefore', Number(e.target.value))}>
                {[0, 30, 60, 120, 180, 360, 720, 1440, 2880].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? '開始時截止' : m < 60 ? `開始前 ${m} 分鐘` : m < 1440 ? `開始前 ${m / 60} 小時` : `開始前 ${m / 1440} 天`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* 預覽 */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">場次預覽與衝突</h2>
              <p className="text-xs text-muted">
                {activityTimeLabel(form.startMinute, form.endMinute)}・{form.courtIds.length} 面場地・發布前必須先預覽，衝突日期要明確排除才能發布
              </p>
            </div>
            <Button type="button" size="sm" variant="secondary" loading={busy === 'preview'} onClick={runPreview}>
              <Eye className="h-4 w-4" aria-hidden />
              {preview ? '重新預覽' : '預覽場次'}
            </Button>
          </div>

          {preview && !previewFresh && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">排程設定已變更，請重新預覽</p>}

          {preview && (
            <>
              <p className="text-xs">
                可建立 <strong>{preview.counts.new}</strong> 場・已建立 {preview.counts.exists} 場・
                <span className={cn(preview.counts.conflict > 0 && 'font-semibold text-red-700')}>衝突 {preview.counts.conflict} 場</span>・已過時 {preview.counts.past} 場
                {preview.skipped.length > 0 && `・跳過 ${preview.skipped.map(shortDateLabel).join('、')}`}
              </p>
              {conflictRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span>有衝突的日期不會覆蓋既有訂單。可以改時段、換場地後重新預覽，或勾選排除。</span>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setExclude(new Set(conflictRows.map((r) => r.date)))}>
                    排除全部衝突日期
                  </Button>
                </div>
              )}
              <div className="max-h-[28rem] overflow-auto rounded-xl border border-[rgb(var(--border))]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-left text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 font-medium">日期</th>
                      <th className="px-3 py-2 font-medium">時間</th>
                      <th className="px-3 py-2 font-medium">場地</th>
                      <th className="px-3 py-2 font-medium">開放報名</th>
                      <th className="px-3 py-2 font-medium">狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border))]">
                    {preview.rows.map((r) => (
                      <tr key={r.date} className={cn(exclude.has(r.date) && 'opacity-50')}>
                        <td className="px-3 py-2 whitespace-nowrap">{r.dateLabel}</td>
                        <td className="px-3 py-2 whitespace-nowrap tabular">{r.timeLabel}</td>
                        <td className="px-3 py-2">{r.courtNames.join('、')}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted tabular">{r.opensAt}</td>
                        <td className="px-3 py-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[r.status])}>{STATUS_TEXT[r.status]}</span>
                          {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
                          {r.conflicts.map((c, i) => (
                            <p key={i} className="mt-1 text-xs text-red-700">
                              {c.courtName} {fmt(c.startMinute)}–{fmt(c.endMinute)}：{c.reason}
                            </p>
                          ))}
                          {r.status === 'CONFLICT' && (
                            <label className="mt-1 flex items-center gap-1.5 text-xs">
                              <input
                                type="checkbox"
                                checked={exclude.has(r.date)}
                                onChange={(e) => {
                                  const next = new Set(exclude)
                                  if (e.target.checked) next.add(r.date)
                                  else next.delete(r.date)
                                  setExclude(next)
                                }}
                              />
                              排除這一天（記入跳過日期）
                            </label>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{result.message}</p>
            {result.failed.map((f) => (
              <p key={f.date} className="text-xs text-red-700">
                {shortDateLabel(f.date)}：{f.reason}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 動作 */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))]/95 px-4 py-3 backdrop-blur">
        {!published && (
          <label className="mr-auto flex items-center gap-2 text-xs text-muted">
            草稿保留場地
            <select className="h-9 rounded-lg border border-[rgb(var(--border))] px-2 text-xs" value={holdDays} onChange={(e) => setHoldDays(Number(e.target.value))}>
              <option value={0}>不保留（草稿不佔場地）</option>
              <option value={1}>保留 1 天後自動釋放</option>
              <option value={3}>保留 3 天後自動釋放</option>
              <option value={7}>保留 7 天後自動釋放</option>
            </select>
          </label>
        )}
        <Button type="button" variant="secondary" loading={busy === 'draft'} onClick={() => save('draft')}>
          <Save className="h-4 w-4" aria-hidden />
          {published ? '儲存變更' : holdDays > 0 ? '存草稿並保留場地' : '儲存草稿'}
        </Button>
        <Button
          type="button"
          loading={busy === 'publish'}
          disabled={!previewFresh || unresolved.length > 0 || (preview?.error ?? null) !== null || form.courtIds.length === 0}
          onClick={() => save('publish')}
          title={form.courtIds.length === 0 ? '請先選擇使用場地' : !previewFresh ? '請先預覽場次' : unresolved.length > 0 ? '請先處理衝突日期' : undefined}
        >
          {published ? <CalendarCheck2 className="h-4 w-4" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {published ? '建立新增的場次' : `發布${preview ? `（${preview.counts.new} 場）` : ''}`}
        </Button>
      </div>
    </div>
  )
}
