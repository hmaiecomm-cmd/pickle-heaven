import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: 'AI 情境營造' }

const FEATURES = [
  ['voice', '語音廣播與音樂暖場', '場館語音通知、歡迎詞與音樂暖場。'],
  ['lighting', '場景與燈光模式', '依預約、活動或營業時段套用燈光場景。'],
  ['led', 'LED 智慧訊息看板', '顯示場館公告、活動訊息與即時提醒。'],
] as const

export default async function AmbiencePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await pagePermission('device')
  if (ctx === 'forbidden') return <Forbidden />
  const tab = (await searchParams).tab
  const feature = FEATURES.find(([key]) => key === tab) ?? FEATURES[0]

  return (
    <div>
      <PageTitle title="AI 情境營造" desc="智慧營運與成長管理的現場體驗模組。" />
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-950">
        <p className="text-sm font-semibold">功能建置中</p>
        <p className="mt-1 text-sm">此功能入口已建立，詳細控制功能將分階段開放。</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {FEATURES.map(([key, title, desc]) => (
          <a key={key} href={`/admin/ambience?tab=${key}`} className={`rounded-2xl border bg-white p-4 transition-colors ${feature[0] === key ? 'border-violet-400 ring-2 ring-violet-100' : 'border-zinc-200 hover:border-violet-300'}`}>
            <span className="text-xs font-semibold text-violet-700">建置中</span>
            <h2 className="mt-2 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{desc}</p>
          </a>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">{feature[1]}</h2>
        <p className="mt-2 text-sm text-muted">{feature[2]}</p>
        <p className="mt-4 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-muted">目前尚未串接正式設備控制，請先提供需求與操作流程後再開發。</p>
      </div>
    </div>
  )
}
