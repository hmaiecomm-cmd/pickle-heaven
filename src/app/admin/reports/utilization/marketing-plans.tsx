'use client'
import React from 'react'
import { Trash2, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarketingPlan } from './types'

interface MarketingPlansProps {
  plans: MarketingPlan[]
  demoMode?: boolean
  onRemoveDemo?: () => void
}

export function MarketingPlans({ plans, demoMode = false, onRemoveDemo }: MarketingPlansProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null)

  // 如果 demoMode 被關閉，關閉任何打開的 Modal
  React.useEffect(() => {
    if (!demoMode) {
      setSelectedPlanId(null)
    }
  }, [demoMode])

  // 處理 ESC 鍵
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPlanId(null)
      }
    }
    if (selectedPlanId) {
      window.addEventListener('keydown', handleEsc)
      return () => window.removeEventListener('keydown', handleEsc)
    }
  }, [selectedPlanId])

  const selectedPlan = plans.find(p => p.id === selectedPlanId)

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#1f3d2b]">收益行銷方案</h2>
        {demoMode && (
          <button
            onClick={onRemoveDemo}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 border border-red-300 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3" />
            移除 Demo
          </button>
        )}
      </div>

      {/* 平板版可展開設計 */}
      <div className="hidden sm:block md:hidden mb-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 border border-zinc-200 rounded-lg hover:bg-zinc-50"
        >
          <span className="font-semibold text-[#1f2a22]">{expanded ? '隱藏方案' : '查看行銷方案'}</span>
          <span className={cn('transition-transform', expanded && 'rotate-180')}>▼</span>
        </button>
      </div>

      {/* 方案卡片 - 電腦版全顯示，平板版展開，手機版單列 */}
      <div className={cn(
        'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4',
        'hidden md:grid',
        'sm:block md:grid'
      )}>
        {!expanded && (
          <div className="sm:block md:hidden">
            {/* 平板版摘要 */}
            {plans.slice(0, 1).map((p) => (
              <div key={p.id} className="p-4 border border-zinc-200 rounded-lg bg-gradient-to-br from-green-50 to-green-100">
                <div className="flex items-center gap-2 mb-2">
                  {demoMode && <span className="px-2 py-1 text-xs font-bold bg-orange-100 text-orange-700 rounded">DEMO</span>}
                  <h3 className="font-semibold text-[#1f2a22] flex-1">{p.name}</h3>
                </div>
                <p className="text-xs text-muted mb-3">{p.offer}</p>
                <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                  <div>
                    <p className="text-muted">預估使用率提升</p>
                    <p className="font-bold text-[#2f7d3b]">+15%</p>
                  </div>
                  <div>
                    <p className="text-muted">預估增加營收</p>
                    <p className="font-bold text-green-600">NT${p.netRevenue}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlanId(p.id)}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-[#2f7d3b] text-white text-xs font-bold rounded-lg hover:bg-[#276a32] focus:outline-none focus:ring-2 focus:ring-[#7cb342] focus:ring-offset-1 transition-colors"
                >
                  查看方案詳情
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {(expanded || typeof window === 'undefined' || window.innerWidth >= 768) && plans.map((p) => (
          <div key={p.id} className="p-4 border border-zinc-200 rounded-lg bg-gradient-to-br from-green-50 to-green-100 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-2 mb-2">
              {demoMode && <span className="px-2 py-1 text-xs font-bold bg-orange-100 text-orange-700 rounded whitespace-nowrap">DEMO</span>}
              <h3 className="font-semibold text-[#1f2a22]">{p.name}</h3>
            </div>

            <p className="text-xs text-muted mb-3">{p.offer}</p>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div>
                <p className="text-muted text-[11px]">預估使用率提升</p>
                <p className="font-bold text-[#2f7d3b] text-sm">+15%</p>
              </div>
              <div>
                <p className="text-muted text-[11px]">預估增加營收</p>
                <p className="font-bold text-green-600 text-sm">NT${p.netRevenue}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlanId(p.id)}
              className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-[#2f7d3b] text-white text-xs font-bold rounded-lg hover:bg-[#276a32] focus:outline-none focus:ring-2 focus:ring-[#7cb342] focus:ring-offset-1 transition-colors"
            >
              查看方案詳情
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* 手機版單列 */}
      <div className="sm:hidden space-y-3">
        {plans.map((p) => (
          <div key={p.id} className="p-3 border border-zinc-200 rounded-lg bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-start gap-2 mb-2">
              {demoMode && <span className="px-2 py-1 text-[10px] font-bold bg-orange-100 text-orange-700 rounded whitespace-nowrap">DEMO</span>}
              <h3 className="font-semibold text-sm text-[#1f2a22] flex-1">{p.name}</h3>
            </div>

            <p className="text-xs text-muted mb-2">{p.offer}</p>

            <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
              <div>
                <p className="text-muted">使用率</p>
                <p className="font-bold text-[#2f7d3b]">+15%</p>
              </div>
              <div>
                <p className="text-muted">營收</p>
                <p className="font-bold text-green-600">NT${p.netRevenue}</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlanId(p.id)}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-[#2f7d3b] text-white text-xs font-bold rounded-lg hover:bg-[#276a32] focus:outline-none focus:ring-2 focus:ring-[#7cb342] focus:ring-offset-1 transition-colors"
            >
              查看詳情
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* 詳細方案 Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedPlanId(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* 關閉按鈕 */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-zinc-200 sticky top-0 bg-white">
              <h2 className="text-lg md:text-xl font-bold text-[#1f2a22]">方案詳細內容</h2>
              <button
                onClick={() => setSelectedPlanId(null)}
                className="p-1 hover:bg-zinc-100 rounded-lg transition-colors"
                aria-label="關閉"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* 內容區 */}
            <div className="p-4 md:p-6 space-y-6">
              {/* 方案基本信息 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-bold bg-orange-100 text-orange-700 rounded">DEMO</span>
                  <h3 className="text-base md:text-lg font-bold text-[#1f2a22]">{selectedPlan.name}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs text-muted mb-1">方案類型</p>
                    <p className="font-semibold text-[#1f2a22]">離峰促銷</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs text-muted mb-1">適用時段</p>
                    <p className="font-semibold text-[#1f2a22]">平日 14:00～18:00</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs text-muted mb-1">折扣</p>
                    <p className="font-semibold text-[#1f2a22]">{selectedPlan.offer}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-lg">
                    <p className="text-xs text-muted mb-1">適用場地</p>
                    <p className="font-semibold text-[#1f2a22]">A 場、B 場、全部場地</p>
                  </div>
                </div>
              </div>

              {/* 預估效益 */}
              <div className="space-y-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-[#1f2a22]">預估效益</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted mb-1">使用率提升</p>
                    <p className="text-2xl font-bold text-green-600">+15%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted mb-1">增加營收</p>
                    <p className="text-2xl font-bold text-green-600">NT${selectedPlan.netRevenue}</p>
                  </div>
                </div>
              </div>

              {/* 執行建議 */}
              <div className="space-y-3">
                <h4 className="font-bold text-[#1f2a22]">執行建議</h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <p className="text-xs text-muted mb-1">建議執行期間</p>
                    <p className="text-[#1f2a22]">近 30 天內啟動，運行期間為 4 周</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <p className="text-xs text-muted mb-1">建議執行方式</p>
                    <p className="text-[#1f2a22]">透過 LINE 推播、官網公告、會員信件等多渠道宣傳</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                    <p className="text-xs text-muted mb-1">預估影響</p>
                    <p className="text-[#1f2a22]">預計帶動 23 位會員購買，增加 NT$2,304 淨營收</p>
                  </div>
                </div>
              </div>

              {/* 操作按鈕 */}
              <div className="flex gap-3 pt-4 border-t border-zinc-200">
                <button
                  onClick={() => setSelectedPlanId(null)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
                >
                  確認了解
                </button>
                <button
                  onClick={() => setSelectedPlanId(null)}
                  className="flex-1 px-4 py-2 border border-zinc-300 text-[#1f2a22] font-bold rounded-lg hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
