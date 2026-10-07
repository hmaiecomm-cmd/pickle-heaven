import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { pagePermission } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Forbidden } from '@/components/admin/page-bits'
import { ACTIVITY_TYPE_LABEL, describeRule, PRICE_UNIT_LABEL, type ActivityTypeKey, type PriceUnitKey } from '@/lib/activity-shared'
import { listActivitiesAdmin, syncLegacyOccupancy } from '@/server/activity-admin'

export const metadata: Metadata = { title: '活動' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '草稿', cls: 'bg-zinc-100 text-zinc-700' },
  PUBLISHED: { label: '已發布', cls: 'bg-emerald-50 text-emerald-800' },
  ARCHIVED: { label: '已下架', cls: 'bg-zinc-100 text-zinc-500' },
}
const VISIBILITY: Record<string, string> = { PUBLIC: '公開', UNLISTED: '僅連結', PRIVATE: '不公開' }
const sel = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-white px-2 text-sm'

type Filters = { type?: string; status?: string; visibility?: string; court?: string; host?: string; from?: string; to?: string; q?: string }

/** 活動列表：依分類、發布狀態、公開方式、場地、主持人、日期篩選 */
export default async function AdminActivitiesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  if ((await pagePermission('activities')) === 'forbidden') return <Forbidden />
  const f = await searchParams
  // 舊版球敘沒有佔用場地：每次進入時補上；衝突不覆蓋，列出給管理者處理
  const sync = await syncLegacyOccupancy().catch((err) => {
    console.error('[activities] 補場地佔用失敗', err)
    return { fixed: 0, conflicts: [] as { sessionId: string; label: string; reason: string }[] }
  })
  const [all, venue, hosts] = await Promise.all([
    listActivitiesAdmin(),
    prisma.venue.findFirst({ where: { active: true }, orderBy: { name: 'asc' }, select: { courts: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } } } }),
    prisma.host.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  const activities = all.filter((a) => {
    if (f.type && a.type !== f.type) return false
    if (f.status && a.status !== f.status) return false
    if (f.visibility && a.visibility !== f.visibility) return false
    if (f.court && !a.courtIds.includes(f.court)) return false
    if (f.host && a.hostId !== f.host) return false
    if (f.from && a.seriesStartDate < f.from) return false
    if (f.to && a.seriesStartDate > f.to) return false
    if (f.q && !a.title.includes(f.q)) return false
    return true
  })
  const active = Object.values(f).some(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">活動</h1>
          <p className="mt-0.5 text-xs text-muted">活動會出現在前台的預約表、活動列表與首頁；發布後的活動時段不會再被一般訂場買走</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/maintenance" className="inline-flex h-9 items-center rounded-xl border border-[rgb(var(--border))] px-3 text-sm hover:surface-2">清潔／維護排程</Link>
          <Link href="/admin/activities/new" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            新增活動
          </Link>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[rgb(var(--border))] bg-white p-3" aria-label="篩選活動">
        <input name="q" defaultValue={f.q ?? ''} placeholder="活動名稱" className={`${sel} w-40`} aria-label="活動名稱" />
        <select name="type" defaultValue={f.type ?? ''} className={sel} aria-label="分類">
          <option value="">全部分類</option>
          {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityTypeKey[]).map((k) => (
            <option key={k} value={k}>{ACTIVITY_TYPE_LABEL[k]}</option>
          ))}
        </select>
        <select name="status" defaultValue={f.status ?? ''} className={sel} aria-label="發布狀態">
          <option value="">全部狀態</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select name="visibility" defaultValue={f.visibility ?? ''} className={sel} aria-label="公開方式">
          <option value="">全部公開方式</option>
          {Object.entries(VISIBILITY).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="court" defaultValue={f.court ?? ''} className={sel} aria-label="場地">
          <option value="">全部場地</option>
          {(venue?.courts ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="host" defaultValue={f.host ?? ''} className={sel} aria-label="主持人">
          <option value="">全部主持人</option>
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={f.from ?? ''} className={sel} aria-label="開始日期（起）" />
        <span className="text-xs text-muted">～</span>
        <input type="date" name="to" defaultValue={f.to ?? ''} className={sel} aria-label="開始日期（迄）" />
        <button type="submit" className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white">篩選</button>
        {active && <Link href="/admin/activities" className="text-xs text-muted hover:underline">清除條件</Link>}
        <span className="ml-auto text-xs text-muted">共 {activities.length} 個活動</span>
      </form>

      {sync.fixed > 0 && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">已為 {sync.fixed} 個既有場次補上場地佔用。</p>}
      {sync.conflicts.length > 0 && (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold text-red-700">以下既有場次的場地已被其他預約使用，未佔用場地（既有訂單未被覆蓋）</p>
            <ul className="space-y-1 text-xs">
              {sync.conflicts.map((c) => (
                <li key={c.sessionId}>
                  <Link href={`/admin/sessions/${c.sessionId}`} className="font-medium text-brand-700 hover:underline">{c.label}</Link>：{c.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">{active ? '沒有符合條件的活動' : '尚未建立活動。'}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((a) => (
            <Link key={a.id} href={`/admin/activities/${a.id}`} className="group block overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-white hover:border-brand-500">
              <div className="aspect-[16/7] bg-[#30223D]">
                {a.coverAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${a.coverAssetId}?size=thumb`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-sm font-bold text-[#EEE6FA]">{a.customTypeLabel ?? ACTIVITY_TYPE_LABEL[a.type as ActivityTypeKey]}・預設封面</div>
                )}
              </div>
              <div className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[a.status]?.cls ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span>
                  {a.visibility !== 'PUBLIC' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">{VISIBILITY[a.visibility] ?? a.visibility}</span>}
                  <span className="text-[11px] text-muted">{a.customTypeLabel ?? ACTIVITY_TYPE_LABEL[a.type as ActivityTypeKey]}</span>
                </div>
                <p className="font-semibold group-hover:text-brand-700">{a.title}</p>
                <p className="text-xs text-muted">
                  {describeRule({ repeatKind: a.repeatKind as 'ONCE' | 'WEEKLY', weekdays: a.weekdays, intervalWeeks: a.intervalWeeks })}・{a.timeLabel}
                  {a.hostName && `・主持：${a.hostName}`}
                </p>
                <p className="text-xs">
                  {a.price === 0 ? '免費' : `NT$${a.price.toLocaleString()}／${PRICE_UNIT_LABEL[a.priceUnit as PriceUnitKey]}`}・名額 {a.capacity}・未來 {a.upcomingSessions} 場
                  {a.nextDate && `・下一場 ${a.nextDate}`}
                </p>
                {a.holdUntil && <p className="text-[11px] text-amber-700">草稿保留場地中</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
