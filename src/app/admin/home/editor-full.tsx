'use client'

import React, { useEffect, useRef, useState } from 'react'
import { THEME_ORDER, THEME_LABELS, type HomeTheme } from '@/lib/home-themes'
import { Check, Save, Eye, AlertCircle, CheckCircle, Upload, X, Plus, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompletePreview } from './complete-preview'
import type { EditorState } from './editor-types'

interface Coach {
  id: string
  name: string
  specialties: string[]
  bio: string
  hourlyRate: number
}

export function EditorFull({ username }: { username: string }) {
  const [state, setState] = useState<EditorState>({
    theme: 'purple',
    hero: {
      title: '在森林裡，打出你的節奏。',
      subtitle: '大新店森林匹克球',
      description: '來大新店森林匹克球，享受揮拍的暢快，也享受相聚的時光。線上預約場地、報名球友集合場次。',
      buttonText: '立即預約',
      buttonLink: '/booking',
    },
    sections: {
      plans: { title: '今天，你想怎麼玩？', description: '揪朋友一起開打，或加入一場新的相遇。', visible: true, selectedSessionIds: [] },
      coaching: { title: '第一球，到下一個突破。', description: '找到適合你的練習節奏，讓每次上場都有新收穫。', visible: true, coaches: [] },
      story: { title: '森林裡的球場，生活裡的主場。', description: '揮拍、交流，也讓自己慢下來。', visible: true },
      visit: { title: '下一站，大新店森林匹克球。', description: '', visible: true },
      invite: { title: '下一場，約在森林裡。', description: '帶上想動一動的心情，來一場屬於你的匹克球時光。', visible: true },
    },
  })

  const [coaches, setCoaches] = useState<Coach[]>([
    { id: '1', name: '王教練', specialties: ['基礎訓練'], bio: '10年教學經驗', hourlyRate: 1500 },
    { id: '2', name: '李教練', specialties: ['進階技巧'], bio: '曾任職業選手', hourlyRate: 2000 },
  ])

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null)
  const [storyImagePreview, setStoryImagePreview] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('hero')
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null)
  const heroFileInputRef = useRef<HTMLInputElement>(null)
  const storyFileInputRef = useRef<HTMLInputElement>(null)
  const [scale, setScale] = useState(1)

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

  const handleImageUpload = async (file: File, type: 'hero' | 'story') => {
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
      if (type === 'hero') setHeroImagePreview(preview)
      else setStoryImagePreview(preview)
    }
    reader.readAsDataURL(file)
    setIsDirty(true)
  }

  const handleAddCoach = () => {
    const newCoach: Coach = {
      id: `coach_${Date.now()}`,
      name: '新教練',
      specialties: [],
      bio: '',
      hourlyRate: 1500,
    }
    setCoaches([...coaches, newCoach])
    setEditingCoach(newCoach)
    setIsDirty(true)
  }

  const handleDeleteCoach = (id: string) => {
    setCoaches(coaches.filter((c) => c.id !== id))
    setIsDirty(true)
  }

  const handleUpdateCoach = (coach: Coach) => {
    setCoaches(coaches.map((c) => (c.id === coach.id ? coach : c)))
    setIsDirty(true)
  }

  if (isLoading) return <div className="text-center py-12">加載中...</div>

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">官網頁面管理</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={!isDirty || isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-blue-700 font-medium"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '儲存中...' : '儲存草稿'}
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 font-medium">
            <Eye className="h-4 w-4" />
            發布
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
          {/* 主視覺編輯 */}
          <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'hero' ? null : 'hero')}
              className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              編輯首頁主視覺
              {expandedSection === 'hero' ? '▼' : '▶'}
            </button>
            {expandedSection === 'hero' && (
              <div className="p-4 space-y-3 border-t">
                <input
                  type="text"
                  value={state.hero.title}
                  onChange={(e) => {
                    setState((p) => ({ ...p, hero: { ...p.hero, title: e.target.value } }))
                    setIsDirty(true)
                  }}
                  placeholder="標題"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="text"
                  value={state.hero.subtitle}
                  onChange={(e) => {
                    setState((p) => ({ ...p, hero: { ...p.hero, subtitle: e.target.value } }))
                    setIsDirty(true)
                  }}
                  placeholder="副標題"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <textarea
                  value={state.hero.description}
                  onChange={(e) => {
                    setState((p) => ({ ...p, hero: { ...p.hero, description: e.target.value } }))
                    setIsDirty(true)
                  }}
                  placeholder="描述"
                  rows={3}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="file"
                  ref={heroFileInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleImageUpload(e.target.files[0], 'hero')
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => heroFileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-xs text-gray-500"
                >
                  <Upload className="h-4 w-4 mx-auto mb-1" />
                  點擊上傳主圖
                </button>
                {heroImagePreview && (
                  <div className="relative">
                    <img src={heroImagePreview} alt="預覽" className="w-full h-32 object-cover rounded" />
                    <button
                      onClick={() => setHeroImagePreview(null)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 教練管理 */}
          <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'coaches' ? null : 'coaches')}
              className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              編輯教練
              {expandedSection === 'coaches' ? '▼' : '▶'}
            </button>
            {expandedSection === 'coaches' && (
              <div className="p-4 space-y-3 border-t">
                <button
                  onClick={handleAddCoach}
                  className="w-full flex items-center gap-2 rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                >
                  <Plus className="h-4 w-4" />
                  新增教練
                </button>

                {coaches.map((coach) => (
                  <div key={coach.id} className="rounded border border-gray-200 p-3 space-y-2 bg-gray-50">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={coach.name}
                        onChange={(e) => handleUpdateCoach({ ...coach, name: e.target.value })}
                        placeholder="教練名稱"
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => handleDeleteCoach(coach.id)}
                        className="rounded bg-red-100 px-2 py-1 text-red-600 hover:bg-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={coach.hourlyRate}
                      onChange={(e) => handleUpdateCoach({ ...coach, hourlyRate: parseInt(e.target.value) })}
                      placeholder="時薪"
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <textarea
                      value={coach.bio}
                      onChange={(e) => handleUpdateCoach({ ...coach, bio: e.target.value })}
                      placeholder="自介"
                      rows={2}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 其他區塊編輯 */}
          {(Object.keys(state.sections) as Array<keyof typeof state.sections>).map((sectionKey) => (
            <div key={sectionKey} className="rounded-lg border border-gray-300 bg-white overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === sectionKey ? null : sectionKey)}
                className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
              >
                {sectionKey === 'plans' && '編輯 OPEN PLAY'}
                {sectionKey === 'coaching' && '編輯教練區'}
                {sectionKey === 'story' && '編輯場館故事'}
                {sectionKey === 'visit' && '編輯訪問資訊'}
                {sectionKey === 'invite' && '編輯邀請區'}
                {expandedSection === sectionKey ? '▼' : '▶'}
              </button>
              {expandedSection === sectionKey && (
                <div className="p-4 space-y-3 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.sections[sectionKey].visible}
                      onChange={(e) => {
                        setState((p) => ({
                          ...p,
                          sections: { ...p.sections, [sectionKey]: { ...p.sections[sectionKey], visible: e.target.checked } },
                        }))
                        setIsDirty(true)
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">顯示此區塊</span>
                  </label>
                  <input
                    type="text"
                    value={state.sections[sectionKey].title}
                    onChange={(e) => {
                      setState((p) => ({
                        ...p,
                        sections: { ...p.sections, [sectionKey]: { ...p.sections[sectionKey], title: e.target.value } },
                      }))
                      setIsDirty(true)
                    }}
                    placeholder="標題"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <textarea
                    value={state.sections[sectionKey].description}
                    onChange={(e) => {
                      setState((p) => ({
                        ...p,
                        sections: { ...p.sections, [sectionKey]: { ...p.sections[sectionKey], description: e.target.value } },
                      }))
                      setIsDirty(true)
                    }}
                    placeholder="描述"
                    rows={2}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 右側預覽 */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gray-300 bg-white p-4 sticky top-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">預覽</h2>
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

            <div className="rounded-lg bg-gray-50 overflow-auto max-h-[700px]" style={{ transform: `scale(${scale})`, transformOrigin: 'top' }}>
              <div
                className={cn(
                  'bg-white',
                  previewDevice === 'desktop' && 'w-full',
                  previewDevice === 'tablet' && 'w-[768px]',
                  previewDevice === 'mobile' && 'w-[390px]'
                )}
              >
                <CompletePreview state={state} heroImageUrl={heroImagePreview || undefined} storyImageUrl={storyImagePreview || undefined} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDirty && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          ⚠️ 有未儲存的變更
        </div>
      )}
    </div>
  )
}
