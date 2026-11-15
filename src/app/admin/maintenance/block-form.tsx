'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { blockSlot } from '@/server/admin-actions'
import { formatRange } from '@/lib/time'

export function BlockForm({
  courts,
  starts,
  slotMinutes,
  today,
  initial,
}: {
  courts: { id: string; name: string }[]
  starts: number[]
  slotMinutes: number
  today: string
  initial: { courtId?: string; date?: string; start?: number }
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [courtId, setCourtId] = React.useState(initial.courtId && courts.some((c) => c.id === initial.courtId) ? initial.courtId : (courts[0]?.id ?? ''))
  const [date, setDate] = React.useState(initial.date && initial.date >= today ? initial.date : today)
  const [start, setStart] = React.useState(initial.start !== undefined && starts.includes(initial.start) ? initial.start : (starts[0] ?? 0))
  const [note, setNote] = React.useState('場館維護')
  const [lighting, setLighting] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await blockSlot(courtId, date, start, note.trim(), lighting)
      toast(res.ok ? (res.message ?? '已封場') : res.error, res.ok ? 'success' : 'error')
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const selectCls = 'h-11 w-full rounded-xl border border-[rgb(var(--border))] bg-white px-3 text-[15px]'
  return (
    <form onSubmit={submit} aria-label="新增人工封場" className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto] sm:items-end">
      <Field label="場地" htmlFor="block-court">
        <select id="block-court" className={selectCls} value={courtId} onChange={(e) => setCourtId(e.target.value)}>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="日期" htmlFor="block-date">
        <Input id="block-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
      </Field>
      <Field label="時段" htmlFor="block-start">
        <select id="block-start" className={selectCls} value={start} onChange={(e) => setStart(Number(e.target.value))}>
          {starts.map((s) => (
            <option key={s} value={s}>
              {formatRange(s, s + slotMinutes)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="原因" htmlFor="block-note">
        <Input id="block-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="例如：地墊保養" />
      </Field>
      <Button type="submit" loading={busy} disabled={!courtId || starts.length === 0}>
        封場
      </Button>
      <label className="flex items-center gap-2 text-sm sm:col-span-5">
        <input type="checkbox" checked={lighting} onChange={(e) => setLighting(e.target.checked)} />
        需要照明（封場期間開啟該場的燈與風扇）
      </label>
    </form>
  )
}
