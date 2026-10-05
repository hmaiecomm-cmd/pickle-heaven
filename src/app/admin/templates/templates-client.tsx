'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import {
  createTemplate,
  generateNow,
  toggleTemplate,
  updateTemplate,
  type TemplateInput,
  type TemplateResult,
} from '@/server/template-admin-actions'

/** 週期性範本管理（規格 §10、§14、§20）。 */

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const

export type TemplateRow = TemplateInput & { id: string; venueName: string; sessionCount: number }

const EMPTY: TemplateInput = {
  title: '',
  weekday: 2,
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
  generateWeeksAhead: 10,
  active: true,
}

const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fromTime = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function TemplatesClient({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = React.useTransition()
  const [editing, setEditing] = React.useState<string | 'new' | null>(null)
  const [form, setForm] = React.useState<TemplateInput>(EMPTY)

  const run = (action: () => Promise<TemplateResult>, onDone?: () => void) => {
    startTransition(async () => {
      const result = await action()
      toast(result.message, result.ok ? 'success' : 'error')
      if (result.ok) {
        onDone?.()
        router.refresh()
      }
    })
  }

  const openNew = () => {
    setForm(EMPTY)
    setEditing('new')
  }

  const openEdit = (t: TemplateRow) => {
    const { id: _id, venueName: _v, sessionCount: _c, ...rest } = t
    setForm(rest)
    setEditing(t.id)
  }

  const set = <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">週期性範本</h1>
          <p className="mt-0.5 text-xs text-muted">排程會依範本自動產生未來場次</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={pending} onClick={() => run(generateNow)}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            立即產生
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden />
            新增
          </Button>
        </div>
      </div>

      {templates.length === 0 && editing === null ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">
            還沒有任何範本。按「新增」建立第一個。
          </CardContent>
        </Card>
      ) : null}

      {templates.map((t) => (
        <Card key={t.id}>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{t.title}</h2>
                <p className="mt-0.5 text-sm text-muted">
                  每{WEEKDAYS[t.weekday]} {toTime(t.startMinute)}–{toTime(t.endMinute)}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t.venueName}　{t.capacity} 人
                  {t.reservedCapacity > 0 ? `（保留 ${t.reservedCapacity}）` : ''}　NT${t.price}
                  　已產生 {t.sessionCount} 場
                </p>
              </div>
              <Badge variant={t.active ? 'success' : 'neutral'}>{t.active ? '啟用中' : '已停用'}</Badge>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => openEdit(t)} disabled={pending}>
                編輯
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={pending}
                onClick={() => run(() => toggleTemplate(t.id, !t.active))}
              >
                {t.active ? '停用' : '啟用'}
              </Button>
            </div>

            {editing === t.id ? (
              <TemplateForm
                form={form}
                set={set}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSave={() => run(() => updateTemplate(t.id, form), () => setEditing(null))}
              />
            ) : null}
          </CardContent>
        </Card>
      ))}

      {editing === 'new' ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-sm font-semibold">新增範本</h2>
            <TemplateForm
              form={form}
              set={set}
              pending={pending}
              onCancel={() => setEditing(null)}
              onSave={() => run(() => createTemplate(form), () => setEditing(null))}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function TemplateForm({
  form,
  set,
  pending,
  onCancel,
  onSave,
}: {
  form: TemplateInput
  set: <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) => void
  pending: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="space-y-4 border-t border-[rgb(var(--border))] pt-4">
      <Field label="名稱" htmlFor="t-title">
        <Input id="t-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="星期" htmlFor="t-weekday">
          <select
            id="t-weekday"
            value={form.weekday}
            onChange={(e) => set('weekday', Number(e.target.value))}
            className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]"
          >
            {WEEKDAYS.map((w, i) => (
              <option key={w} value={i}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <Field label="開始" htmlFor="t-start">
          <Input
            id="t-start"
            type="time"
            value={toTime(form.startMinute)}
            onChange={(e) => set('startMinute', fromTime(e.target.value))}
          />
        </Field>
        <Field label="結束" htmlFor="t-end">
          <Input
            id="t-end"
            type="time"
            value={toTime(form.endMinute)}
            onChange={(e) => set('endMinute', fromTime(e.target.value))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="總容量" htmlFor="t-cap">
          <Input
            id="t-cap"
            type="number"
            min={1}
            value={form.capacity}
            onChange={(e) => set('capacity', Number(e.target.value))}
          />
        </Field>
        <Field label="保留名額" htmlFor="t-res">
          <Input
            id="t-res"
            type="number"
            min={0}
            value={form.reservedCapacity}
            onChange={(e) => set('reservedCapacity', Number(e.target.value))}
          />
        </Field>
        <Field label="價格" htmlFor="t-price">
          <Input
            id="t-price"
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => set('price', Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="程度下限" hint="留空表示不限" htmlFor="t-smin">
          <Input
            id="t-smin"
            type="number"
            step="0.5"
            value={form.skillLevelMin ?? ''}
            onChange={(e) => set('skillLevelMin', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="程度上限" htmlFor="t-smax">
          <Input
            id="t-smax"
            type="number"
            step="0.5"
            value={form.skillLevelMax ?? ''}
            onChange={(e) => set('skillLevelMax', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="提前幾天開放" htmlFor="t-days">
          <Input
            id="t-days"
            type="number"
            min={0}
            value={form.bookingOpenDaysBefore}
            onChange={(e) => set('bookingOpenDaysBefore', Number(e.target.value))}
          />
        </Field>
        <Field label="時間位移（小時）" hint="+1 表示比開打時間晚 1 小時" htmlFor="t-off">
          <Input
            id="t-off"
            type="number"
            value={form.bookingOpenHourOffset}
            onChange={(e) => set('bookingOpenHourOffset', Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="取消截止規則" htmlFor="t-mode">
        <select
          id="t-mode"
          value={form.cancellationMode}
          onChange={(e) => set('cancellationMode', e.target.value as TemplateInput['cancellationMode'])}
          className="h-11 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-[15px]"
        >
          <option value="PREVIOUS_DAY_MIDNIGHT">前一日 00:00</option>
          <option value="HOURS_BEFORE_START">開打前 N 小時</option>
          <option value="CUSTOM_TIMESTAMP">每場自訂</option>
        </select>
      </Field>

      {form.cancellationMode === 'HOURS_BEFORE_START' ? (
        <Field label="開打前幾小時截止" htmlFor="t-hours">
          <Input
            id="t-hours"
            type="number"
            min={0}
            value={form.cancellationHoursBefore ?? 24}
            onChange={(e) => set('cancellationHoursBefore', Number(e.target.value))}
          />
        </Field>
      ) : null}

      <Field label="預先產生幾週" hint="規格建議 8–12 週，不要無限產生" htmlFor="t-weeks">
        <Input
          id="t-weeks"
          type="number"
          min={1}
          max={52}
          value={form.generateWeeksAhead}
          onChange={(e) => set('generateWeeksAhead', Number(e.target.value))}
        />
      </Field>

      <div className="space-y-2">
        <Check label="開放候補" checked={form.waitlistEnabled} onChange={(v) => set('waitlistEnabled', v)} />
        <Check label="自動遞補" checked={form.autoPromote} onChange={(v) => set('autoPromote', v)} />
        <Check
          label="鎖定後仍可遞補"
          checked={form.allowPostLockReplacement}
          onChange={(v) => set('allowPostLockReplacement', v)}
        />
        <Check label="啟用此範本" checked={form.active} onChange={(v) => set('active', v)} />
      </div>

      <div className="flex gap-2">
        <Button block loading={pending} onClick={onSave}>
          儲存
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          取消
        </Button>
      </div>
    </div>
  )
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[rgb(var(--border))] accent-brand-600"
      />
      <span className="text-sm">{label}</span>
    </label>
  )
}
