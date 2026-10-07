'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { MapPinPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { EditImpactRow } from '@/server/activity-admin'
import { applySessionEditAction, previewSessionEditAction } from '@/server/activity-admin-actions'

/**
 * 既有球敘補填使用場地：先檢查衝突，確認後才建立場地占用。
 * 不會自動指派到任何場地；由管理者明確勾選。
 */
export function FixCourtsButton({
  sessionId,
  label,
  courts,
  currentCourtIds,
}: {
  sessionId: string
  label: string
  courts: { id: string; name: string; active: boolean }[]
  currentCourtIds: string[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [courtIds, setCourtIds] = React.useState<string[]>(currentCourtIds)
  const [impact, setImpact] = React.useState<EditImpactRow[] | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => setImpact(null), [courtIds])

  const input = { sessionId, scope: 'ONE' as const, changes: { courtIds } }
  const row = impact?.[0]

  const preview = async () => {
    setBusy(true)
    try {
      const res = await previewSessionEditAction(input)
      if (!res.ok) return toast(res.message, 'error')
      setImpact(res.rows)
    } finally {
      setBusy(false)
    }
  }
  const apply = async () => {
    setBusy(true)
    try {
      const res = await applySessionEditAction(input, true)
      if (!res.ok) return toast(res.message, 'error')
      if (res.skipped.length > 0) return toast(`未建立占用：${res.skipped[0].reason}`, 'error')
      toast('已補填場地並建立占用', 'success')
      setOpen(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <MapPinPlus className="h-4 w-4" aria-hidden />
        {currentCourtIds.length === 0 ? '補填使用場地' : '調整場地'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent title="補填使用場地" description={label}>
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">使用場地（可多選）</legend>
              <div className="flex flex-wrap gap-2">
                {courts.map((c) => (
                  <label
                    key={c.id}
                    className={cn('flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm', courtIds.includes(c.id) ? 'border-brand-600 bg-brand-50' : 'border-[rgb(var(--border))]', !c.active && 'opacity-50')}
                  >
                    <input
                      type="checkbox"
                      disabled={!c.active}
                      checked={courtIds.includes(c.id)}
                      onChange={(e) => setCourtIds(e.target.checked ? [...courtIds, c.id] : courtIds.filter((x) => x !== c.id))}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>

            {row && (
              <div className={cn('rounded-xl px-3 py-2 text-sm', row.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800')}>
                {row.ok ? (
                  <p>沒有衝突，確認後會建立 {row.timeLabel} 的場地占用；期間不開放一般租借。</p>
                ) : (
                  <>
                    <p className="font-semibold">有衝突，不能直接占用：</p>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {row.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                      {row.conflicts.map((c, i) => (
                        <li key={i}>
                          {c.courtName}：{c.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs">請改選其他場地，或到活動頁改時段／取消這場。</p>
                  </>
                )}
              </div>
            )}

            <div className="flex gap-2 border-t border-[rgb(var(--border))] pt-4">
              <Button size="sm" variant="secondary" loading={busy && !impact} disabled={courtIds.length === 0} onClick={preview}>
                檢查衝突
              </Button>
              <Button size="sm" loading={busy && Boolean(impact)} disabled={!row?.ok} onClick={apply}>
                確認建立占用
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                取消
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
