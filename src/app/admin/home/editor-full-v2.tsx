'use client'

import React, { useEffect, useRef, useState } from 'react'
import { THEME_ORDER, THEME_LABELS, type HomeTheme } from '@/lib/home-themes'
import { Save, AlertCircle, CheckCircle, Upload, X, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompletePreview } from './complete-preview'
import type { EditorState, EditorCoach } from './editor-types'

export function EditorFullV2({ username }: { username: string }) {
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

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>('hero')
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null)

  const heroFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/admin/home/config')
        if (res.ok) {
          const data = await res.json()
          if (data.data) setState(data.data)
        }
      } catch (err) {
        console.error('加載配置失敗:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
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

  const handleCoachPhotoUpload = async (coachId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '請選擇圖片文件' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: '圖片大小不超過 5MB' })
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string
      setState((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          coaching: {
            ...prev.sections.coaching,
            coaches: prev.sections.coaching.coaches.map((c) =>
              c.id === coachId ? { ...c, photoId: preview } : c
            ),
          },
        },
      }))
      setIsDirty(true)
    }
    reader.readAsDataURL(file)
  }

  const addCoach = () => {
    const newCoach: EditorCoach = {
      id: `coach_${Date.now()}`,
      name: '新教練',
      specialties: [],
      bio: '',
      hourlyRate: 1500,
    }
    setState((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        coaching: {
          ...prev.sections.coaching,
          coaches: [...prev.sections.coaching.coaches, newCoach],
        },
      },
    }))
    setEditingCoachId(newCoach.id)
    setIsDirty(true)
  }

  const deleteCoach = (coachId: string) => {
    setState((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        coaching: {
          ...prev.sections.coaching,
          coaches: prev.sections.coaching.coaches.filter((c) => c.id !== coachId),
        },
      },
    }))
    setIsDirty(true)
  }

  const updateCoach = (coachId: string, updates: Partial<EditorCoach>) => {
    setState((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        coaching: {
          ...prev.sections.coaching,
          coaches: prev.sections.coaching.coaches.map((c) =>
            c.id === coachId ? { ...c, ...updates } : c
          ),
        },
      },
    }))
    setIsDirty(true)
  }

  if (isLoading) return <div className="text-center py-12">加載中...</div>

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">官網頁面管理（Phase 1：教練合併）</h1>
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
          {/* 教練管理 - Phase 1 核心 */}
          <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'coaching' ? null : 'coaching')}
              className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              📋 編輯教練（合併後統一入口）
              {expandedSection === 'coaching' ? '▼' : '▶'}
            </button>
            {expandedSection === 'coaching' && (
              <div className="p-4 space-y-3 border-t">
                <button
                  onClick={addCoach}
                  className="w-full flex items-center gap-2 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 font-medium"
                >
                  <Plus className="h-4 w-4" />
                  新增教練
                </button>

                {state.sections.coaching.coaches.map((coach) => (
                  <div
                    key={coach.id}
                    className="rounded border border-gray-200 p-3 space-y-2 bg-gray-50"
                  >
                    {/* 教練名稱 & 刪除 */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={coach.name}
                        onChange={(e) => updateCoach(coach.id, { name: e.target.value })}
                        placeholder="教練名稱"
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => deleteCoach(coach.id)}
                        className="rounded bg-red-100 px-2 py-1 text-red-600 hover:bg-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* 時薪 */}
                    <div>
                      <label className="text-xs text-gray-600">時薪</label>
                      <input
                        type="number"
                        value={coach.hourlyRate}
                        onChange={(e) => updateCoach(coach.id, { hourlyRate: parseInt(e.target.value) })}
                        placeholder="1500"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* 自介 */}
                    <div>
                      <label className="text-xs text-gray-600">自介</label>
                      <textarea
                        value={coach.bio}
                        onChange={(e) => updateCoach(coach.id, { bio: e.target.value })}
                        placeholder="e.g. 10年教學經驗"
                        rows={2}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>

                    {/* 教練照片 - Phase 1 重點 */}
                    <div>
                      <label className="text-xs text-gray-600 font-medium mb-1 block">教練照片</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleCoachPhotoUpload(coach.id, e.target.files[0])
                          }
                        }}
                        className="w-full text-xs"
                      />
                      {coach.photoId && (
                        <div className="mt-2 relative">
                          <img
                            src={coach.photoId}
                            alt={coach.name}
                            className="w-full h-32 object-cover rounded border border-gray-300"
                          />
                          <button
                            onClick={() => updateCoach(coach.id, { photoId: undefined })}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 專長 - 簡化 */}
                    <div>
                      <label className="text-xs text-gray-600">專長（逗號分隔）</label>
                      <input
                        type="text"
                        value={coach.specialties.join(', ')}
                        onChange={(e) =>
                          updateCoach(coach.id, {
                            specialties: e.target.value.split(',').map((s) => s.trim()),
                          })
                        }
                        placeholder="基礎訓練, 進階技巧"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                ))}
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

        {/* 右側預覽 - 顯示教練區塊 */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gray-300 bg-white p-4 sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">教練區塊預覽（Phase 1）</h2>
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
                    {device === 'desktop' ? '💻' : device === 'tablet' ? '📱' : '📱'} {device}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 overflow-auto max-h-[700px]">
              <div
                className={cn(
                  'bg-white',
                  previewDevice === 'desktop' && 'w-full',
                  previewDevice === 'tablet' && 'w-[768px]',
                  previewDevice === 'mobile' && 'w-[390px]'
                )}
              >
                {/* 簡化預覽：只顯示教練區塊 */}
                <div className="p-6 space-y-4">
                  <h2 className="text-2xl font-bold">{state.sections.coaching.title}</h2>
                  <p className="text-gray-600">{state.sections.coaching.description}</p>

                  <div className="space-y-4 mt-6">
                    {state.sections.coaching.coaches.map((coach) => (
                      <div
                        key={coach.id}
                        className="border rounded-lg p-4 grid sm:grid-cols-[120px_1fr] gap-4"
                      >
                        {coach.photoId ? (
                          <img
                            src={coach.photoId}
                            alt={coach.name}
                            className="w-full h-32 object-cover rounded bg-gray-200"
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-300 rounded flex items-center justify-center text-gray-500 text-sm">
                            無照片
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-lg">{coach.name}</h3>
                          {coach.specialties.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {coach.specialties.map((s) => (
                                <span
                                  key={s}
                                  className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          {coach.bio && <p className="text-sm text-gray-600 mt-2">{coach.bio}</p>}
                          {coach.hourlyRate > 0 && (
                            <p className="text-sm font-semibold mt-2">NT${coach.hourlyRate}/小時</p>
                          )}
                        </div>
                      </div>
                    ))}
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
