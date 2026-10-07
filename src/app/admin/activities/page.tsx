import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { requireAdmin } from '@/lib/admin-auth'
import { Card, CardContent } from '@/components/ui/card'
import { ACTIVITY_TYPE_LABEL, describeRule, PRICE_UNIT_LABEL, type ActivityTypeKey, type PriceUnitKey } from '@/lib/activity-shared'
import { listActivitiesAdmin, syncLegacyOccupancy } from '@/server/activity-admin'

export const metadata: Metadata = { title: '活動' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '草稿', cls: 'bg-zinc-100 text-zinc-700' },
  PUBLISHED: { label: '已發布', cls: 'bg-emerald-50 text-emerald-800' },
  ARCHIVED: { label: '已下架', cls: 'bg-zinc-100 text-zinc-500' },
}

export default async function AdminActivitiesPage() {
  await requireAdmin()
  // 舊版球敘沒有佔用場地：每次進入時補上；衝突不覆蓋，列出給管理者處理
  const sync = await syncLegacyOccupancy().catch((err) => {
    console.error('[activities] 補場地佔用失敗', err)
    return { fixed: 0, conflicts: [] as { sessionId: string; label: string; reason: string }[] }
  })
  const activities = await listActivitiesAdmin()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">活動</h1>
          <p className="mt-0.5 text-xs text-muted">活動會出現在前台的預約表、活動列表與首頁；活動時段不會再被一般訂場買走</p>
        </div>
        <Link href="/admin/activities/new" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" aria-hidden />
          新增活動
        </Link>
      </div>

      {sync.fixed > 0 && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">已為 {sync.fixed} 個既有場次補上場地佔用。</p>
      )}
      {sync.conflicts.length > 0 && (
        <Card>
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold text-red-700">以下既有場次的場地已被其他預約使用，未佔用場地（既有訂單未被覆蓋）</p>
            <ul className="space-y-1 text-xs">
              {sync.conflicts.map((c) => (
                <li key={c.sessionId}>
                  <Link href={`/admin/sessions/${c.sessionId}`} className="font-medium text-brand-700 hover:underline">
                    {c.label}
                  </Link>
                  ：{c.reason}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">請到活動頁修改該場的時段或場地，或取消該場次。</p>
          </CardContent>
        </Card>
      )}

      {activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted">尚未建立活動。</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activities.map((a) => (
            <Link key={a.id} href={`/admin/activities/${a.id}`} className="group block overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-white hover:border-brand-500">
              <div className="aspect-[16/7] bg-[#281343]">
                {a.coverAssetId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/media/${a.coverAssetId}?size=thumb`} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-sm font-bold text-[#EEE6FA]">{ACTIVITY_TYPE_LABEL[a.type as ActivityTypeKey]}・預設封面</div>
                )}
              </div>
              <div className="space-y-1.5 p-4">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[a.status]?.cls ?? ''}`}>{STATUS[a.status]?.label ?? a.status}</span>
                  <span className="text-[11px] text-muted">{ACTIVITY_TYPE_LABEL[a.type as ActivityTypeKey]}</span>
                </div>
                <p className="font-semibold group-hover:text-brand-700">{a.title}</p>
                <p className="text-xs text-muted">
                  {describeRule({ repeatKind: a.repeatKind as 'ONCE' | 'WEEKLY', weekdays: a.weekdays, intervalWeeks: a.intervalWeeks })}・{a.timeLabel}
                </p>
                <p className="text-xs">
                  NT${a.price.toLocaleString()}／{PRICE_UNIT_LABEL[a.priceUnit as PriceUnitKey]}・名額 {a.capacity}・未來 {a.upcomingSessions} 場
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
