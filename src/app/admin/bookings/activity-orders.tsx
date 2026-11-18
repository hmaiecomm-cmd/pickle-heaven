import Link from 'next/link'
import { CalendarDays, CircleDollarSign, Clock, Crown, Hourglass, ImageOff, Search, Sparkles, UserPlus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Pill } from '@/components/admin/page-bits'
import type { ActivityOrderFilters, ActivityOrderRow, ActivityOrderStats } from '@/server/activity-orders-admin'

const SESSION_STATUS: Record<string, [string, 'green' | 'amber' | 'red' | 'gray' | 'blue']> = {
  SCHEDULED: ['尚未開放', 'gray'],
  OPEN: ['報名中', 'green'],
  FULL: ['已額滿', 'amber'],
  LOCKED: ['名單確定', 'blue'],
  PLAYING: ['進行中', 'green'],
  COMPLETED: ['已結束', 'gray'],
  CANCELLED: ['已取消', 'red'],
}

const field = 'h-10 w-full rounded-lg border border-[#e3e8dc] bg-white px-2 text-sm'
const nt = (n: number) => `NT$${n.toLocaleString()}`

function fmtStart(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', weekday: 'short' })
  const time = d.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: 'green' | 'amber' | 'violet' | 'brand' }) {
  const ring = { green: 'bg-[#eef7e6] text-[#2f7d3b]', amber: 'bg-amber-50 text-amber-700', violet: 'bg-violet-50 text-violet-700', brand: 'bg-[#1f4d34] text-white' }[tone]
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e3e8dc] bg-white p-3 shadow-sm sm:p-4">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11', ring)}>
        <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted sm:text-xs">{label}</p>
        <p className="text-lg font-bold tabular text-[#1f2a22] sm:text-xl">{value}</p>
      </div>
    </div>
  )
}

