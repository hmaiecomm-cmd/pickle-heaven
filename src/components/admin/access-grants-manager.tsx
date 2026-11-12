'use client'

import { useState } from 'react'
import { Calendar, Lock, Trash2, CheckCircle2, Clock } from 'lucide-react'

const GRANTS = [
  {
    id: 'grant-001',
    userId: 'U001',
    userName: '王小明',
    deviceId: 'door-main',
    deviceName: '大門電子門鎖',
    type: 'booking',
    bookingId: 'BK20261112001',
    startTime: '2026-11-12 14:00:00',
    endTime: '2026-11-12 16:30:00',
    status: 'active',
    grantedAt: '2026-11-12 13:55:00',
    grantedBy: '管理者',
  },
  {
    id: 'grant-002',
    userId: 'U002',
    userName: '李小花',
    deviceId: 'door-court-a',
    deviceName: '球場 A 門禁',
    type: 'booking',
    bookingId: 'BK20261112002',
    startTime: '2026-11-12 15:00:00',
    endTime: '2026-11-12 17:00:00',
    status: 'active',
    grantedAt: '2026-11-12 14:30:00',
    grantedBy: '管理者',
  },
  {
    id: 'grant-003',
    userId: 'U003',
    userName: '張大衛',
    deviceId: 'door-court-b',
    deviceName: '球場 B 門禁',
    type: 'booking',
    bookingId: 'BK20261111005',
    startTime: '2026-11-11 18:00:00',
    endTime: '2026-11-11 20:00:00',
    status: 'expired',
    grantedAt: '2026-11-11 17:45:00',
    grantedBy: '管理者',
  },
  {
    id: 'grant-004',
    userId: 'U004',
    userName: '陳小美',
    deviceId: 'door-main',
    deviceName: '大門電子門鎖',
    type: 'manual',
    bookingId: null,
    startTime: '2026-11-12 16:00:00',
    endTime: '2026-11-12 18:00:00',
    status: 'pending',
    grantedAt: '2026-11-12 15:00:00',
    grantedBy: '管理者',
  },
  {
    id: 'grant-005',
    userId: 'U005',
    userName: '黃老闆',
    deviceId: 'door-shop',
    deviceName: 'Pro Shop 門禁',
    type: 'staff',
    bookingId: null,
    startTime: '2026-11-01 00:00:00',
    endTime: '2026-12-31 23:59:59',
    status: 'active',
    grantedAt: '2026-11-01 10:00:00',
    grantedBy: 'Owner',
  },
]

const TYPE_LABEL = {
  booking: '預約授權',
  manual: '手動授權',
  staff: '員工長期',
}

const STATUS_LABEL = {
  active: '有效',
  expired: '已失效',
  pending: '待授權',
  revoked: '已撤銷',
}

const STATUS_COLOR = {
  active: 'emerald',
  expired: 'gray',
  pending: 'amber',
  revoked: 'red',
}

export function AccessGrantsManager() {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)

  const filteredGrants = filter ? GRANTS.filter((g) => g.status === filter) : GRANTS

  return (
    <div className="space-y-4">
      {/* 新增授權按鈕 */}
      <div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors"
        >
          {showForm ? '取消' : '+ 新增授權'}
        </button>
      </div>

      {/* 新增授權表單 */}
      {showForm && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold mb-4">新增門禁授權</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">使用者</label>
              <input
                type="text"
                placeholder="搜尋使用者名稱或 ID"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">門禁設備</label>
              <select className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option>選擇門禁設備</option>
                <option>大門電子門鎖</option>
                <option>球場 A 門禁</option>
                <option>球場 B 門禁</option>
                <option>Pro Shop 門禁</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">授權類型</label>
              <select className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option>預約授權</option>
                <option>手動授權</option>
                <option>員工長期</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">有效期限</label>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-muted mb-1">備註</label>
              <textarea
                rows={2}
                placeholder="輸入授權備註（可選）"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors">
              確認授權
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 過濾 */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            filter === null
              ? 'bg-brand-600 text-white'
              : 'border border-zinc-200 bg-white hover:bg-zinc-50'
          }`}
        >
          全部
        </button>
        {['active', 'expired', 'pending', 'revoked'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              filter === status
                ? 'bg-brand-600 text-white'
                : 'border border-zinc-200 bg-white hover:bg-zinc-50'
            }`}
          >
            {STATUS_LABEL[status as keyof typeof STATUS_LABEL]} (
            {GRANTS.filter((g) => g.status === status).length})
          </button>
        ))}
      </div>

      {/* 授權列表 */}
      <div className="space-y-3">
        {filteredGrants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted">沒有符合條件的授權記錄</p>
          </div>
        ) : (
          filteredGrants.map((grant) => (
            <div key={grant.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {grant.userName} → {grant.deviceName}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {TYPE_LABEL[grant.type as keyof typeof TYPE_LABEL]}
                    {grant.bookingId && ` · ${grant.bookingId}`}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                    grant.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : grant.status === 'expired'
                        ? 'bg-gray-100 text-gray-700'
                        : grant.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                  }`}
                >
                  {STATUS_LABEL[grant.status as keyof typeof STATUS_LABEL]}
                </span>
              </div>

              <div className="grid gap-2 grid-cols-2 text-xs py-3 border-t border-b border-zinc-100">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-muted">開始：</span>
                  <span className="font-semibold">{grant.startTime.split(' ')[1]}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-orange-600" />
                  <span className="text-muted">結束：</span>
                  <span className="font-semibold">{grant.endTime.split(' ')[1]}</span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {grant.status === 'active' && (
                  <>
                    <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">
                      詳情
                    </button>
                    <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors flex items-center justify-center gap-1">
                      <Trash2 className="w-3 h-3" />
                      撤銷
                    </button>
                  </>
                )}
                {grant.status === 'pending' && (
                  <>
                    <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      確認
                    </button>
                    <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors">
                      拒絕
                    </button>
                  </>
                )}
                {grant.status === 'expired' && (
                  <button className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">
                    查詢紀錄
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
