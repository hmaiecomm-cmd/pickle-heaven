'use client'

import { useEffect, useMemo, useState } from 'react'
import { Crown, DollarSign, Mail, Phone, Search, UserPlus, Users } from 'lucide-react'
import { PageHeader } from '@/components/layout'
import { EmptyState, ErrorState, KPICard, LoadingState, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { getMembers, getReservations } from '@/lib/api-service'
import { downloadCsv } from '@/lib/csv'
import type { Member, Reservation } from '@/lib/models'

/** 會員（Phase 1I）。資料來自 mock api-service。 */

type Level = Member['membershipLevel']
type SortKey = 'lastVisit' | 'totalSpent' | 'joinDate'

const LEVEL_META: Record<Level, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  VIP: { label: 'VIP', variant: 'warning' },
  PREMIUM: { label: '進階', variant: 'info' },
  BASIC: { label: '一般', variant: 'default' },
}
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'lastVisit', label: '最近到訪' },
  { key: 'totalSpent', label: '消費金額' },
  { key: 'joinDate', label: '加入日期' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
const fmtMoney = (n: number) => `NT$${n.toLocaleString()}`
const daysAgo = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))

export function MembersClient() {
  const [members, setMembers] = useState<Member[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [level, setLevel] = useState<Level | 'ALL'>('ALL')
  const [sort, setSort] = useState<SortKey>('lastVisit')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, r] = await Promise.all([getMembers(), getReservations()])
      if (!m.success) throw new Error(m.error?.message ?? '無法載入會員')
      setMembers(m.data)
      setReservations(r.success ? r.data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((m) => level === 'ALL' || m.membershipLevel === level)
      .filter((m) => !q || `${m.name} ${m.email} ${m.phone}`.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === 'totalSpent' ? b.totalSpent - a.totalSpent : sort === 'joinDate' ? b.joinDate.getTime() - a.joinDate.getTime() : b.lastVisit.getTime() - a.lastVisit.getTime(),
      )
  }, [members, level, sort, query])

  const kpi = useMemo(() => {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    return {
      total: members.length,
      vip: members.filter((m) => m.membershipLevel === 'VIP').length,
      active: members.filter((m) => daysAgo(m.lastVisit) <= 30).length,
      spent: members.reduce((s, m) => s + m.totalSpent, 0),
    }
  }, [members])

  const selected = members.find((m) => m.id === selectedId) ?? null
  const history = selected ? reservations.filter((r) => r.memberId === selected.id) : []

  const exportCsv = () =>
    downloadCsv(
      `members-${fmtDate(new Date()).replace(/\//g, '')}.csv`,
      ['姓名', '等級', 'Email', '電話', '加入日期', '最近到訪', '累計消費'],
      filtered.map((m) => [m.name, LEVEL_META[m.membershipLevel].label, m.email, m.phone, fmtDate(m.joinDate), fmtDate(m.lastVisit), m.totalSpent]),
    )

  const selectClass = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 text-sm'
  const panelClass = 'rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))]'

  return (
    <div className="space-y-6">
      <PageHeader
        title="會員"
        subtitle="會員名單、等級與消費紀錄"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>匯出 CSV</Button>
            <Button size="sm" disabled title="Phase 2 實作">
              <UserPlus className="h-4 w-4" aria-hidden />
              新增會員
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={<Users className="h-5 w-5" />} label="會員總數" value={kpi.total} unit="人" />
        <KPICard icon={<Crown className="h-5 w-5" />} label="VIP" value={kpi.vip} unit="人" />
        <KPICard icon={<Users className="h-5 w-5" />} label="30 天內活躍" value={kpi.active} unit="人" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="累計消費" value={kpi.spent.toLocaleString()} unit="元" />
      </div>

      <div className={`flex flex-col gap-3 p-3 md:flex-row md:flex-wrap md:items-center ${panelClass}`}>
        <select aria-label="等級" value={level} onChange={(e) => setLevel(e.target.value as typeof level)} className={selectClass}>
          <option value="ALL">全部等級</option>
          {(Object.keys(LEVEL_META) as Level[]).map((l) => (
            <option key={l} value={l}>{LEVEL_META[l].label}</option>
          ))}
        </select>
        <select aria-label="排序" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectClass}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>依{s.label}</option>
          ))}
        </select>
        <label className="relative flex-1 md:min-w-[14rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            placeholder="搜尋姓名、Email 或電話"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] pl-8 pr-3 text-sm"
          />
        </label>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState description={error} retry={load} />
      ) : filtered.length === 0 ? (
        <div className={panelClass}>
          <EmptyState title="沒有符合條件的會員" icon="👥" />
        </div>
      ) : (
        <>
          <div className={`hidden overflow-x-auto md:block ${panelClass}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--border))] text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">會員</th>
                  <th className="px-4 py-3 font-medium">等級</th>
                  <th className="px-4 py-3 font-medium">聯絡方式</th>
                  <th className="px-4 py-3 font-medium">加入日期</th>
                  <th className="px-4 py-3 font-medium">最近到訪</th>
                  <th className="px-4 py-3 text-right font-medium">累計消費</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} onClick={() => setSelectedId(m.id)} className="cursor-pointer border-b border-[rgb(var(--border))] last:border-0 hover:surface-2">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={m.name} />
                        <span className="font-medium">{m.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={LEVEL_META[m.membershipLevel].label} variant={LEVEL_META[m.membershipLevel].variant} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{m.phone}<br />{m.email}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDate(m.joinDate)}</td>
                    <td className="px-4 py-3 tabular-nums">{fmtDate(m.lastVisit)} <span className="text-xs text-muted">（{daysAgo(m.lastVisit)} 天前）</span></td>
                    <td className="px-4 py-3 text-right font-mono">{fmtMoney(m.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {filtered.map((m) => (
              <button key={m.id} onClick={() => setSelectedId(m.id)} className={`flex w-full items-center gap-3 p-3 text-left hover:surface-2 ${panelClass}`}>
                <Avatar name={m.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name} <StatusBadge status={LEVEL_META[m.membershipLevel].label} variant={LEVEL_META[m.membershipLevel].variant} size="sm" /></p>
                  <p className="text-xs text-muted">{m.phone}　最近到訪 {daysAgo(m.lastVisit)} 天前</p>
                </div>
                <span className="font-mono text-sm">{fmtMoney(m.totalSpent)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelectedId(null)}>
        {selected && (
          <SheetContent title={selected.name} description={`${LEVEL_META[selected.membershipLevel].label}會員　加入於 ${fmtDate(selected.joinDate)}`}>
            <div className="space-y-5 text-sm">
              <section className="grid grid-cols-2 gap-3">
                <Info label="電話" value={selected.phone} icon={<Phone className="h-3.5 w-3.5" aria-hidden />} />
                <Info label="Email" value={selected.email} icon={<Mail className="h-3.5 w-3.5" aria-hidden />} />
                <Info label="最近到訪" value={`${fmtDate(selected.lastVisit)}（${daysAgo(selected.lastVisit)} 天前）`} />
                <Info label="累計消費" value={fmtMoney(selected.totalSpent)} />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">預約紀錄</h3>
                {history.length === 0 ? (
                  <p className="text-muted">尚無預約紀錄</p>
                ) : (
                  <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-[rgb(var(--border))]">
                    {history.map((r) => (
                      <li key={r.id} className="flex items-center justify-between px-3 py-2">
                        <span>
                          <span className="font-mono text-xs">{r.bookingCode}</span>　{r.items[0]?.name}
                        </span>
                        <span className="font-mono text-xs">{fmtMoney(r.totalAmount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <div className="flex flex-wrap gap-2 border-t border-[rgb(var(--border))] pt-4">
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">編輯資料</Button>
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">調整等級</Button>
                <Button size="sm" variant="secondary" disabled title="Phase 2 實作">發送 LINE 訊息</Button>
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
      {name.slice(0, 1)}
    </span>
  )
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--border))] p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">{icon}{label}</p>
      <p className="mt-1 truncate text-sm font-medium">{value}</p>
    </div>
  )
}
