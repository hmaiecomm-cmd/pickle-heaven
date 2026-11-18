'use client'

import { useState } from 'react'
import { Monitor, Tablet, Smartphone, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PageConfig {
  id: string
  pageType: string
  activitiesCount: number
  activitiesSortBy: string
  showPopularActivities: boolean
  showLatestActivities: boolean
  showVIPActivities: boolean
  showShopEntrance: boolean
  showBookingEntrance: boolean
  showMembersArea: boolean
}

interface PageManagementSectionProps {
  pages: PageConfig[]
}

const PAGE_OPTIONS = [
  { value: 'HOMEPAGE', label: '首頁', desc: '首頁主要內容與佈局' },
  { value: 'ACTIVITIES', label: '活動頁面', desc: '活動列表與篩選' },
  { value: 'MEMBERS', label: '會員專區', desc: '會員中心內容' },
  { value: 'BOOKING', label: '預約頁面', desc: '預約流程頁面' },
]

export function PageManagementSection({ pages }: PageManagementSectionProps) {
  const [selectedPage, setSelectedPage] = useState<string>(pages[0]?.pageType || 'HOMEPAGE')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const currentPage = pages.find((p) => p.pageType === selectedPage)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 頁面選擇 */}
      <div className="lg:col-span-1">
        <div className="space-y-3">
          {PAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedPage(opt.value)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                selectedPage === opt.value
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-zinc-200 bg-white hover:border-brand-300'
              }`}
            >
              <p className="font-semibold text-zinc-900">{opt.label}</p>
              <p className="text-xs text-muted mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 配置面板與預覽 */}
      <div className="lg:col-span-2 space-y-4">
        {currentPage ? (
          <>
            {/* 配置選項 */}
            <Card>
              <div className="border-b border-zinc-200 p-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-brand-600" aria-hidden />
                <h3 className="font-semibold text-zinc-900">頁面設定</h3>
              </div>
              <CardContent className="space-y-4 py-4">
                {/* 活動顯示 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 mb-2">
                    顯示的活動數量
                  </label>
                  <select className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none">
                    <option>3</option>
                    <option selected>6</option>
                    <option>9</option>
                    <option>12</option>
                  </select>
                </div>

                {/* 排序方式 */}
                <div>
                  <label className="block text-sm font-medium text-zinc-900 mb-2">
                    活動排序方式
                  </label>
                  <select className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none">
                    <option>最新</option>
                    <option>熱門</option>
                    <option>推薦</option>
                  </select>
                </div>

                {/* 區塊顯示選項 */}
                <div className="space-y-3 border-t border-zinc-200 pt-4">
                  <p className="text-sm font-medium text-zinc-900">顯示內容區塊</p>
                  {[
                    { id: 'showPopularActivities', label: '熱門活動' },
                    { id: 'showLatestActivities', label: '最新活動' },
                    { id: 'showVIPActivities', label: 'VIP 活動' },
                    { id: 'showShopEntrance', label: '商城入口' },
                    { id: 'showBookingEntrance', label: '預約入口' },
                    { id: 'showMembersArea', label: '會員專區' },
                  ].map((item) => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-zinc-300" />
                      <span className="text-sm text-zinc-700">{item.label}</span>
                    </label>
                  ))}
                </div>

                {/* 保存按鈕 */}
                <div className="flex gap-3 border-t border-zinc-200 pt-4">
                  <button className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    取消
                  </button>
                  <button className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    保存設定
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* 預覽控制 */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-zinc-900 flex-1">前台預覽</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewMode('desktop')}
                    className={`rounded-lg p-2 transition-colors ${
                      previewMode === 'desktop'
                        ? 'bg-brand-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                    title="桌面版"
                  >
                    <Monitor className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    onClick={() => setPreviewMode('tablet')}
                    className={`rounded-lg p-2 transition-colors ${
                      previewMode === 'tablet'
                        ? 'bg-brand-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                    title="平板版"
                  >
                    <Tablet className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    onClick={() => setPreviewMode('mobile')}
                    className={`rounded-lg p-2 transition-colors ${
                      previewMode === 'mobile'
                        ? 'bg-brand-600 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                    title="手機版"
                  >
                    <Smartphone className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>

              {/* 預覽框架 */}
              <div
                className={`rounded-lg bg-zinc-50 border border-zinc-200 overflow-hidden transition-all ${
                  previewMode === 'desktop'
                    ? 'h-96 max-w-full'
                    : previewMode === 'tablet'
                      ? 'h-96 max-w-2xl mx-auto'
                      : 'h-96 max-w-sm mx-auto'
                }`}
              >
                <iframe
                  src={`/api/preview/${selectedPage}?mode=${previewMode}`}
                  className="w-full h-full border-none"
                  title="頁面預覽"
                />
              </div>

              <p className="text-xs text-muted mt-3">
                💡 預覽顯示真實資料。修改設定後刷新以查看變化。
              </p>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted">尚未設定任何頁面</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
