import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: 'AI 情境營造' }

export default async function AmbiencePage() {
  if ((await pagePermission('device')) === 'forbidden') return <Forbidden />

  return (
    <div className="space-y-6">
      <PageTitle title="AI 情境營造" desc="智慧場館氛圍管理與環境控制" />

      <div className="rounded-lg border border-zinc-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">功能建置中</h2>
            <p className="mt-1 text-sm text-zinc-600">AI 情境營造功能正在開發中，敬請期待。</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">預計支援功能：</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-400 text-center text-xs font-bold text-white leading-5">1</div>
                <div>
                  <div className="font-medium text-zinc-900">語音廣播與音樂暖場</div>
                  <p className="text-sm text-zinc-600">智慧播放系統、背景音樂設定、營業前後廣播公告</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-400 text-center text-xs font-bold text-white leading-5">2</div>
                <div>
                  <div className="font-medium text-zinc-900">場景與燈光模式</div>
                  <p className="text-sm text-zinc-600">預設場景配置、光線調度、營運時段燈光自動切換</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-blue-400 text-center text-xs font-bold text-white leading-5">3</div>
                <div>
                  <div className="font-medium text-zinc-900">LED 智慧訊息看板</div>
                  <p className="text-sm text-zinc-600">動態訊息管理、營業訊息播放、賽事結果即時顯示</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded bg-blue-100 p-3">
            <p className="text-sm text-blue-900">
              💡 這些功能將幫助您的場館提升營運效率和客戶體驗，透過智慧化的環境管理，打造獨特的場館氛圍。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
