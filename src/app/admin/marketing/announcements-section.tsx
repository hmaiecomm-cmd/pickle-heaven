'use client'

import { Plus, Edit, Trash2, Pin, PinOff } from 'lucide-react'

interface Announcement {
  id: string
  title: string
  content: string
  type: string
  color: string
  displayPages: string
  active: boolean
  pinned: boolean
  startAt?: Date | null
  endAt?: Date | null
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  GENERAL: { label: '一般公告', color: 'bg-blue-50 text-blue-700' },
  ACTIVITY: { label: '活動公告', color: 'bg-emerald-50 text-emerald-700' },
  PROMOTION: { label: '優惠公告', color: 'bg-amber-50 text-amber-700' },
  SYSTEM: { label: '系統公告', color: 'bg-purple-50 text-purple-700' },
  URGENT: { label: '緊急通知', color: 'bg-red-50 text-red-700' },
}

const COLOR_CONFIG: Record<string, string> = {
  BLUE: 'ring-blue-200 bg-blue-50 border-blue-100',
  GREEN: 'ring-green-200 bg-green-50 border-green-100',
  AMBER: 'ring-amber-200 bg-amber-50 border-amber-100',
  RED: 'ring-red-200 bg-red-50 border-red-100',
}

interface AnnouncementsSectionProps {
  announcements: Announcement[]
}

export function AnnouncementsSection({ announcements }: AnnouncementsSectionProps) {
  if (announcements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <div className="text-center">
          <p className="font-semibold text-zinc-800">尚未建立公告</p>
          <p className="mt-2 text-sm text-zinc-600">發佈重要公告讓訪客及時了解最新資訊</p>
          <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            新增公告
          </button>
        </div>
      </div>
    )
  }

  const pinnedAnnouncements = announcements.filter((a) => a.pinned)
  const otherAnnouncements = announcements.filter((a) => !a.pinned)

  return (
    <div className="space-y-3">
      {pinnedAnnouncements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-600 uppercase">已置頂</p>
          {pinnedAnnouncements.map((announcement) => (
            <AnnouncementRow key={announcement.id} announcement={announcement} />
          ))}
        </div>
      )}

      {otherAnnouncements.length > 0 && (
        <div className="space-y-2">
          {pinnedAnnouncements.length > 0 && <p className="text-xs font-semibold text-zinc-600 uppercase pt-2">其他公告</p>}
          {otherAnnouncements.map((announcement) => (
            <AnnouncementRow key={announcement.id} announcement={announcement} />
          ))}
        </div>
      )}
    </div>
  )
}

function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const typeConfig = TYPE_CONFIG[announcement.type] || TYPE_CONFIG.GENERAL
  const colorClass = COLOR_CONFIG[announcement.color] || COLOR_CONFIG.BLUE

  return (
    <div className={`rounded-xl border p-4 transition-all hover:shadow-md ${colorClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            {announcement.pinned && <Pin className="h-3 w-3 text-amber-600" aria-hidden />}
            {!announcement.active && (
              <span className="text-[11px] rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700">已停用</span>
            )}
          </div>

          <p className="mt-2 font-semibold text-zinc-900">{announcement.title}</p>
          <p className="mt-1 text-sm text-zinc-700 line-clamp-2">{announcement.content}</p>

          {announcement.startAt && (
            <p className="mt-2 text-xs text-zinc-600">
              {new Date(announcement.startAt).toLocaleDateString('zh-TW')}
              {announcement.endAt && ` ~ ${new Date(announcement.endAt).toLocaleDateString('zh-TW')}`}
            </p>
          )}
        </div>

        {/* 操作按鈕 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button className="rounded-lg bg-white/60 p-1.5 hover:bg-white transition-colors" title="編輯">
            <Edit className="h-4 w-4 text-zinc-600" aria-hidden />
          </button>
          <button className="rounded-lg bg-white/60 p-1.5 hover:bg-white transition-colors" title={announcement.pinned ? '取消置頂' : '置頂'}>
            {announcement.pinned ? (
              <PinOff className="h-4 w-4 text-amber-600" aria-hidden />
            ) : (
              <Pin className="h-4 w-4 text-zinc-600" aria-hidden />
            )}
          </button>
          <button className="rounded-lg bg-white/60 p-1.5 hover:bg-white transition-colors" title="刪除">
            <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
