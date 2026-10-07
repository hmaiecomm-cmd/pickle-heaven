'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Field, Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { DateStrip } from '@/components/booking/date-strip'
import { MatrixLegend, SlotMatrix } from '@/components/booking/slot-matrix'
import { blockSlot, unblockSlot } from '@/server/admin-actions'
import { formatDateFull, formatRange } from '@/lib/time'
import type { AvailabilityDTO, SlotState } from '@/lib/types'

/**
 * 後台場地時段管理。
 * 沿用前台同一個矩陣元件，管理者點擊可預約的格子即可鎖定為維護時段，
 * 已鎖定的格子再點一次即解除。客人的訂單不會被此處誤刪。
 */
export function AdminScheduleClient({
  data,
  date,
  dates,
}: {
  data: AvailabilityDTO
  date: string
  dates: string[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingKey, setPendingKey] = React.useState<string | null>(null)
  const [target, setTarget] = React.useState<{ courtId: string; courtName: string; start: number; end: number } | null>(
    null,
  )
  const [note, setNote] = React.useState('場館維護')
  const [busy, setBusy] = React.useState(false)

  const handleToggle = async (courtId: string, start: number, state: SlotState) => {
    const court = data.courts.find((c) => c.id === courtId)
    const time = data.times.find((t) => t.start === start)
    if (!court || !time) return

    if (state === 'AVAILABLE') {
      setTarget({ courtId, courtName: court.name, start, end: time.end })
      return
    }

    // 已鎖定 → 解除
    setPendingKey(`${courtId}@${start}`)
    try {
      const res = await unblockSlot(courtId, date, start)
      toast(res.ok ? (res.message ?? '已解除') : res.error, res.ok ? 'success' : 'error')
      if (res.ok) router.refresh()
    } finally {
      setPendingKey(null)
    }
  }

  const confirmBlock = async () => {
    if (!target) return
    setBusy(true)
    try {
      const res = await blockSlot(target.courtId, date, target.start, note)
      toast(res.ok ? (res.message ?? '已鎖定') : res.error, res.ok ? 'success' : 'error')
      if (res.ok) {
        setTarget(null)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  // 後台把「維護中」也視為可互動，以便解除鎖定
  const adminData: AvailabilityDTO = {
    ...data,
    cells: data.cells.map((row) => row.map((cell) => (cell === 'BLOCKED' ? 'SELECTED' : cell))),
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">場地時段管理</h1>
        <p className="mt-1 text-sm text-muted">
          點選空白時段可鎖定為維護時間；已鎖定（綠色）的時段再點一次即可解除。
        </p>
      </div>

      <DateStrip
        dates={dates}
        value={date}
        onChange={(next) => router.push(`/admin/schedule?date=${next}`)}
      />

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{formatDateFull(date)}</h2>
            <span className="text-xs text-muted">{data.venue.name}</span>
          </div>
          <SlotMatrix data={adminData} pendingKey={pendingKey} onToggle={handleToggle} onOpenEvent={(id) => router.push(`/admin/sessions/${id}`)} />
          <MatrixLegend />
          <p className="text-[11px] text-muted">註：此頁的綠色格子代表「已鎖定的維護時段」，非客人的預約。紫色區塊是活動場次，點擊可查看名單；活動時段請到「活動」頁修改。</p>
        </CardContent>
      </Card>

      <Sheet open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <SheetContent
          title="鎖定時段"
          description={
            target ? `${target.courtName} ${formatRange(target.start, target.end)}，鎖定後客人將無法預約` : ''
          }
        >
          <div className="space-y-4">
            <Field label="鎖定原因" hint="會顯示在後台紀錄中">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：地墊保養" />
            </Field>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setTarget(null)}>
                取消
              </Button>
              <Button className="flex-1" loading={busy} onClick={confirmBlock}>
                確定鎖定
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
