'use client'

import React, { useEffect, useRef, useState } from 'react'
import { THEME_ORDER, THEME_LABELS, type HomeTheme, THEME_COLORS } from '@/lib/home-themes'
import { Check, Save, Eye, AlertCircle, CheckCircle, Upload, Eye as EyeIcon, EyeOff, X, Plus, Trash2 } from 'lucide-react'
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

export function HomeEditorClient({ username }: { username: string }) {
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
      plans: {
        title: 'OPEN PLAY／訂場',
        description: '靈活的訂場系統，支援臨時報名和固定會員時段',
        visible: true,
      },
      coaching: {
        title: '教練',
        description: '專業教練團隊，提供個人和團體課程',
        visible: true,
      },
      story: {
        title: '場館故事',
        description: '在森林中打球的獨特體驗',
        visible: true,
      },
      visit: {
        title: '到訪資訊',
        description: '交通指南和場館時間',
        visible: true,
      },
      invite: {
        title: '邀請',
        description: '邀請朋友一起打球',
        visible: true,
      },
    },
    selectedActivityIds: [],
  })

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [expandedSection, setExpandedSection] = useState<string | null>('hero')
  const [uploadingImage, setUploadingImage] = useState<string | null>(null)
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null)
  const [storyImagePreview, setStoryImagePreview] = useState<string | null>(null)
  const heroFileInputRef = useRef<HTMLInputElement>(null)
  const storyFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/admin/home/config')
        if (res.ok) {
          const data = await res.json()
          if (data.data) {
            setState(data.data)
          }
        }
      } catch (err) {
        console.error('加載配置失敗:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [])

  const handleThemeChange = (theme: HomeTheme) => {
    setState((prev) => ({ ...prev, theme }))
    setIsDirty(true)
  }

  const handleHeroFieldChange = (field: keyof EditorState['hero'], value: string) => {
    setState((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }))
    setIsDirty(true)
  }

  const handleSectionChange = (
    sectionKey: keyof EditorState['sections'],
    field: 'title' | 'description',
    value: string
  ) => {
    setState((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: { ...prev.sections[sectionKey], [field]: value },
      },
    }))
    setIsDirty(true)
  }

  const handleSectionVisibilityToggle = (sectionKey: keyof EditorState['sections']) => {
    setState((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: { ...prev.sections[sectionKey], visible: !prev.sections[sectionKey].visible },
      },
    }))
    setIsDirty(true)
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

    setUploadingImage(type)
    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string
      if (type === 'hero') {
        setHeroImagePreview(preview)
      } else {
        setStoryImagePreview(preview)
      }
    }
    reader.readAsDataURL(file)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch('/api/admin/home/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('上傳失敗')
      const data = await response.json()

      setState((prev) => {
        if (type === 'hero') {
          return { ...prev, hero: { ...prev.hero, imageId: data.imageId } }
        } else {
          return {
            ...prev,
            sections: {
              ...prev.sections,
              story: { ...prev.sections.story, imageId: data.imageId },
            },
          }
        }
      })
      setIsDirty(true)
      setMessage({ type: 'success', text: '✓ 圖片上傳成功' })
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      setMessage({ type: 'error', text: '✗ 上傳失敗：' + (err instanceof Error ? err.message : '未知錯誤') })
      if (type === 'hero') setHeroImagePreview(null)
      if (type === 'story') setStoryImagePreview(null)
    } finally {
      setUploadingImage(null)
    }
  }

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
      setMessage({ type: 'error', text: '✗ 儲存失敗：' + (err instanceof Error ? err.message : '未知錯誤') })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">加載中...</div>
  }

  const sectionLabels: Record<keyof EditorState['sections'], string> = {
    plans: 'OPEN PLAY／訂場',
    coaching: '教練',
    story: '場館故事',
    visit: '到訪資訊',
    invite: '邀請區塊',
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
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
        {/* 左側：編輯面板 */}
        <div className="lg:col-span-2 space-y-4 max-h-[800px] overflow-y-auto">
          {/* 主題選擇 */}
          <div className="rounded-lg border border-gray-300 bg-white p-4">
            <h2 className="font-semibold text-sm mb-3">選擇主題</h2>
            <div className="space-y-2">
              {THEME_ORDER.map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(theme)}
                  className={cn(
                    'relative w-full rounded-lg border-2 p-3 text-left transition-all',
                    state.theme === theme
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{THEME_LABELS[theme]}</p>
                      <div className="mt-1 flex gap-1">
                        {(['primary', 'primaryLight', 'secondary'] as const).map((key) => (
                          <div
                            key={key}
                            className="h-3 w-3 rounded"
                            style={{ backgroundColor: THEME_COLORS[theme][key] }}
                          />
                        ))}
                      </div>
                    </div>
                    {state.theme === theme && <Check className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">標題</label>
                  <input
                    type="text"
                    value={state.hero.title}
                    onChange={(e) => handleHeroFieldChange('title', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">副標題</label>
                  <input
                    type="text"
                    value={state.hero.subtitle}
                    onChange={(e) => handleHeroFieldChange('subtitle', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
                  <textarea
                    value={state.hero.description}
                    onChange={(e) => handleHeroFieldChange('description', e.target.value)}
                    rows={3}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">按鈕文字</label>
                  <input
                    type="text"
                    value={state.hero.buttonText}
                    onChange={(e) => handleHeroFieldChange('buttonText', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">按鈕連結</label>
                  <input
                    type="text"
                    value={state.hero.buttonLink}
                    onChange={(e) => handleHeroFieldChange('buttonLink', e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">主圖</label>
                  <input
                    ref={heroFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0], 'hero')
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    onClick={() => heroFileInputRef.current?.click()}
                    disabled={uploadingImage === 'hero'}
                    className={cn(
                      'w-full border-2 border-dashed rounded p-4 text-center transition-colors',
                      uploadingImage === 'hero'
                        ? 'border-gray-400 bg-gray-50'
                        : 'border-gray-300 hover:border-blue-400 cursor-pointer'
                    )}
                  >
                    <Upload className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                    <p className="text-xs text-gray-500">
                      {uploadingImage === 'hero' ? '上傳中...' : '點擊上傳圖片'}
                    </p>
                  </button>
                  {heroImagePreview && (
                    <div className="mt-2 relative">
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
              </div>
            )}
          </div>

          {/* 其他區塊編輯 */}
          {(Object.keys(state.sections) as Array<keyof EditorState['sections']>).map((sectionKey) => (
            <div key={sectionKey} className="rounded-lg border border-gray-300 bg-white overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === sectionKey ? null : sectionKey)}
                className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  {state.sections[sectionKey].visible ? (
                    <EyeIcon className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  )}
                  {sectionLabels[sectionKey]}
                </span>
                {expandedSection === sectionKey ? '▼' : '▶'}
              </button>
              {expandedSection === sectionKey && (
                <div className="p-4 space-y-3 border-t">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={state.sections[sectionKey].visible}
                      onChange={() => handleSectionVisibilityToggle(sectionKey)}
                      className="rounded"
                    />
                    <label className="text-sm text-gray-700">顯示此區塊</label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">區塊標題</label>
                    <input
                      type="text"
                      value={state.sections[sectionKey].title}
                      onChange={(e) => handleSectionChange(sectionKey, 'title', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">區塊描述</label>
                    <textarea
                      value={state.sections[sectionKey].description}
                      onChange={(e) => handleSectionChange(sectionKey, 'description', e.target.value)}
                      rows={2}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </div>
                  {sectionKey === 'story' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">區塊圖片</label>
                      <input
                        ref={storyFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(e.target.files[0], 'story')
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        onClick={() => storyFileInputRef.current?.click()}
                        disabled={uploadingImage === 'story'}
                        className={cn(
                          'w-full border-2 border-dashed rounded p-4 text-center transition-colors',
                          uploadingImage === 'story'
                            ? 'border-gray-400 bg-gray-50'
                            : 'border-gray-300 hover:border-blue-400 cursor-pointer'
                        )}
                      >
                        <Upload className="h-4 w-4 mx-auto mb-1 text-gray-400" />
                        <p className="text-xs text-gray-500">
                          {uploadingImage === 'story' ? '上傳中...' : '點擊上傳圖片'}
                        </p>
                      </button>
                      {storyImagePreview && (
                        <div className="mt-2 relative">
                          <img src={storyImagePreview} alt="預覽" className="w-full h-32 object-cover rounded" />
                          <button
                            onClick={() => setStoryImagePreview(null)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 右側：預覽區 */}
        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gray-300 bg-white p-4">
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
                    {device === 'desktop' ? '💻 電腦' : device === 'tablet' ? '📱 平板' : '📱 手機'}
                  </button>
                ))}
              </div>
            </div>

            {/* 預覽框 - 真實首頁預覽 */}
            <div
              className={cn(
                'rounded-lg border border-gray-200 overflow-hidden overflow-y-auto',
                previewDevice === 'desktop' && 'max-h-[700px]',
                previewDevice === 'tablet' && 'max-h-[900px]',
                previewDevice === 'mobile' && 'max-h-[900px]'
              )}
              style={{
                transformOrigin: 'top',
                transform:
                  previewDevice === 'desktop'
                    ? 'scale(1)'
                    : previewDevice === 'tablet'
                      ? 'scale(0.75)'
                      : 'scale(0.5)',
              }}
            >
              <div
                className={cn(
                  'bg-white',
                  previewDevice === 'desktop' && 'w-full',
                  previewDevice === 'tablet' && 'w-[1366px]',
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