export function ActivityOrders({
  stats,
  rows,
  total,
  pages,
  filters,
  range,
  canDetail,
}: {
  stats: ActivityOrderStats
  rows: ActivityOrderRow[]
  total: number
  pages: number
  filters: ActivityOrderFilters
  range: { from: string; to: string }
  canDetail: boolean
}) {
  const qs = (page: number) => {
    const u = new URLSearchParams({ tab: 'activity' })
    for (const [k, v] of Object.entries(filters)) if (k !== 'page' && v) u.set(k, String(v))
    if (page > 1) u.set('page', String(page))
    return `/admin/bookings?${u}`
  }

  return (
    <div className="space-y-5">
      <section aria-label="活動統計" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Sparkles} label="進行中活動" value={String(stats.ongoing)} tone="green" />
        <StatCard icon={UserPlus} label="今日報名人數" value={String(stats.todaySignups)} tone="green" />
        <StatCard icon={Crown} label="VIP 報名人數" value={String(stats.vip)} tone="violet" />
        <StatCard icon={Hourglass} label="候補人數" value={String(stats.waitlist)} tone="amber" />
        <StatCard icon={CircleDollarSign} label="本月活動收入" value={stats.monthRevenue === null ? '—' : nt(stats.monthRevenue)} tone="brand" />
      </section>

      <form method="get" action="/admin/bookings" className="rounded-2xl border border-[#e3e8dc] bg-white p-3 sm:p-4">
        <input type="hidden" name="tab" value="activity" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative sm:col-span-2">
            <span className="sr-only">活動名稱</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={filters.q} placeholder="活動名稱" className={cn(field, 'pl-9')} />
          </label>
          <label>
            <span className="sr-only">起始日期</span>
            <input type="date" name="from" defaultValue={filters.from} aria-label="活動日期起" className={field} />
          </label>
          <label>
            <span className="sr-only">結束日期</span>
            <input type="date" name="to" defaultValue={filters.to} aria-label="活動日期迄" className={field} />
          </label>
          <select name="reg" defaultValue={filters.reg} aria-label="報名狀態" className={field}>
            <option value="">報名狀態：全部</option>
            <option value="CONFIRMED">正取</option>
            <option value="WAITLISTED">候補</option>
            <option value="CANCELLED">已取消</option>
          </select>
          <select name="pay" defaultValue={filters.pay} aria-label="付款狀態" className={field}>
            <option value="">付款狀態：全部</option>
            <option value="PAID">已付款</option>
            <option value="PENDING">待付款</option>
            <option value="FAILED">付款失敗／取消</option>
          </select>
          <select name="attend" defaultValue={filters.attend} aria-label="出席狀態" className={field}>
            <option value="">出席狀態：全部</option>
            <option value="CHECKED_IN">已出席</option>
            <option value="NO_SHOW">未到</option>
            <option value="NOT_YET">尚未報到</option>
          </select>
          <select name="member" defaultValue={filters.member} aria-label="會員類型" className={field}>
            <option value="">會員：全部</option>
            <option value="VIP">VIP</option>
            <option value="BASIC">一般會員</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="submit" className="h-10 rounded-lg bg-[#7cb342] px-5 text-sm font-semibold text-white hover:bg-[#6fa036]">搜尋</button>
          <Link href="/admin/bookings?tab=activity" className="inline-flex h-10 items-center rounded-lg border border-[#e3e8dc] px-4 text-sm hover:bg-[#fafcf7]">清除條件</Link>
          <span className="ml-auto text-xs text-muted">{range.from} ～ {range.to}・{total} 場</span>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d7dfcf] bg-white px-6 py-14 text-center">
          <CalendarDays className="mx-auto mb-3 h-10 w-10 text-[#9db58a]" strokeWidth={1.5} aria-hidden />
          <p className="text-sm text-muted">此期間沒有符合條件的活動</p>
        </div>
      ) : (
        <section aria-label="活動列表" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const { date, time } = fmtStart(r.startAt)
            const [statusLabel, statusTone] = SESSION_STATUS[r.status] ?? [r.status, 'gray']
            const fill = r.capacity > 0 ? Math.min(100, Math.round((r.signed / r.capacity) * 100)) : 0
            const ended = r.status === 'COMPLETED' || r.status === 'CANCELLED'
            return (
              <article key={r.id} className={cn('flex flex-col overflow-hidden rounded-2xl border border-[#e3e8dc] bg-white shadow-sm transition-shadow hover:shadow-md', ended && 'opacity-80')}>
                <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-[#eef7e6] to-[#dcefcf]">
                  {r.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-[#9db58a]" strokeWidth={1.5} aria-hidden />
                  )}
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <Pill tone={statusTone}>{statusLabel}</Pill>
                    <Pill tone="gray" className="bg-white/90">{r.typeLabel}</Pill>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <h3 className="text-[15px] font-bold leading-snug text-[#1f2a22]">{r.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden />{date}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{time}</span>
                      <span className="font-semibold text-[#2f7d3b]">{r.price > 0 ? nt(r.price) : '免費'}</span>
                    </p>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="inline-flex items-center gap-1 text-muted"><Users className="h-3.5 w-3.5" aria-hidden />報名</span>
                      <span className="tabular"><b className="text-base text-[#1f2a22]">{r.signed}</b> / {r.capacity}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f0f4ed]" role="progressbar" aria-valuenow={fill} aria-valuemin={0} aria-valuemax={100} aria-label="報名進度">
                      <div className={cn('h-full rounded-full', fill >= 100 ? 'bg-amber-500' : 'bg-[#7cb342]')} style={{ width: `${fill}%` }} />
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-violet-50 py-1.5"><dt className="text-[10px] text-violet-700">VIP</dt><dd className="text-sm font-bold tabular text-violet-800">{r.vip}</dd></div>
                    <div className="rounded-lg bg-amber-50 py-1.5"><dt className="text-[10px] text-amber-700">候補</dt><dd className="text-sm font-bold tabular text-amber-800">{r.waitlist}</dd></div>
                    <div className="rounded-lg bg-zinc-100 py-1.5"><dt className="text-[10px] text-zinc-600">取消</dt><dd className="text-sm font-bold tabular text-zinc-700">{r.cancelled}</dd></div>
                  </dl>

                  <div className="flex flex-wrap gap-1.5">
                    {r.paid > 0 && <Pill tone="green">已付款 {r.paid}</Pill>}
                    {r.pending > 0 && <Pill tone="amber">待付款 {r.pending}</Pill>}
                    {r.failed > 0 && <Pill tone="red">失敗／取消 {r.failed}</Pill>}
                    {r.checkedIn > 0 && <Pill tone="green">已出席 {r.checkedIn}</Pill>}
                    {r.noShow > 0 && <Pill tone="red">未到 {r.noShow}</Pill>}
                    {r.paid + r.pending + r.failed + r.checkedIn + r.noShow === 0 && <Pill tone="gray">尚無報名</Pill>}
                  </div>

                  <div className="mt-auto pt-1">
                    {canDetail ? (
                      <Link href={`/admin/sessions/${r.id}`} className="flex h-10 w-full items-center justify-center rounded-lg bg-[#1f4d34] text-sm font-semibold text-white hover:bg-[#163a27]">
                        查看詳情
                      </Link>
                    ) : (
                      <span className="flex h-10 w-full items-center justify-center rounded-lg bg-zinc-100 text-xs text-muted">需活動檢視權限才能查看名單</span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {pages > 1 && (
        <nav aria-label="分頁" className="flex items-center justify-end gap-2 text-sm">
          <span className="text-xs text-muted">第 {filters.page}／{pages} 頁</span>
          {filters.page > 1 && <Link href={qs(filters.page - 1)} className="rounded-lg border border-[#e3e8dc] bg-white px-3 py-1.5">上一頁</Link>}
          {filters.page < pages && <Link href={qs(filters.page + 1)} className="rounded-lg border border-[#e3e8dc] bg-white px-3 py-1.5">下一頁</Link>}
        </nav>
      )}
    </div>
  )
}
