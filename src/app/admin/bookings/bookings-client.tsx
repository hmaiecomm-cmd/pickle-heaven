'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookingStatusBadge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { useToast } from '@/components/ui/toast'
import { adminCancelBooking, markCompleted } from '@/server/admin-actions'
import { formatDateFull } from '@/lib/time'
import { ntd } from '@/lib/utils'

export interface AdminBookingRow {
  id: string
  code: string
  status: string
  playDate: string
  venueName: string
  contactName: string
  contactPhone: string
  total: number
  note: string | null
  createdAt: string
  slots: string[]
}

const STATUS_FILTERS = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待付款' },
  { value: 'PAID', label: '已確認' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
]

export function AdminBookingsClient({
  rows,
  query,
  status,
  date,
}: {
  rows: AdminBookingRow[]
  query: string
  status: string
  date: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [q, setQ] = React.useState(query)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const applyFilter = (next: { q?: string; status?: string; date?: string }) => {
    const params = new URLSearchParams()
    const merged = { q, status, date, ...next }
    if (merged.q) params.set('q', merged.q)
    if (merged.status) params.set('status', merged.status)
    if (merged.date) params.set('date', merged.date)
    router.push(`/admin/bookings${params.toString() ? `?${params}` : ''}`)
  }

  const handleCancel = async (row: AdminBookingRow) => {
    if (!window.confirm(`確定要取消訂單 ${row.code}？系統將全額回補點數給客人。`)) return
    setBusyId(row.id)
    try {
      const res = await adminCancelBooking(row.id)
      toast(res.ok ? (res.message ?? '已取消') : res.error, res.ok ? 'success' : 'error')
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  const handleComplete = async (row: AdminBookingRow) => {
    setBusyId(row.id)
    try {
      const res = await markCompleted(row.id)
      toast(res.ok ? (res.message ?? '已更新') : res.error, res.ok ? 'success' : 'error')
      if (res.ok) router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">訂單管理</h1>

      <Card>
        <CardContent className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              applyFilter({ q })
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--fg-muted))]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜尋訂單編號、姓名或手機"
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary">
              搜尋
            </Button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => applyFilter({ status: f.value })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === f.value ? 'bg-ink-900 text-white' : 'surface-2 text-muted hover:text-[rgb(var(--fg))]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">沒有符合條件的訂單</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular">{row.code}</span>
                        <BookingStatusBadge status={row.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {formatDateFull(row.playDate)} · {row.venueName}
                      </p>
                    </div>
                    <span className="text-lg font-semibold tabular">{ntd(row.total)}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {row.slots.map((s, i) => (
                      <span key={i} className="rounded-lg surface-2 px-2 py-1 text-[11px] text-muted tabular">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[rgb(var(--border))] pt-2.5 text-xs">
                    <span className="text-muted">
                      {row.contactName} · <span className="tabular">{row.contactPhone}</span>
                      {row.note && ` · 備註：${row.note}`}
                    </span>
                    <div className="flex gap-2">
                      {row.status === 'PAID' && (
                        <Button size="sm" variant="ghost" disabled={busyId === row.id} onClick={() => handleComplete(row)}>
                          標記完成
                        </Button>
                      )}
                      {(row.status === 'PAID' || row.status === 'PENDING') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          disabled={busyId === row.id}
                          onClick={() => handleCancel(row)}
                        >
                          取消訂單
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
