'use client'

import { useState } from 'react'
import { Download, FileBarChart2, Loader2, Play } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { getCourts, getExpenses, getMembers, getPayments, getReservations, getRevenue } from '@/lib/api-service'
import { downloadCsv } from '@/lib/csv'

/** 報表與分析（Phase 1I）。報表由 mock 資料即時彙整，可匯出 CSV。 */

type ReportType = 'revenue' | 'reservations' | 'members' | 'expenses' | 'utilization'
const REPORTS: { key: ReportType; label: string; desc: string }[] = [
  { key: 'revenue', label: '營收報表', desc: '依日期列出每筆營收，含類型、球場與付款方式' },
  { key: 'reservations', label: '預約報表', desc: '每筆預約的會員、項目、時段、金額與狀態' },
  { key: 'members', label: '會員報表', desc: '會員等級、加入日期、最近到訪與累計消費' },
  { key: 'expenses', label: '費用報表', desc: '每筆費用的類別、金額、提交日與審核狀態' },
  { key: 'utilization', label: '球場使用率', desc: '各球場的預約時數與使用率' },
]

interface Report {
  type: ReportType
  from: Date
  to: Date
  header: string[]
  rows: (string | number)[][]
  generatedAt: Date
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

async function build(type: ReportType, from: Date, to: Date): Promise<{ header: string[]; rows: (string | number)[][] }> {
  const inRange = (d: Date) => d >= from && d <= to
  switch (type) {
    case 'revenue': {
      const [r, c] = await Promise.all([getRevenue('year'), getCourts()])
      const courtName = (id?: string) => (id ? (c.data.find((x) => x.id === id)?.name ?? id) : '—')
      const rows = r.data.filter((x) => inRange(x.date)).sort((a, b) => a.date.getTime() - b.date.getTime())
      return { header: ['日期', '類型', '球場', '訂單', '付款方式', '金額'], rows: rows.map((x) => [fmtDate(x.date), x.type, courtName(x.courtId), x.reservationId, x.paymentMethod, x.amount]) }
    }
    case 'reservations': {
      const r = await getReservations()
      const rows = r.data.filter((x) => inRange(x.items[0]?.startTime ?? x.createdAt))
      return {
        header: ['訂單', '會員', '類型', '項目', '開始', '結束', '人數', '金額', '付款', '狀態'],
        rows: rows.map((x) => {
          const i = x.items[0]
          return [x.bookingCode, x.member?.name ?? '', x.type, i?.name ?? '', i ? `${fmtDate(i.startTime)} ${fmtTime(i.startTime)}` : '', i ? fmtTime(i.endTime) : '', i?.playerCount ?? '', x.totalAmount, x.paymentStatus, x.status]
        }),
      }
    }
    case 'members': {
      const m = await getMembers()
      return { header: ['姓名', '等級', 'Email', '電話', '加入日期', '最近到訪', '累計消費'], rows: m.data.map((x) => [x.name, x.membershipLevel, x.email, x.phone, fmtDate(x.joinDate), fmtDate(x.lastVisit), x.totalSpent]) }
    }
    case 'expenses': {
      const e = await getExpenses()
      const rows = e.data.filter((x) => inRange(x.submittedAt))
      return { header: ['費用編號', '類別', '說明', '金額', '提交日期', '狀態'], rows: rows.map((x) => [x.expenseNumber, x.category, x.description, x.amount, fmtDate(x.submittedAt), x.status]) }
    }
    case 'utilization': {
      const [c, r] = await Promise.all([getCourts(), getReservations()])
      const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
      const openHours = 13 // 09:00–22:00
      return {
        header: ['球場', '狀態', '期間天數', '可用時數', '預約時數', '預約筆數', '使用率'],
        rows: c.data.map((court) => {
          const items = r.data.flatMap((x) => x.items).filter((i) => i.courtId === court.id && inRange(i.startTime))
          const booked = items.reduce((s, i) => s + (i.endTime.getTime() - i.startTime.getTime()) / 3_600_000, 0)
          const avail = days * openHours
          return [court.name, court.status, days, avail, Math.round(booked * 10) / 10, items.length, `${Math.round((booked / avail) * 100)}%`]
        }),
      }
    }
  }
}

export function ReportsClient() {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const [type, setType] = useState<ReportType>('revenue')
  const [from, setFrom] = useState(iso(monthStart))
  const [to, setTo] = useState(iso(today))
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)

