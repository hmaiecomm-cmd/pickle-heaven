'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleCheck, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MonitorAuditEntry, MonitorEvent } from '@/server/camera-service'
import { incidentUpdateAction } from '@/server/admin-ops-actions'
import { useToast } from '@/components/ui/toast'

const STATUS: Record<MonitorEvent['status'], { label: string; cls: string }> = {
  OPEN: { label: '待處理', cls: 'bg-red-50 text-red-700 ring-red-200' },
  ACKED: { label: '處理中', cls: 'bg-amber-50 text-amber-900 ring-amber-200' },
  RESOLVED: { label: '已結案', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
}
const SEVERITY: Record<string, string> = { HIGH: '高', MEDIUM: '中', LOW: '低' }
const FILTERS = [
  ['open', '未處理'],
  ['resolved', '已結案'],
  ['all', '全部'],
] as const
type Filter = (typeof FILTERS)[number][0]

const fmt = (iso: string) => new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const actorName = (a: string | null) => (!a ? '—' : a === 'system' ? '系統' : a.replace(/^admin:/, ''))

/** 事件紀錄：只列系統實際偵測到的事件，不產生示範事件 */
export function EventsView({ events, audit, canHandle }: { events: MonitorEvent[]; audit: MonitorAuditEntry[]; canHandle: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [filter, setFilter] = React.useState<Filter>('open')
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState<string | null>(null)

  const shown = events.filter((e) => (filter === 'all' ? true : filter === 'open' ? e.status !== 'RESOLVED' : e.status === 'RESOLVED'))
  const count = (f: Filter) => events.filter((e) => (f === 'all' ? true : f === 'open' ? e.status !== 'RESOLVED' : e.status === 'RESOLVED')).length

  const update = async (id: string, status: 'ACKED' | 'RESOLVED') => {
    setBusy(id)
    const r = await incidentUpdateAction(id, status, notes[id] ?? '')
    setBusy(null)
    if (!r.ok) return toast(r.error, 'error')
    toast(status === 'RESOLVED' ? '已結案' : '已標記處理中', 'success')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="events-title" className="rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <h2 id="events-title" className="mr-auto text-[13px] font-semibold">
            監控事件
          </h2>
          <div role="tablist" aria-label="事件篩選" className="flex rounded-lg bg-zinc-100 p-0.5">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn('h-8 rounded-md px-3 text-xs font-medium', filter === key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500')}
              >
                {label} {count(key)}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm">
            <p className="flex items-center justify-center gap-1.5 font-medium text-zinc-700">
              <CircleCheck className="h-4 w-4 text-zinc-400" aria-hidden />
              {filter === 'open' ? '目前沒有未處理的監控事件' : '沒有符合的事件'}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">事件由系統偵測自動建立（設備離線、回報逾時、場地使用異常）。攝影機尚未串接，因此不會產生攝影機離線或遮蔽事件；這不代表攝影機運作正常。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">時間</th>
                  <th className="px-2 py-2 font-medium">來源</th>
                  <th className="px-2 py-2 font-medium">事件</th>
                  <th className="px-2 py-2 font-medium">狀態</th>
                  <th className="px-4 py-2 font-medium">處理備註</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 align-top">
                {shown.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-600">{fmt(e.createdAt)}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs">
                      {e.typeLabel}
                      <span className="ml-1 text-muted">・{SEVERITY[e.severity] ?? e.severity}</span>
                    </td>
                    <td className="px-2 py-2.5">
                      {e.link ? (
                        <Link href={e.link} className="font-medium hover:underline">
                          {e.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{e.title}</span>
                      )}
                      {e.detail && <p className="text-xs text-muted">{e.detail}</p>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', STATUS[e.status].cls)}>{STATUS[e.status].label}</span>
                      {e.resolvedBy && <p className="mt-1 text-[11px] text-muted">{actorName(e.resolvedBy)}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.note && <p className="mb-1 text-xs text-zinc-700">{e.note}</p>}
                      {canHandle && e.status !== 'RESOLVED' && (
                        <div className="flex flex-wrap gap-1.5">
                          <input
                            value={notes[e.id] ?? ''}
                            onChange={(ev) => setNotes({ ...notes, [e.id]: ev.target.value })}
                            placeholder="處理備註"
                            maxLength={300}
                            aria-label="處理備註"
                            className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 text-xs"
                          />
                          {e.status === 'OPEN' && (
                            <button type="button" disabled={busy === e.id} onClick={() => update(e.id, 'ACKED')} className="h-8 rounded-lg border border-zinc-200 px-2 text-xs">
                              處理中
                            </button>
                          )}
                          <button type="button" disabled={busy === e.id} onClick={() => update(e.id, 'RESOLVED')} className="h-8 rounded-lg bg-[#2f7d3b] px-2 text-xs font-semibold text-white">
                            結案
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!canHandle && <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-muted">目前角色只能查看事件；確認、結案與備註需要「處理監控事件」權限。</p>}
      </section>

      <section aria-labelledby="audit-title" className="rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(16,24,16,0.05)]">
        <h2 id="audit-title" className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-3 text-[13px] font-semibold">
          <History className="h-4 w-4 text-zinc-400" aria-hidden />
          操作紀錄
        </h2>
        {audit.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">尚無操作紀錄。修改攝影機、連線測試、截圖、處理事件都會記錄在這裡。</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {audit.map((a) => (
              <li key={a.id} className="grid gap-1 px-4 py-2 text-sm sm:grid-cols-[7.5rem_8rem_minmax(0,1fr)]">
                <span className="text-xs text-muted">{fmt(a.createdAt)}</span>
                <span className="truncate text-xs font-medium">{actorName(a.actor)}</span>
                <span className="min-w-0">
                  {a.target && <span className="text-zinc-500">{a.target}・</span>}
                  {a.summary}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
