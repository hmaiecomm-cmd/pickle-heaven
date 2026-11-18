import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** 活動與行銷設計 ＞ 新增活動／活動名稱；左側返回鍵固定回活動列表 */
export function MarketingBreadcrumb({ current, badge }: { current: string; badge?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Link href="/admin/marketing#activities" aria-label="返回活動列表" className="-ml-2 flex-shrink-0 rounded-lg p-1.5 text-brand-800 hover:bg-brand-50">
        <ChevronLeft className="h-5 w-5" />
      </Link>
      <nav aria-label="位置" className="flex min-w-0 items-center gap-1 text-base font-bold text-brand-900 sm:text-lg">
        <Link href="/admin/marketing#activities" className="flex-shrink-0 hover:underline">
          活動與行銷設計
        </Link>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-brand-700" aria-hidden />
        <span className="truncate" aria-current="page">
          {current}
        </span>
      </nav>
      {badge}
    </div>
  )
}
