'use client'

import { useState } from 'react'
import { LogIn, LogOut, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const EVENTS = [
  {
    id: 'evt-001',
    userId: 'U001',
    userName: '王小明',
    eventType: 'entry',
    deviceName: '大門電子門鎖',
    timestamp: '2026-11-12 14:05:30',
    status: 'success',
    details: '正常進入',
  },
  {
    id: 'evt-002',
    userId: 'U002',
    userName: '李小花',
    eventType: 'entry',
    deviceName: '球場 A 門禁',
    timestamp: '2026-11-12 15:02:15',
    status: 'success',
    details: '正常進入',
  },
  {
    id: 'evt-003',
    userId: 'U001',
    userName: '王小明',
    eventType: 'exit',
    deviceName: '大門電子門鎖',
    timestamp: '2026-11-12 16:25:00',
    status: 'success',
    details: '正常離開',
  },
  {
    id: 'evt-004',
    userId: 'U003',
    userName: '張大衛',
    eventType: 'entry',
    deviceName: '球場 B 門禁',
    timestamp: '2026-11-12 14:55:45',
    status: 'denied',
    details: '授權已過期',
  },
  {
    id: 'evt-005',
    userId: 'UNKNOWN',
    userName: '未知',
    eventType: 'entry',
    deviceName: '大門電子門鎖',
    timestamp: '2026-11-12 12:30:22',
    status: 'unauthorized',
    details: '無有效授權',
  },
  {
    id: 'evt-006',
    userId: 'U004',
    userName: '陳小美',
    eventType: 'entry',
    deviceName: 'Pro Shop 門禁',
    timestamp: '2026-11-11 18:15:10',
    status: 'success',
    details: '正常進入',
  },
  {
    id: 'evt-007',
    userId: 'U005',
    userName: '黃老闆',
    eventType: 'exit',
    deviceName: 'Pro Shop 門禁',
    timestamp: '2026-11-11 20:45:30',
    status: 'success',
    details: '正常離開',
  },
  {
    id: 'evt-008',
    userId: 'U002',
    userName: '李小花',
    eventType: 'exit',
    deviceName: '球場 A 門禁',
    timestamp: '2026-11-12 16:55:20',
    status: 'success',
    details: '正常離開',
  },
]

const EVENT_TYPE_LABEL = {
  entry: '進入',
  exit: '離開',
}

const EVENT_TYPE_ICON = {
  entry: LogIn,
  exit: LogOut,
}

const STATUS_LABEL = {
  success: '成功',
  denied: '拒絕',
  unauthorized: '無授權',
  error: '錯誤',
}

const STATUS_COLOR = {
  success: 'emerald',
  denied: 'amber',
  unauthorized: 'red',
  error: 'red',
}

const STATUS_ICON = {
  success: CheckCircle2,
  denied: AlertTriangle,
  unauthorized: XCircle,
  error: XCircle,
}

export function AccessEventsLog() {
  const [filter, setFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredEvents = EVENTS.filter((event) => {
    const matchFilter = !filter || event.status === filter
    const matchSearch =
      !search ||
      event.userName.toLowerCase().includes(search.toLowerCase()) ||
      event.deviceName.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="space-y-4">
      {/* 搜尋和過濾 */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <input
          type="text"
          placeholder="搜尋使用者或設備..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
              filter === null
                ? 'bg-brand-600 text-white'
                : 'border border-zinc-200 bg-white hover:bg-zinc-50'
            }`}
          >
            全部
          </button>
          {['success', 'denied', 'unauthorized', 'error'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                filter === status
                  ? 'bg-brand-600 text-white'
                  : 'border border-zinc-200 bg-white hover:bg-zinc-50'
              }`}
            >
              {STATUS_LABEL[status as keyof typeof STATUS_LABEL]} (
              {EVENTS.filter((e) => e.status === status).length})
            </button>
          ))}
        </div>
      </div>

      {/* 進出紀錄列表 */}
      <div className="space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted">沒有符合條件的進出紀錄</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const EventTypeIcon = EVENT_TYPE_ICON[event.eventType as keyof typeof EVENT_TYPE_ICON]
            const StatusIcon =
              STATUS_ICON[event.status as keyof typeof STATUS_ICON] || CheckCircle2

            return (
              <div
                key={event.id}
                className="rounded-xl border border-zinc-200 bg-white p-3 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* 事件圖示 */}
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      event.eventType === 'entry'
                        ? 'bg-blue-100'
                        : 'bg-orange-100'
                    }`}
                  >
                    <EventTypeIcon
                      className={`w-5 h-5 ${
                        event.eventType === 'entry'
                          ? 'text-blue-700'
                          : 'text-orange-700'
                      }`}
                      aria-hidden
                    />
                  </div>

                  {/* 事件詳情 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-zinc-900">
                        {event.userName}{' '}
                        <span className="text-muted">
                          {EVENT_TYPE_LABEL[event.eventType as keyof typeof EVENT_TYPE_LABEL]}
                        </span>
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold shrink-0 ${
                          event.status === 'success'
                            ? 'bg-emerald-100 text-emerald-700'
                            : event.status === 'denied'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        <StatusIcon className="w-2.5 h-2.5 mr-1" />
                        {STATUS_LABEL[event.status as keyof typeof STATUS_LABEL]}
                      </span>
                    </div>

                    <p className="text-xs text-muted mb-1">
                      {event.deviceName} · {event.timestamp}
                    </p>

                    {event.status !== 'success' && (
                      <p className="text-xs font-semibold text-amber-700">{event.details}</p>
                    )}
                  </div>

                  {/* 操作 */}
                  <button className="text-xs font-semibold text-brand-700 hover:text-brand-800 shrink-0">
                    查詳
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 統計 */}
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 mt-6">
        <h3 className="text-sm font-semibold mb-3 text-zinc-900">進出統計</h3>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-xs text-muted">今日進入</p>
            <p className="mt-1 text-lg font-bold text-blue-700">
              {EVENTS.filter(
                (e) =>
                  e.eventType === 'entry' &&
                  e.timestamp.includes('2026-11-12'),
              ).length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">今日離開</p>
            <p className="mt-1 text-lg font-bold text-orange-700">
              {EVENTS.filter(
                (e) =>
                  e.eventType === 'exit' &&
                  e.timestamp.includes('2026-11-12'),
              ).length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">成功次數</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {EVENTS.filter((e) => e.status === 'success').length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">異常次數</p>
            <p className="mt-1 text-lg font-bold text-red-700">
              {EVENTS.filter(
                (e) =>
                  e.status === 'denied' ||
                  e.status === 'unauthorized',
              ).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
