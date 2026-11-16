'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Pill } from '@/components/admin/page-bits'
import { formatDateTime } from '@/lib/time'
import { ACCESS_SCHEDULE_STATUS_LABEL, ACCESS_SCHEDULE_STATUS_TONE, type AccessSchedule } from '@/lib/door-access-types'

export interface AccessScheduleManagerProps {
  schedules: AccessSchedule[]
  canManage: boolean
}

export function AccessScheduleManager({ schedules, canManage }: AccessScheduleManagerProps) {
  const router = useRouter()
  const [creatingSchedule, setCreatingSchedule] = React.useState(false)
  const [formData, setFormData] = React.useState<{
    scheduleName: string
    startAt: string
    endAt: string
    reason: string
    notes: string
  }>({
    scheduleName: '',
    startAt: '',
    endAt: '',
    reason: '',
    notes: '',
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const [cancellingId, setCancellingId] = React.useState<string | null>(null)
  const [cancelReason, setCancelReason] = React.useState('')

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.scheduleName.trim()) newErrors.scheduleName = '排程名稱不能為空'
    if (!formData.startAt) newErrors.startAt = '開始時間必須填寫'
    if (!formData.endAt) newErrors.endAt = '結束時間必須填寫'
    if (!formData.reason.trim()) newErrors.reason = '操作原因不能為空'

    if (formData.startAt && formData.endAt) {
      const start = new Date(formData.startAt)
      const end = new Date(formData.endAt)
      const now = new Date()

      if (start >= end) newErrors.endAt = '結束時間必須晚於開始時間'
      if (start <= now) newErrors.startAt = '開始時間不能早於現在'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    setBusy(true)
    try {
      // TODO: Phase 2 - 呼叫 Server Action 建立排程
      console.log('建立排程:', formData)
      // 暫時模擬成功
      setFormData({
        scheduleName: '',
        startAt: '',
        endAt: '',
        reason: '',
        notes: '',
      })
      setCreatingSchedule(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async (scheduleId: string) => {
    if (!cancelReason.trim()) {
      setErrors({ ...errors, cancelReason: '取消原因不能為空' })
      return
    }

    setBusy(true)
    try {
      // TODO: Phase 2 - 呼叫 Server Action 取消排程
      console.log('取消排程:', scheduleId, cancelReason)
      setCancellingId(null)
      setCancelReason('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">常開排程管理</h2>
          {canManage && (
            <Button size="sm" onClick={() => setCreatingSchedule(true)} disabled={busy}>
              <Calendar className="h-4 w-4" aria-hidden />
              新增排程
            </Button>
          )}
        </div>
      </div>

      {schedules.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">目前沒有常開排程</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">{schedule.scheduleName}</p>
                <p className="text-[11px] text-muted">原因：{schedule.reason}</p>
                {schedule.notes && <p className="text-[11px] text-muted">備註：{schedule.notes}</p>}
              </div>
              <p className="text-xs text-zinc-700">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden />
                  {formatDateTime(schedule.startAt)} → {formatDateTime(schedule.endAt)}
                </span>
              </p>
              <div className="flex items-center gap-2 justify-self-end">
                <Pill tone={ACCESS_SCHEDULE_STATUS_TONE[schedule.status as keyof typeof ACCESS_SCHEDULE_STATUS_TONE]}>
                  {ACCESS_SCHEDULE_STATUS_LABEL[schedule.status as keyof typeof ACCESS_SCHEDULE_STATUS_LABEL]}
                </Pill>
                {canManage && (schedule.status === 'SCHEDULED' || schedule.status === 'ACTIVE') && (
                  <Button size="sm" variant="ghost" onClick={() => setCancellingId(schedule.id)}>
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={creatingSchedule} onOpenChange={(o) => !o && setCreatingSchedule(false)}>
        <SheetContent title="新增常開排程" description="指定時段內大門保持常開，不上鎖">
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">排程名稱 *</label>
              <input
                type="text"
                value={formData.scheduleName}
                onChange={(e) => setFormData({ ...formData, scheduleName: e.target.value })}
                placeholder="例如：周末場地清潔"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={busy}
              />
              {errors.scheduleName && <p className="mt-1 text-xs text-red-600">{errors.scheduleName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">開始時間 *</label>
              <input
                type="datetime-local"
                value={formData.startAt}
                onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={busy}
              />
              {errors.startAt && <p className="mt-1 text-xs text-red-600">{errors.startAt}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">結束時間 *</label>
              <input
                type="datetime-local"
                value={formData.endAt}
                onChange={(e) => setFormData({ ...formData, endAt: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={busy}
              />
              {errors.endAt && <p className="mt-1 text-xs text-red-600">{errors.endAt}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">操作原因 *</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="例如：場地清潔、設備維修"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={busy}
              />
              {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">備註</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="選填"
                rows={3}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={busy}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button className="flex-1" onClick={handleCreate} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '建立排程'}
              </Button>
              <Button variant="secondary" onClick={() => setCreatingSchedule(false)} disabled={busy}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!cancellingId} onOpenChange={(o) => !o && setCancellingId(null)}>
        <SheetContent title="提前終止排程" description="此操作會立即結束常開狀態">
          <div className="space-y-4 text-sm">
            <p className="text-base font-semibold">確定要終止此排程嗎？</p>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">終止原因 *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="例如：提前完成清潔工作"
                rows={3}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                disabled={busy}
              />
              {errors.cancelReason && <p className="mt-1 text-xs text-red-600">{errors.cancelReason}</p>}
            </div>

            <div className="flex gap-2 pt-4">
              <Button className="flex-1" variant="danger" onClick={() => handleCancel(cancellingId!)} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '確認終止'}
              </Button>
              <Button variant="secondary" onClick={() => setCancellingId(null)} disabled={busy}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
