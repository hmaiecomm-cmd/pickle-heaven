import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: 'AI 情境營造' }
export const dynamic = 'force-dynamic'

export default async function AmbiencePage() {
  if ((await pagePermission('device')) === 'forbidden') return <Forbidden />

  return (
    <div className="space-y-6">
      <PageTitle
        title="AI 情境營造"
        desc="管理球場音樂、燈光、訊息看板等環境營造設定。"
      />

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <p className="font-semibold text-zinc-800">功能開發中</p>
        <p className="mt-2 text-sm text-zinc-600">此頁面功能正在開發中，敬請期待。</p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-600">
          <li>• 語音廣播與音樂暖場</li>
          <li>• 場景與燈光模式</li>
          <li>• LED 智慧訊息看板</li>
        </ul>
      </div>
    </div>
  )
}
