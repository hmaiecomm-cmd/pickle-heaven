'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/admin/page-bits'
import { resendSlotPasswordAction } from './actions'

export interface SlotRecordBooking {
  bookingId: string
  code: string
  holder: string
  valid: boolean
  sendStatus: string | null
  failureReason: string | null
  retryCount: number
  sentAt: string | null
}

export interface SlotRecord {
  id: string
  date: string
  slotLabel: string
  maskedCode: string
  openAt: string
  expireAt: string
  activeOrderCount: number
  status: string
  bookings: SlotRecordBooking[]
}

export interface SlotStats {
  modeLabel: string
  openLabel: string
  expireLabel: string
  generateAheadDays: number
  bookAheadDays: number
  shared: boolean
  futureSlots: number
  lineSent: number
  lineFailed: number
}

const STATUS_LABEL: Record<string, { label: string; tone: 'green' | 'amber' | 'red' | 'gray' | 'blue' }> = {
  SCHEDULED: { label: '排程中', tone: 'blue' },
  ACTIVE: { label: '開放中', tone: 'green' },
  LOCKED: { label: '已鎖定', tone: 'red' },
  EXPIRED: { label: '已失效', tone: 'gray' },
  CANCELLED: { label: '已作廢', tone: 'gray' },
}

const SEND_LABEL: Record<string, string> = { SENT: 'LINE 已發送', FAILED: 'LINE 發送失敗', PENDING: '發送中', RETRYING: '重試中' }

function ResendButton({ slotId, bookingId }: { slotId: string; bookingId: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true)
          setMsg(null)
          const r = await resendSlotPasswordAction(slotId, bookingId)
          setBusy(false)
          setMsg(r.ok ? r.message : r.error)
          if (r.ok) router.refresh()
        }}
      >
        重新發送
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  )
}

export function SlotPasswordRecords({ stats, records }: { stats: SlotStats; records: SlotRecord[] }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold">密碼時段記錄</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          <div><dt className="text-muted">產生模式</dt><dd>{stats.modeLabel}</dd></div>
          <div><dt className="text-muted">開放時間</dt><dd>{stats.openLabel}</dd></div>
          <div><dt className="text-muted">失效時間</dt><dd>{stats.expireLabel}</dd></div>
          <div><dt className="text-muted">提前預約／產生天數</dt><dd>{stats.bookAheadDays} 天／{stats.generateAheadDays} 天</dd></div>
          <div><dt className="text-muted">時段共用密碼</dt><dd>{stats.shared ? '啟用' : '關閉（每筆獨立）'}</dd></div>
          <div><dt className="text-muted">未來密碼時段</dt><dd>{stats.futureSlots} 個</dd></div>
          <div><dt className="text-muted">LINE 發送成功</dt><dd className="text-emerald-700">{stats.lineSent} 筆</dd></div>
          <div><dt className="text-muted">LINE 發送失敗</dt><dd className={stats.lineFailed ? 'text-red-700' : ''}>{stats.lineFailed} 筆</dd></div>
        </dl>
      </div>

      {records.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">目前沒有已建立密碼的時段。顧客付款成功後會自動建立。</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {records.map((r) => {
            const st = STATUS_LABEL[r.status] ?? { label: r.status, tone: 'gray' as const }
            return (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{r.date}</span>
                  <span>{r.slotLabel}</span>
                  <span className="font-mono tracking-wider">{r.maskedCode}</span>
                  <Pill tone={st.tone}>{st.label}</Pill>
                  <span className="text-xs text-muted">有效訂單 {r.activeOrderCount}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  開放 {r.openAt} ・ 失效 {r.expireAt}
                </p>
                {r.bookings.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.bookings.map((b) => (
                      <li key={b.bookingId} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={b.valid ? '' : 'text-muted line-through'}>{b.code}</span>
                        <span className="text-muted">{b.holder}</span>
                        {b.sendStatus && (
                          <span className={b.sendStatus === 'SENT' ? 'text-emerald-700' : b.sendStatus === 'FAILED' ? 'text-red-700' : 'text-muted'}>
                            {SEND_LABEL[b.sendStatus] ?? b.sendStatus}
                            {b.sendStatus === 'FAILED' && b.failureReason ? `：${b.failureReason}` : ''}
                            {b.retryCount > 0 ? `（重試 ${b.retryCount} 次）` : ''}
                          </span>
                        )}
                        {b.valid && (r.status === 'SCHEDULED' || r.status === 'ACTIVE') && <ResendButton slotId={r.id} bookingId={b.bookingId} />}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
