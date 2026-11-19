'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Save, AlertCircle, CheckCircle, Upload, X, Clock, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THEME_COLORS, THEME_LABELS, THEME_ORDER, type HomeTheme } from '@/lib/home-themes'
import type { EditorState, VersionHistoryItem } from './editor-types'

interface DialogState {
  type: 'versions' | 'activity-select' | null
  open: boolean
}

export function EditorFullC({ username }: { username: string }) {
  const [state, setState] = useState<EditorState>({
    theme: 'purple',
    hero: {
      title: '在森林裡，打出你的節奏。',
      subtitle: '大新店森林匹克球',
      description: '來大新店森林匹克球，享受揮拍的暢快，也享受相聚的時光。',
      buttonText: '立即預約',
      buttonLink: '/booking',
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
        coaches: [],
      },
      story: {
        title: '森林裡的球場，生活裡的主場。',
        description: '揮拍、交流，也讓自己慢下來。',
        visible: true,
      },
      visit: {
        title: '下一站，大新店森林匹克球。',
        description: '',
        visible: true,
      },
      invite: {
        title: '下一場，約在森林裡。',
        description: '帶上想動一動的心情，來一場屬於你的匹克球時光。',
        visible: true,
      },
    },
    selectedActivityIds: [],
  })

  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dialog, setDialog] = useState<DialogState>({ type: null, open: false })
  const [versions, setVersions] = useState<VersionHistoryItem[]>([])
  const [publishedVersion, setPublishedVersion] = useState<EditorState | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [activities, setActivities] = useState<Array<{ id: string; name: string; date: string; courts?: string }>>([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  const photoRefs = {
    hero: useRef<HTMLInputElement>(null),
    story1: useRef<HTMLInputElement>(null),
    story2: useRef<HTMLInputElement>(null),
    story3: useRef<HTMLInputElement>(null),
    visit: useRef<HTMLInputElement>(null),
    invite: useRef<HTMLInputElement>(null),
  }

  // 加載初始數據
  useEffect(() => {
    const loadData = async () => {
      try {
        const configRes = await fetch('/api/admin/home/config')
        if (configRes.ok) {
          const data = await configRes.json()
          if (data.data) setState(data.data)
        }

        const versionsRes = await fetch('/api/admin/home/versions')
        if (versionsRes.ok) {
          const data = await versionsRes.json()
          if (data.data) {
            setVersions(data.data)
            const published = data.data.find((v: VersionHistoryItem) => v.versionType === 'PUBLISHED')
            if (published) setPublishedVersion(published.config)
          }
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

  const handlePublish = async () => {
    setIsSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/home/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('發布失敗')
      setMessage({ type: 'success', text: '✓ 已發布到正式首頁' })
      setTimeout(() => setMessage(null), 3000)
      // 重新載入版本
      const versionsRes = await fetch('/api/admin/home/versions')
      if (versionsRes.ok) {
        const data = await versionsRes.json()
        if (data.data) {
          setVersions(data.data)
          const published = data.data.find((v: VersionHistoryItem) => v.versionType === 'PUBLISHED')
          if (published) setPublishedVersion(published.config)
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: '✗ 發布失敗' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleRestoreVersion = async (versionId: string) => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/home/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })
      if (!response.ok) throw new Error('還原失敗')
      const data = await response.json()
      if (data.data) setState(data.data)
      setDialog({ type: null, open: false })
      setMessage({ type: 'success', text: '✓ 已還原版本' })
    } catch (err) {
      setMessage({ type: 'error', text: '✗ 還原失敗' })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePhotoUpload = (section: keyof typeof photoRefs, file: File) => {
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

      setState((prev) => {
        if (section === 'hero') {
          return { ...prev, hero: { ...prev.hero, photoId: preview } }
        }
        if (section.startsWith('story')) {
          const photoNum = section.slice(-1) as '1' | '2' | '3'
          return {
            ...prev,
            sections: {
              ...prev.sections,
              story: { ...prev.sections.story, [`photo${photoNum}Id`]: preview },
            },
          }
        }
        if (section === 'visit') {
          return {
            ...prev,
            sections: { ...prev.sections, visit: { ...prev.sections.visit, photoId: preview } },
          }
        }
        if (section === 'invite') {
          return {
            ...prev,
            sections: { ...prev.sections, invite: { ...prev.sections.invite, backgroundPhotoId: preview } },
          }
        }
        return prev
      })
      setIsDirty(true)
    }
    reader.readAsDataURL(file)
  }

  const loadActivities = async () => {
    setLoadingActivities(true)
    try {
      const res = await fetch('/api/admin/home/sessions')
      if (res.ok) {
        const data = await res.json()
        const list = data.data || data.sessions || []
        if (Array.isArray(list)) {
          setActivities(
            list.map((item: any) => ({
              id: item.id,
              name: item.title || `活動 ${item.id}`,
              date: `${item.dateLabel} ${item.timeLabel}`,
              courts: undefined,
            }))
          )
        }
      }
    } catch (err) {
      console.error('載入活動失敗:', err)
    } finally {
      setLoadingActivities(false)
    }
  }

  const handleActivityToggle = (activityId: string) => {
    setState((prev) => {
      const current = prev.selectedActivityIds || []
      let updated: string[]
      if (current.includes(activityId)) {
        updated = current.filter((id) => id !== activityId)
      } else {
        if (current.length >= 2) return prev
        updated = [...current, activityId]
      }
      return { ...prev, selectedActivityIds: updated }
    })
  }

  if (isLoading) return <div className="text-center py-12">加載中...</div>

  const currentThemeColors = THEME_COLORS[state.theme]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部欄 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
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
            <button
              onClick={handlePublish}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-green-700 font-medium"
            >
              <CheckCircle className="h-4 w-4" />
              {isSaving ? '發布中...' : '發布'}
            </button>
            <button
              onClick={() => setDialog({ type: 'versions', open: true })}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-100 font-medium"
            >
              <Clock className="h-4 w-4" />
              版本
            </button>
          </div>
        </div>

        {message && (
          <div
            className={cn(
              'mt-3 rounded-lg border p-3 flex items-center gap-2 text-sm',
              message.type === 'success' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'
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
      </div>

      {/* 主題選擇區 */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <h2 className="text-lg font-semibold mb-4">選擇主題</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {THEME_ORDER.map((theme) => (
            <button
              key={theme}
              onClick={() => {
                setState((prev) => ({ ...prev, theme }))
                setIsDirty(true)
              }}
              className={cn(
                'p-4 rounded-lg border-2 transition-all text-left',
                state.theme === theme
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-300'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="font-semibold text-sm mb-2">{THEME_LABELS[theme]}</div>
              <div className="flex gap-1 mb-2">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: THEME_COLORS[theme].primary }} />
                <div className="w-6 h-6 rounded" style={{ backgroundColor: THEME_COLORS[theme].primaryLight }} />
                <div className="w-6 h-6 rounded" style={{ backgroundColor: THEME_COLORS[theme].secondary }} />
              </div>
              {state.theme === theme && (
                <div className="text-blue-600 text-xs font-semibold">✓ 已選擇</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 內容編輯區 + 預覽 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-6">
        {/* 左側編輯面板 */}
        <div className="lg:col-span-2 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* 主視覺編輯 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">主視覺</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">標題</label>
                <input
                  type="text"
                  value={state.hero.title}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, title: e.target.value },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">副標題</label>
                <input
                  type="text"
                  value={state.hero.subtitle}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, subtitle: e.target.value },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">描述</label>
                <textarea
                  value={state.hero.description}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      hero: { ...prev.hero, description: e.target.value },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">主圖</label>
                <input
                  type="file"
                  ref={photoRefs.hero}
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload('hero', e.target.files[0])}
                  className="hidden"
                />
                <button
                  onClick={() => photoRefs.hero.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 text-sm text-gray-600"
                >
                  <Upload className="h-4 w-4 mx-auto mb-1" />
                  點擊上傳主圖
                </button>
                {state.hero.photoId && (
                  <div className="mt-2 relative">
                    <img src={state.hero.photoId} alt="主圖" className="w-full h-32 object-cover rounded border border-gray-200" />
                    <button
                      onClick={() =>
                        setState((prev) => ({ ...prev, hero: { ...prev.hero, photoId: undefined } }))
                      }
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* OPEN PLAY 編輯 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">球友集合</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">標題</label>
                <input
                  type="text"
                  value={state.sections.plans.title}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      sections: {
                        ...prev.sections,
                        plans: { ...prev.sections.plans, title: e.target.value },
                      },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">文案</label>
                <textarea
                  value={state.sections.plans.description}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      sections: {
                        ...prev.sections,
                        plans: { ...prev.sections.plans, description: e.target.value },
                      },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                />
              </div>
              <button
                onClick={() => {
                  setDialog({ type: 'activity-select', open: true })
                  loadActivities()
                }}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium"
              >
                選擇活動（已選 {state.selectedActivityIds?.length || 0} 場）
              </button>
            </div>
          </div>

          {/* 教練編輯 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">教練區塊</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">標題</label>
                <input
                  type="text"
                  value={state.sections.coaching.title}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      sections: {
                        ...prev.sections,
                        coaching: { ...prev.sections.coaching, title: e.target.value },
                      },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">文案</label>
                <textarea
                  value={state.sections.coaching.description}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      sections: {
                        ...prev.sections,
                        coaching: { ...prev.sections.coaching, description: e.target.value },
                      },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* 場館故事編輯 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">場館故事</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">標題</label>
                <input
                  type="text"
                  value={state.sections.story.title}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, story: { ...prev.sections.story, title: e.target.value } },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              {(['story1', 'story2', 'story3'] as const).map((photo, idx) => (
                <div key={photo} className="border-t pt-3">
                  <label className="text-sm font-medium block mb-1">
                    {idx === 0 ? '大圖' : idx === 1 ? '小圖左' : '小圖右'}
                  </label>
                  <input
                    type="file"
                    ref={photoRefs[photo]}
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handlePhotoUpload(photo, e.target.files[0])}
                    className="hidden"
                  />
                  <button
                    onClick={() => photoRefs[photo].current?.click()}
                    className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-xs text-gray-600"
                  >
                    點擊上傳
                  </button>
                  {state.sections.story[`photo${idx + 1}Id` as keyof typeof state.sections.story] && (
                    <div className="mt-2 relative">
                      <img
                        src={state.sections.story[`photo${idx + 1}Id` as keyof typeof state.sections.story] as string}
                        alt={`Story photo ${idx + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        onClick={() => {
                          setState((p) => ({
                            ...p,
                            sections: {
                              ...p.sections,
                              story: { ...p.sections.story, [`photo${idx + 1}Id`]: undefined },
                            },
                          }))
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 到訪資訊編輯 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">到訪資訊</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">標題</label>
                <input
                  type="text"
                  value={state.sections.visit.title}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, visit: { ...prev.sections.visit, title: e.target.value } },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">照片</label>
                <input
                  type="file"
                  ref={photoRefs.visit}
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload('visit', e.target.files[0])}
                  className="hidden"
                />
                <button
                  onClick={() => photoRefs.visit.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-sm text-gray-600"
                >
                  <Upload className="h-4 w-4 mx-auto mb-1" />
                  點擊上傳
                </button>
                {state.sections.visit.photoId && (
                  <div className="mt-2 relative">
                    <img src={state.sections.visit.photoId} alt="Visit" className="w-full h-32 object-cover rounded border" />
                    <button
                      onClick={() => setState((p) => ({ ...p, sections: { ...p.sections, visit: { ...p.sections.visit, photoId: undefined } } }))}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 邀請區編輯 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">邀請區</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">標題</label>
                <input
                  type="text"
                  value={state.sections.invite.title}
                  onChange={(e) => {
                    setState((prev) => ({
                      ...prev,
                      sections: { ...prev.sections, invite: { ...prev.sections.invite, title: e.target.value } },
                    }))
                    setIsDirty(true)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">背景照片</label>
                <input
                  type="file"
                  ref={photoRefs.invite}
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handlePhotoUpload('invite', e.target.files[0])}
                  className="hidden"
                />
                <button
                  onClick={() => photoRefs.invite.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-sm text-gray-600"
                >
                  <Upload className="h-4 w-4 mx-auto mb-1" />
                  點擊上傳
                </button>
                {state.sections.invite.backgroundPhotoId && (
                  <div className="mt-2 relative">
                    <img src={state.sections.invite.backgroundPhotoId} alt="Invite" className="w-full h-32 object-cover rounded border" />
                    <button
                      onClick={() => setState((p) => ({ ...p, sections: { ...p.sections, invite: { ...p.sections.invite, backgroundPhotoId: undefined } } }))}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右側預覽 */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-[100px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">預覽</h3>
              <div className="flex gap-2">
                {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
                  <button
                    key={device}
                    onClick={() => setPreviewDevice(device)}
                    className={cn(
                      'px-3 py-1 text-xs rounded border',
                      previewDevice === device ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:border-gray-400'
                    )}
                  >
                    {device === 'desktop' ? '電腦' : device === 'tablet' ? '平板' : '手機'}
                  </button>
                ))}
              </div>
            </div>
            <div
              className={cn('overflow-auto rounded-lg bg-gray-100', {
                'w-full h-[800px]': previewDevice === 'desktop',
                'w-[768px] h-[1024px]': previewDevice === 'tablet',
                'w-[375px] h-[667px]': previewDevice === 'mobile',
              })}
            >
              <div className="bg-white w-full h-full overflow-auto">
                <div className="p-6 space-y-6">
                  {/* 主視覺預覽 */}
                  <div
                    className="relative w-full h-48 rounded-lg overflow-hidden"
                    style={{ backgroundColor: currentThemeColors.primary }}
                  >
                    {state.hero.photoId ? (
                      <img src={state.hero.photoId} alt="Hero" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50">
                        無主圖
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 flex flex-col justify-end p-6 text-white">
                      <h1 className="text-2xl font-bold">{state.hero.title}</h1>
                      <p className="text-sm mt-2">{state.hero.subtitle}</p>
                    </div>
                  </div>

                  {/* OPEN PLAY 預覽 */}
                  <div
                    className="p-4 rounded-lg text-white"
                    style={{ backgroundColor: currentThemeColors.primary }}
                  >
                    <h2 className="font-bold">{state.sections.plans.title}</h2>
                    <p className="text-sm mt-2">{state.sections.plans.description}</p>
                  </div>

                  {/* 教練預覽 */}
                  <div className="border-t pt-4">
                    <h2 className="font-bold" style={{ color: currentThemeColors.primary }}>
                      {state.sections.coaching.title}
                    </h2>
                    <p className="text-sm text-gray-600 mt-2">{state.sections.coaching.description}</p>
                  </div>

                  {/* 場館故事預覽 */}
                  {state.sections.story.photo1Id && (
                    <div className="border-t pt-4">
                      <h2 className="font-bold">{state.sections.story.title}</h2>
                      <img src={state.sections.story.photo1Id} alt="Story" className="w-full h-32 object-cover rounded mt-2" />
                    </div>
                  )}

                  {/* 到訪資訊預覽 */}
                  {state.sections.visit.photoId && (
                    <div className="border-t pt-4">
                      <h2 className="font-bold">{state.sections.visit.title}</h2>
                      <img src={state.sections.visit.photoId} alt="Visit" className="w-full h-32 object-cover rounded mt-2" />
                    </div>
                  )}

                  {/* 邀請區預覽 */}
                  <div
                    className="relative p-6 rounded-lg text-white overflow-hidden"
                    style={{ backgroundColor: currentThemeColors.primary }}
                  >
                    {state.sections.invite.backgroundPhotoId && (
                      <img
                        src={state.sections.invite.backgroundPhotoId}
                        alt="Invite"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative">
                      <h2 className="font-bold">{state.sections.invite.title}</h2>
                      <p className="text-sm mt-2">{state.sections.invite.description}</p>
                    </div>
                  </div>

                  {/* 主題色展示 */}
                  <div className="border-t pt-4">
                    <p className="text-xs text-gray-600 mb-2">當前主題色</p>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: currentThemeColors.primary }} title="主色" />
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: currentThemeColors.primaryLight }} title="淺主色" />
                      <div className="w-8 h-8 rounded" style={{ backgroundColor: currentThemeColors.secondary }} title="次色" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 活動選擇對話框 */}
      {dialog.type === 'activity-select' && dialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">選擇活動（最多2場）</h2>
              <button onClick={() => setDialog({ type: null, open: false })} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <p className="text-sm text-gray-600 mb-4">
                從現有活動中選擇最多 2 場展示在首頁。已選 {state.selectedActivityIds?.length || 0} 場。
              </p>
              {loadingActivities ? (
                <div className="text-sm text-gray-500 text-center py-8">加載中...</div>
              ) : activities.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">暫無活動</div>
              ) : (
                <div className="space-y-2">
                  {activities.map((activity) => (
                    <label key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.selectedActivityIds?.includes(activity.id) || false}
                        onChange={() => handleActivityToggle(activity.id)}
                        disabled={(state.selectedActivityIds?.length || 0) >= 2 && !state.selectedActivityIds?.includes(activity.id)}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{activity.name}</div>
                        <div className="text-xs text-gray-500">{activity.date}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 版本對話框 */}
      {dialog.type === 'versions' && dialog.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">版本歷史</h2>
              <button
                onClick={() => setDialog({ type: null, open: false })}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {versions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暫無版本記錄</p>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="border rounded-lg p-3 flex items-start justify-between hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-sm">
                          {version.versionType === 'PUBLISHED' ? '📢 已發布' : '📝 草稿'}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {new Date(version.createdAt).toLocaleString('zh-TW')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">操作者：{version.operatedBy}</div>
                      </div>
                      {version.versionType === 'DRAFT' && (
                        <button
                          onClick={() => handleRestoreVersion(version.id)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          還原
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