  const generate = async () => {
    const f = new Date(from)
    const t = new Date(to)
    t.setHours(23, 59, 59, 999)
    if (isNaN(f.getTime()) || isNaN(t.getTime()) || f > t) return
    setBusy(true)
    try {
      const [{ header, rows }] = await Promise.all([build(type, f, t), new Promise((r) => setTimeout(r, 600))])
      setReport({ type, from: f, to: t, header, rows, generatedAt: new Date() })
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    if (!report) return
    const meta = REPORTS.find((r) => r.key === report.type)!
    downloadCsv(`${meta.label}-${iso(report.from)}_${iso(report.to)}.csv`, report.header, report.rows)
  }

  const current = REPORTS.find((r) => r.key === type)!
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader title="報表與分析" subtitle="選擇報表類型與期間，產生後可預覽並匯出 CSV" />

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        {/* 報表類型 */}
        <nav className={`p-2 ${panelClass}`} aria-label="報表類型">
          <ul className="space-y-1">
            {REPORTS.map((r) => (
              <li key={r.key}>
                <button
                  onClick={() => setType(r.key)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${type === r.key ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'hover:surface-2'}`}
                >
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{r.desc}</p>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-4">
          {/* 期間與產生 */}
          <div className={`p-4 ${panelClass}`}>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="開始日期" htmlFor="rep-from">
                <Input id="rep-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="結束日期" htmlFor="rep-to">
                <Input id="rep-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Button onClick={generate} loading={busy} disabled={!from || !to || from > to}>
                <Play className="h-4 w-4" aria-hidden />
                產生報表
              </Button>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              {[
                { label: '本月', f: monthStart, t: today },
                { label: '上月', f: new Date(today.getFullYear(), today.getMonth() - 1, 1), t: new Date(today.getFullYear(), today.getMonth(), 0) },
                { label: '本季', f: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), t: today },
                { label: '今年', f: new Date(today.getFullYear(), 0, 1), t: today },
              ].map((p) => (
                <button key={p.label} onClick={() => { setFrom(iso(p.f)); setTo(iso(p.t)) }} className="rounded-full border border-[rgb(var(--border))] px-2.5 py-1 hover:surface-2">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 預覽 */}
          <div className={panelClass}>
            {busy ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                正在彙整{current.label}…
              </div>
            ) : !report ? (
              <EmptyState title={`尚未產生${current.label}`} description="選好期間後按「產生報表」" icon={<FileBarChart2 className="mx-auto h-8 w-8 text-muted" />} />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--border))] px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold">{REPORTS.find((r) => r.key === report.type)!.label}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {fmtDate(report.from)} – {fmtDate(report.to)}　{report.rows.length} 筆　產生於 {fmtTime(report.generatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="Mock 資料" variant="warning" size="sm" />
                    <Button size="sm" variant="secondary" onClick={exportCsv} disabled={report.rows.length === 0}>
                      <Download className="h-4 w-4" aria-hidden />
                      匯出 CSV
                    </Button>
                  </div>
                </div>
                {report.rows.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted">此期間沒有資料</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="text-left text-xs text-muted">
                        <tr className="border-b border-[rgb(var(--border))]">
                          {report.header.map((h) => (
                            <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border))]">
                        {report.rows.map((row, i) => (
                          <tr key={i} className="hover:surface-2">
                            {row.map((cell, j) => (
                              <td key={j} className={`whitespace-nowrap px-4 py-2.5 ${typeof cell === 'number' ? 'text-right font-mono' : ''}`}>
                                {typeof cell === 'number' ? cell.toLocaleString() : cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
