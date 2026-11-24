import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, PageTitle } from '@/components/admin/page-bits'

export const metadata: Metadata = { title: 'AI 情境營造' }

const TAB_LABELS: Record<string, string> = {
  voice: '語音廣播與音樂暖場',
  lighting: '場景與燈光模式',
  led: 'LED 智慧訊息看板',
}

const TAB_DESCRIPTIONS: Record<string, string> = {
  voice: '智慧播放系統、背景音樂設定、營業前後廣播公告',
  lighting: '預設場景配置、光線調度、營運時段燈光自動切換',
  led: '動態訊息管理、營業訊息播放、賽事結果即時顯示',
}

export default async function AmbiencePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if ((await pagePermission('device')) === 'forbidden') return <Forbidden />

  const params = await searchParams
  const tab = params.tab as string | undefined
  const tabLabel = tab ? TAB_LABELS[tab] : '功能'

  return (
    <div className="space-y-6">
      <PageTitle title="AI 情境營造" desc="智慧場館氛圍管理與環境控制" />

      <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-8">
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 mb-3">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-600"></span>
              建立中
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">此功能目前正在建立中</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {tab ? `「${tabLabel}」` : '「AI 情境營造」'}功能目前正在建立中，完成後將開放使用。
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-semibold text-zinc-900">預計支援功能：</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-amber-400 text-center text-xs font-bold text-white leading-5">1</div>
                <div>
                  <div className="font-medium text-zinc-900">語音廣播與音樂暖場</div>
                  <p className="text-sm text-zinc-600">智慧播放系統、背景音樂設定、營業前後廣播公告</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-amber-400 text-center text-xs font-bold text-white leading-5">2</div>
                <div>
                  <div className="font-medium text-zinc-900">場景與燈光模式</div>
                  <p className="text-sm text-zinc-600">預設場景配置、光線調度、營運時段燈光自動切換</p>
                </div>
              </li>
              <li className="flex gap-3">
                <div className="mt-0.5 h-5 w-5 rounded-full bg-amber-400 text-center text-xs font-bold text-white leading-5">3</div>
                <div>
                  <div className="font-medium text-zinc-900">LED 智慧訊息看板</div>
                  <p className="text-sm text-zinc-600">動態訊息管理、營業訊息播放、賽事結果即時顯示</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded bg-amber-100 p-3">
            <p className="text-sm text-amber-900">
              💡 這些功能將幫助您的場館提升營運效率和客戶體驗，透過智慧化的環境管理，打造獨特的場館氛圍。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
