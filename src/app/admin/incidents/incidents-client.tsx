'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { Pill } from '@/components/admin/page-bits'
import { useAi } from '@/components/admin/ai-context'
import { incidentUpdateAction } from '@/server/admin-ops-actions'

interface Row {
  id: string
  type: string
  severity: string
  title: string
  detail: string | null
  link: string | null
  status: string
  note: string | null
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

const STATUS = { OPEN: { l: '待處理', t: 'red' }, ACKED: { l: '處理中', t: 'amber' }, RESOLVED: { l: '已解除', t: 'green' } } as const

export function IncidentsClient({ rows, showAll }: { rows: Row[]; showAll: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const { ask } = useAi()
  const [notes, setNotes] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState<string | null>(null)

  const update = async (id: string, status: 'ACKED' | 'RESOLVED') => {
    setBusy(id)
    try {
      const res = await incidentUpdateAction(id, status, notes[id] ?? '')
      if (!res.ok) toast(res.error, 'error')
      else router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/incidents" className={`rounded-full px-3 py-1 ${!showAll ? 'bg-brand-100 font-semibold text-brand-800' : 'bg-white ring-1 ring-zinc-200'}`}>待處理</Link>
        <Link href="/admin/incidents?all=1" className={`rounded-full px-3 py-1 ${showAll ? 'bg-brand-100 font-semibold text-brand-800' : 'bg-white ring-1 ring-zinc-200'}`}>全部紀錄</Link>
        <button type="button" onClick={() => ask('今天有哪些異常？')} className="ml-auto rounded-full bg-white px-3 py-1 ring-1 ring-zinc-200 hover:bg-violet-50">請小匹整理</button>
      </div>
      {rows.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-muted">沒有事件</p>}
      {rows.map((r) => {
        const st = STATUS[r.status as keyof typeof STATUS] ?? STATUS.OPEN
        return (
          <article key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{r.link ? <Link href={r.link} className="hover:underline">{r.title}</Link> : r.title}</p>
                {r.detail && <p className="text-sm text-muted">{r.detail}</p>}
                <p className="mt-1 text-[11px] text-muted">
                  建立 {new Date(r.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}
                  {r.resolvedAt && `・解除 ${new Date(r.resolvedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false })}（${r.resolvedBy}）`}
                </p>
                {r.note && <p className="mt-1 text-xs">處理說明：{r.note}</p>}
              </div>
              <div className="flex gap-1">
                <Pill tone={r.severity === 'HIGH' ? 'red' : r.severity === 'MEDIUM' ? 'amber' : 'gray'}>{r.severity === 'HIGH' ? '高' : r.severity === 'MEDIUM' ? '中' : '低'}</Pill>
                <Pill tone={st.t}>{st.l}</Pill>
              </div>
            </div>
            {r.status !== 'RESOLVED' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={notes[r.id] ?? ''}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  placeholder="處理說明（選填）"
                  maxLength={300}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 text-sm"
                  aria-label="處理說明"
                />
                {r.status === 'OPEN' && (
                  <button type="button" disabled={busy === r.id} onClick={() => update(r.id, 'ACKED')} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm">標記處理中</button>
                )}
                <button type="button" disabled={busy === r.id} onClick={() => update(r.id, 'RESOLVED')} className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white">標記已解除</button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
