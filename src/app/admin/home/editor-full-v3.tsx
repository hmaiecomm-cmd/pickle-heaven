'use client'

import React, { useEffect, useRef, useState } from 'react'
import { THEME_ORDER, THEME_LABELS, type HomeTheme } from '@/lib/home-themes'
import { Save, AlertCircle, CheckCircle, Upload, X, Plus, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompletePreview } from './complete-preview'
import type { EditorState, EditorCoach } from './editor-types'

interface AvailableSession {
  id: string
  title: string
  dateLabel: string
  timeLabel: string
  price: number
  state: string
  remaining: number
  stateLabel: string
}

export function EditorFullV3({ username }: { username: string }) {
  const [state, setState] = useState<EditorState>({
    theme: 'purple',
    hero: {
      title: '在森林裡，打出你的節奏。',
      subtitle: '大新店森林匹克球',
      description: '來大新店森林匹克球，享受揮拍的暢快，也享受相聚的時光。線上預約場地、報名球友集合場次。',
      buttonText: '立即預約',
      buttonLink: '/booking',
      photoId: undefined,
    },
    sections: {
      plans: {
        title: '今天，你想怎麼玩？',
        description: '揪朋友一起開打，或加入一場新的相遇。',
        visible: true,
        selectedSessionIds: [],
      },
      coaching: {
        title: '第一球，到下一個突破。',
        description: '找到適合你的練習節奏，讓每次上場都有新收穫。',
        visible: true,
        coaches: [
          { id: '1', name: '王教練', specialties: ['基礎訓練'], bio: '10年教學經驗', hourlyRate: 1500 },
          { id: '2', name: '李教練', specialties: ['進階技巧'], bio: '曾任職業選手', hourlyRate: 2000 },
        ],
      },
      story: {
        title: '森林裡的球場，生活裡的主場。',
        description: '揮拍、交流，也讓自己慢下來。',
        visible: true,
        photo1Id: undefined,
        photo2Id: undefined,
        photo3Id: undefined,
      },
      visit: {
        title: '下一站，大新店森林匹克球。',
        description: '',
        visible: true,
        photoId: undefined,
      },
      invite: {
        title: '下一場，約在森林裡。',
        description: '帶上想動一動的心情，來一場屬於你的匹克球時光。',
        visible: true,
        backgroundPhotoId: undefined,
      },
    },
  })

  const [availableSessions, setAvailableSessions] = useState<AvailableSession[]>([])
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>('plans')

  useEffect(() => {
    const loadData = async () => {
      try {
        // 並行加載配置和活動清單
        const [configRes, sessionsRes] = await Promise.all([
          fetch('/api/admin/home/config'),
          fetch('/api/admin/home/sessions'),
        ])

        if (configRes.ok) {
          const data = await configRes.json()
          if (data.data) setState(data.data)
        }

        if (sessionsRes.ok) {
          const data = await sessionsRes.json()
          if (data.sessions) setAvailableSessions(data.sessions)
        }
      } catch (err) {
        console.error('加載數據失敗:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSaveDraft = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/home/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      if (!response.ok) throw new Error('儲存失敗')
      setIsDirty(false)
      setMessage({ type: 'success', text: '✓ 草稿已儲存' })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: '✗ 儲存失敗' })
    } finally {
      setIsSaving(false)
    }
  }

  const toggleSessionSelection = (sessionId: string) => {
    setState((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        plans: {
          ...prev.sections.plans,
          selectedSessionIds: prev.sections.plans.selectedSessionIds.includes(sessionId)
            ? prev.sections.plans.selectedSessionIds.filter((id) => id !== sessionId)
            : [...prev.sections.plans.selectedSessionIds, sessionId],
        },
      },
    }))
    setIsDirty(true)
  }

  const moveSessionUp = (index: number) => {
    if (index > 0) {
      const newIds = [...state.sections.plans.selectedSessionIds]
      ;[newIds[index], newIds[index - 1]] = [newIds[index - 1], newIds[index]]
      setState((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          plans: { ...prev.sections.plans, selectedSessionIds: newIds },
        },
      }))
      setIsDirty(true)
    }
  }

  const moveSessionDown = (index: number) => {
    if (index < state.sections.plans.selectedSessionIds.length - 1) {
      const newIds = [...state.sections.plans.selectedSessionIds]
      ;[newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]]
      setState((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          plans: { ...prev.sections.plans, selectedSessionIds: newIds },
        },
      }))
      setIsDirty(true)
    }
  }

  if (isLoading) return <div className="text-center py-12">加載中...</div>

  const selectedSessions = state.sections.plans.selectedSessionIds
    .map((id) => availableSessions.find((s) => s.id === id))
    .filter(Boolean) as AvailableSession[]

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">官網頁面管理（Phase 2a：OPEN PLAY 活動選擇）</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-blue-700 font-medium"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '儲存中...' : '儲存草稿'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={cn(
            'rounded-lg border p-3 flex items-center gap-2 text-sm',
            message.type === 'success'
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          )}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* 左側編輯面板 */}
        <div className="lg:col-span-2 space-y-4 max-h-[800px] overflow-y-auto">
          {/* OPEN PLAY 活動選擇 - Phase 2a 核心 */}
          <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'plans' ? null : 'plans')}
              className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              🎮 編輯 OPEN PLAY（選擇首頁活動）
              {expandedSection === 'plans' ? '▼' : '▶'}
            </button>
            {expandedSection === 'plans' && (
              <div className="p-4 space-y-4 border-t">
                {/* 區塊標題與描述 */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">區塊標題</label>
                  <input
                    type="text"
                    value={state.sections.plans.title}
                    onChange={(e) => {
                      setState((p) => ({
                        ...p,
                        sections: {
                          ...p.sections,
                          plans: { ...p.sections.plans, title: e.target.value },
                        },
                      }))
                      setIsDirty(true)
                    }}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>

                {/* 可用活動清單 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">可用活動（共 {availableSessions.length} 場）</h3>
                  <div className="border border-gray-300 rounded bg-gray-50 max-h-[300px] overflow-y-auto">
                    {availableSessions.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-500">暫無活動</div>
                    ) : (
                      <ul className="divide-y">
                        {availableSessions.map((session) => (
                          <li key={session.id} className="p-3 hover:bg-white transition">
                            <label className="flex items-start gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={state.sections.plans.selectedSessionIds.includes(session.id)}
                                onChange={() => toggleSessionSelection(session.id)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm">{session.title}</div>
                                <div className="text-xs text-gray-600">
                                  {session.dateLabel} {session.timeLabel}
                                </div>
                                <div className="text-xs text-gray-500">
                                  NT${session.price} · {session.stateLabel}
                                </div>
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* 已選擇的活動順序 */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    首頁顯示順序（{selectedSessions.length} 場）
                  </h3>
                  {selectedSessions.length === 0 ? (
                    <div className="rounded border border-dashed border-gray-300 p-3 text-center text-sm text-gray-500">
                      選擇活動後會在此顯示
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {selectedSessions.map((session, index) => (
                        <li key={session.id} className="flex gap-2 items-center bg-blue-50 p-2 rounded border border-blue-200">
                          <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate">{session.title}</div>
                            <div className="text-xs text-gray-600">
                              {session.dateLabel} {session.timeLabel}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveSessionUp(index)}
                              disabled={index === 0}
                              className="rounded bg-gray-200 px-2 py-1 text-xs disabled:opacity-50 hover:bg-gray-300"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveSessionDown(index)}
                              disabled={index === selectedSessions.length - 1}
                              className="rounded bg-gray-200 px-2 py-1 text-xs disabled:opacity-50 hover:bg-gray-300"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => toggleSessionSelection(session.id)}
                              className="rounded bg-red-100 px-2 py-1 text-xs text-red-600 hover:bg-red-200"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <a
                  href="/admin/marketing/activities/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 font-medium w-full"
                >
                  <Plus className="h-4 w-4" />
                  前往新增活動
                  <ArrowRight className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {isDirty && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              ⚠️ 有未儲存的變更
            </div>
          )}
        </div>

        {/* 右側預覽 */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gray-300 bg-white p-4 sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">OPEN PLAY 區塊預覽（Phase 2a）</h2>
              <div className="flex gap-1">
                {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
                  <button
                    key={device}
                    onClick={() => setPreviewDevice(device)}
                    className={cn(
                      'px-3 py-1 text-xs rounded border font-medium',
                      previewDevice === device
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                    )}
                  >
                    {device === 'desktop' ? '💻' : '📱'} {device}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 overflow-auto max-h-[700px]">
              <div
                className={cn(
                  'bg-white p-6',
                  previewDevice === 'desktop' && 'w-full',
                  previewDevice === 'tablet' && 'w-[768px]',
                  previewDevice === 'mobile' && 'w-[390px]'
                )}
              >
                {/* 簡化預覽：只顯示 OPEN PLAY 活動區塊 */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-purple-600">PLAY</p>
                    <h2 className="text-2xl font-bold mt-2">{state.sections.plans.title}</h2>
                  </div>

                  <div className="bg-purple-600 text-white rounded-lg p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold">球友集合</h3>
                      <p className="text-sm text-white/85 mt-1">
                        報名一個場次，就能和不同的球友輪流上場。
                      </p>
                    </div>

                    {selectedSessions.length === 0 ? (
                      <div className="text-sm text-white/70 italic">
                        選擇活動後會在此顯示...
                      </div>
                    ) : (
                      <ul className="border-y border-white/15 divide-y divide-white/15">
                        {selectedSessions.map((s) => (
                          <li key={s.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 py-4">
                            <span className="font-bold text-lg tabular">{s.dateLabel}</span>
                            <span className="text-sm text-white/90">
                              {s.timeLabel}・{s.title}
                            </span>
                            <span className="text-right font-semibold tabular">NT${s.price}</span>
                            <span className="col-span-3 text-xs text-white/70">{s.stateLabel}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
