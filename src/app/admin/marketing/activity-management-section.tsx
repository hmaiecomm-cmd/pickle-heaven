'use client'

import Link from 'next/link'
import { Edit, Eye, Archive, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ACTIVITY_TYPE_LABEL, type ActivityTypeKey } from '@/lib/activity-shared'

interface Activity {
  id: string
  title: string
  type: string
  status: string
  coverAssetId: string | null
  price: number
  priceUnit: string
  capacity: number
  seriesStartDate: string
  seriesEndDate: string | null
  sessions: { id: string }[]
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: '草稿', cls: 'bg-zinc-100 text-zinc-700' },
  PUBLISHED: { label: '已發布', cls: 'bg-emerald-50 text-emerald-800' },
  ARCHIVED: { label: '已下架', cls: 'bg-zinc-100 text-zinc-500' },
}

interface ActivityManagementSectionProps {
  activities: Activity[]
}

export function ActivityManagementSection({ activities }: ActivityManagementSectionProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted">尚未建立活動</p>
          <Link href="/admin/marketing/activities/new" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">
            新增第一個活動 →
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="group overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-white transition-all hover:border-brand-500 hover:shadow-md"
        >
          {/* 活動封面 */}
          <div className="aspect-[16/9] bg-gradient-to-br from-zinc-200 to-zinc-300 overflow-hidden">
            {activity.coverAssetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/media/${activity.coverAssetId}?size=thumb`}
                alt={activity.title}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full place-items-center bg-gradient-to-br from-brand-100 to-brand-50 text-sm font-semibold text-brand-700">
                {activity.title}
              </div>
            )}
          </div>

          {/* 活動資訊 */}
          <div className="space-y-3 p-4">
            {/* 狀態標籤 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CONFIG[activity.status]?.cls ?? 'bg-zinc-100 text-zinc-700'}`}
              >
                {STATUS_CONFIG[activity.status]?.label ?? activity.status}
              </span>
              <span className="text-[11px] text-muted">
                {ACTIVITY_TYPE_LABEL[activity.type as ActivityTypeKey] || activity.type}
              </span>
            </div>

            {/* 活動標題 */}
            <p className="font-semibold text-zinc-900 group-hover:text-brand-700 line-clamp-2">{activity.title}</p>

            {/* 活動詳情 */}
            <div className="space-y-1 text-xs text-muted">
              <p>
                <span className="font-medium text-zinc-700">日期：</span>
                {activity.seriesStartDate}
                {activity.seriesEndDate && ` ~ ${activity.seriesEndDate}`}
              </p>
              <p>
                <span className="font-medium text-zinc-700">名額：</span>
                {activity.sessions.length} 場・最多 {activity.capacity} 人
              </p>
              <p>
                <span className="font-medium text-zinc-700">費用：</span>
                {activity.price === 0 ? '免費' : `NT$${activity.price.toLocaleString()}`}
              </p>
            </div>

            {/* 快速操作按鈕 */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                href={`/admin/marketing/activities/${activity.id}`}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-50 px-2 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
              >
                <Edit className="h-4 w-4" aria-hidden />
                編輯
              </Link>
              <Link
                href={`/admin/marketing/activities/${activity.id}?preview=1`}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-zinc-100 px-2 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
              >
                <Eye className="h-4 w-4" aria-hidden />
                預覽
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
