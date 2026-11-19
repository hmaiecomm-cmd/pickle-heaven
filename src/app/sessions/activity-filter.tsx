'use client'

import * as React from 'react'
import { Calendar, Search } from 'lucide-react'
import type { ActivityCardDTO } from '@/lib/activity-shared'

type ActivityCategory = 'all' | 'general' | 'dupr'

interface ActivityFilterProps {
  cards: ActivityCardDTO[]
  onFilteredCards: (cards: ActivityCardDTO[]) => void
}

export function ActivityFilter({ cards, onFilteredCards }: ActivityFilterProps) {
  const [category, setCategory] = React.useState<ActivityCategory>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [isSearching, setIsSearching] = React.useState(false)

  // 過濾卡片
  React.useEffect(() => {
    let filtered = [...cards]

    // 按分類過濾
    if (category === 'general') {
      filtered = filtered.filter(card =>
        card.type !== 'DUPR_MATCH'
      )
    } else if (category === 'dupr') {
      filtered = filtered.filter(card =>
        card.type === 'DUPR_MATCH'
      )
    }

    // 按日期過濾
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate) : null

      filtered = filtered.filter(card => {
        return card.sessions.some(session => {
          const sessionDate = new Date(session.date)

          if (start && sessionDate < start) return false
          if (end && sessionDate > end) return false

          return true
        })
      })
    }

    onFilteredCards(filtered)
  }, [category, startDate, endDate, cards, onFilteredCards])

  const handleSearch = () => {
    setIsSearching(true)
    setTimeout(() => setIsSearching(false), 500)
  }

  const foundCount = cards.length // 實際應該是過濾後的數量

  return (
    <div className="space-y-6">
      {/* 分類切換 */}
      <div className="flex gap-2 sm:gap-3 flex-wrap">
        <button
          onClick={() => setCategory('all')}
          className={`px-4 py-2 rounded-full font-medium transition-colors ${
            category === 'all'
              ? 'bg-hp-purple text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          一般活動
        </button>
        <button
          onClick={() => setCategory('dupr')}
          className={`px-4 py-2 rounded-full font-medium transition-colors ${
            category === 'dupr'
              ? 'bg-hp-purple text-white'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          DUPR 球賽
        </button>
      </div>

      {/* 日期搜索區塊 */}
      <div className="rounded-3xl bg-[#30223D] px-5 py-6 sm:px-8">
        <h2 className="text-lg font-bold text-white mb-4">選擇活動日期</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 開始日期 */}
            <div>
              <label htmlFor="start-date" className="block text-sm font-medium text-white/80 mb-2">
                <Calendar className="inline h-4 w-4 mr-2" aria-hidden />
                開始日期
              </label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-hp-purple"
              />
            </div>

            {/* 結束日期 */}
            <div>
              <label htmlFor="end-date" className="block text-sm font-medium text-white/80 mb-2">
                <Calendar className="inline h-4 w-4 mr-2" aria-hidden />
                結束日期
              </label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-hp-purple"
              />
            </div>
          </div>

          {/* 搜尋按鈕 */}
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full sm:w-auto px-6 py-2 rounded-lg bg-hp-purple text-white font-medium hover:bg-hp-purple/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Search className="h-4 w-4" aria-hidden />
            搜尋活動
          </button>
        </div>

        {/* 搜索結果提示 */}
        {(startDate || endDate) && (
          <p className="mt-4 text-sm text-white/70">
            找到 {cards.length} 個活動
          </p>
        )}
      </div>
    </div>
  )
}
