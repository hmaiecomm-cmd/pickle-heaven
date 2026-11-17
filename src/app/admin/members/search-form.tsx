'use client'

import { useState } from 'react'
import Link from 'next/link'

interface SearchFormProps {
  tab: string
  currentQuery: {
    q?: string
    activity?: string
    membership?: string
    from?: string
    to?: string
    minPoints?: string
    maxPoints?: string
    lastBookingDays?: string
    coachStatus?: string
  }
  total: number
}

export function MembersSearchForm({ tab, currentQuery, total }: SearchFormProps) {
  const [expandAdvanced, setExpandAdvanced] = useState(false)
  const sel = 'h-9 rounded-lg border border-[rgb(var(--border))] bg-white px-2 text-sm'

  const qs = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams()
    const params = { tab, ...currentQuery, ...patch }
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, v)
    return `/admin/members?${u}`
  }

  return (
    <form method="get" className="rounded-2xl border border-[rgb(var(--border))] bg-white p-3 space-y-3" aria-label="篩選人員">
      <input type="hidden" name="tab" value={tab} />

      {/* 預設搜尋列：搜尋框 + 按鈕 */}
      <div className="flex flex-col sm:flex-row sm:gap-2 sm:items-center gap-2">
        <input
          name="q"
          defaultValue={currentQuery.q ?? ''}
          placeholder={tab === 'coaches' ? '輸入教練名稱' : '輸入姓名、Email 或電話'}
          className={`${sel} flex-1 min-w-0`}
          aria-label={tab === 'coaches' ? '搜尋教練' : '搜尋人員'}
        />
        <div className="flex gap-2 items-center flex-shrink-0">
          <button type="submit" className="h-9 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white shrink-0">搜尋</button>
          <Link href={`/admin/members?tab=${tab}`} className="h-9 rounded-lg border border-zinc-300 px-3 text-sm flex items-center hover:bg-zinc-50 shrink-0">
            清除
          </Link>
          <button
            type="button"
            onClick={() => setExpandAdvanced(!expandAdvanced)}
            className="h-9 rounded-lg border border-zinc-300 px-3 text-sm hover:bg-zinc-50 shrink-0 font-medium"
            aria-expanded={expandAdvanced}
          >
            {expandAdvanced ? '隱藏' : '更多條件'}
          </button>
        </div>
      </div>

      {/* 進階篩選：條件式展開 */}
      {expandAdvanced && (
        <div className="border-t border-zinc-100 pt-3 space-y-3">
          {tab === 'coaches' ? (
            /* 教練篩選 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <select name="coachStatus" defaultValue={currentQuery.coachStatus ?? ''} className={sel} aria-label="教練狀態">
                <option value="">全部狀態</option>
                <option value="ACTIVE">在職</option>
                <option value="ON_LEAVE">請假</option>
                <option value="INACTIVE">停用</option>
              </select>
            </div>
          ) : (
            /* 會員篩選 */
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {tab === 'all' && (
                  <select name="membership" defaultValue={currentQuery.membership ?? ''} className={sel} aria-label="會員等級">
                    <option value="">全部等級</option>
                    <option value="BASIC">普通會員</option>
                    <option value="VIP">VIP 會員</option>
                  </select>
                )}
                {tab !== 'blacklist' && (
                  <select name="activity" defaultValue={currentQuery.activity ?? ''} className={sel} aria-label="活動資格">
                    <option value="">全部資格</option>
                    <option value="can_signup">可以報名</option>
                    <option value="no_activity">禁止報名</option>
                  </select>
                )}
                <input type="date" name="from" defaultValue={currentQuery.from ?? ''} className={sel} aria-label="加入日期（起）" />
                <input type="date" name="to" defaultValue={currentQuery.to ?? ''} className={sel} aria-label="加入日期（迄）" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <select name="lastBookingDays" defaultValue={currentQuery.lastBookingDays ?? ''} className={sel} aria-label="最後預約">
                  <option value="">全部時期</option>
                  <option value="7">過去 7 天</option>
                  <option value="30">過去 30 天</option>
                  <option value="90">過去 90 天</option>
                </select>
                <input type="number" name="minPoints" defaultValue={currentQuery.minPoints ?? ''} placeholder="最低點數" min="0" className={sel} aria-label="最低點數" />
                <input type="number" name="maxPoints" defaultValue={currentQuery.maxPoints ?? ''} placeholder="最高點數" min="0" className={sel} aria-label="最高點數" />
              </div>
            </>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="submit" className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white">套用篩選</button>
          </div>
        </div>
      )}

      <div className="text-xs text-muted">共 {total} 位會員</div>
    </form>
  )
}
