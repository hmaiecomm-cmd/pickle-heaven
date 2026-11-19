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

export function EditorFullV5({ username }: { username: string }) {
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
  const [expandedSection, setExpandedSection] = useState<string | null>('story')

  const photoRefs = {
    story1: useRef<HTMLInputElement>(null),
    story2: useRef<HTMLInputElement>(null),
    story3: useRef<HTMLInputElement>(null),
    visit: useRef<HTMLInputElement>(null),
    invite: useRef<HTMLInputElement>(null),
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const configRes = await fetch('/api/admin/home/config')
        if (configRes.ok) {
          const data = await configRes.json()
          if (data.data) setState(data.data)
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

  const handlePhotoUpload = (section: 'story1' | 'story2' | 'story3' | 'visit' | 'invite', file: File) => {
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

      if (section.startsWith('story')) {
        const photoId = `photo${section.slice(-1)}Id` as keyof typeof state.sections.story
        setState((prev) => ({
          ...prev,
          sections: {
            ...prev.sections,
            story: { ...prev.sections.story, [photoId]: preview },
          },
        }))
      } else if (section === 'visit') {
        setState((prev) => ({
          ...prev,
          sections: {
            ...prev.sections,
            visit: { ...prev.sections.visit, photoId: preview },
          },
        }))
      } else if (section === 'invite') {
        setState((prev) => ({
          ...prev,
          sections: {
            ...prev.sections,
            invite: { ...prev.sections.invite, backgroundPhotoId: preview },
          },
        }))
      }
      setIsDirty(true)
    }
    reader.readAsDataURL(file)
  }

  if (isLoading) return <div className="text-center py-12">加載中...</div>

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">官網頁面管理（Phase 2b+3：場館故事 & 訪問資訊 & 邀請區）</h1>
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
          {/* Phase 2b：場館故事三圖 */}
          <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'story' ? null : 'story')}
              className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              🖼️ 場館故事（三張照片分開編輯）
              {expandedSection === 'story' ? '▼' : '▶'}
            </button>
            {expandedSection === 'story' && (
              <div className="p-4 space-y-4 border-t">
                {/* 大圖 */}
                <div>
                  <label className="text-sm font-semibold block mb-2">📸 大圖（左側主圖）</label>
                  <input type="file" ref={photoRefs.story1} accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhotoUpload('story1', e.target.files[0])} className="hidden" />
                  <button onClick={() => photoRefs.story1.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-xs text-gray-500">
                    <Upload className="h-4 w-4 mx-auto mb-1" />
                    點擊上傳大圖
                  </button>
                  {state.sections.story.photo1Id && (
                    <div className="mt-2 relative">
                      <img src={state.sections.story.photo1Id} alt="大圖" className="w-full h-40 object-cover rounded border border-gray-300" />
                      <button onClick={() => setState((p) => ({ ...p, sections: { ...p.sections, story: { ...p.sections.story, photo1Id: undefined } } }))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 小圖左 */}
                <div className="border-t pt-4">
                  <label className="text-sm font-semibold block mb-2">📸 小圖左</label>
                  <input type="file" ref={photoRefs.story2} accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhotoUpload('story2', e.target.files[0])} className="hidden" />
                  <button onClick={() => photoRefs.story2.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-xs text-gray-500">
                    <Upload className="h-4 w-4 mx-auto mb-1" />
                    點擊上傳小圖左
                  </button>
                  {state.sections.story.photo2Id && (
                    <div className="mt-2 relative">
                      <img src={state.sections.story.photo2Id} alt="小圖左" className="w-full h-32 object-cover rounded border border-gray-300" />
                      <button onClick={() => setState((p) => ({ ...p, sections: { ...p.sections, story: { ...p.sections.story, photo2Id: undefined } } }))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* 小圖右 */}
                <div className="border-t pt-4">
                  <label className="text-sm font-semibold block mb-2">📸 小圖右</label>
                  <input type="file" ref={photoRefs.story3} accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhotoUpload('story3', e.target.files[0])} className="hidden" />
                  <button onClick={() => photoRefs.story3.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-xs text-gray-500">
                    <Upload className="h-4 w-4 mx-auto mb-1" />
                    點擊上傳小圖右
                  </button>
                  {state.sections.story.photo3Id && (
                    <div className="mt-2 relative">
                      <img src={state.sections.story.photo3Id} alt="小圖右" className="w-full h-32 object-cover rounded border border-gray-300" />
                      <button onClick={() => setState((p) => ({ ...p, sections: { ...p.sections, story: { ...p.sections.story, photo3Id: undefined } } }))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Phase 3：訪問資訊照片 */}
          <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'visit' ? null : 'visit')}
              className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              🏢 下一站資訊（側邊照片編輯）
              {expandedSection === 'visit' ? '▼' : '▶'}
            </button>
            {expandedSection === 'visit' && (
              <div className="p-4 space-y-4 border-t">
                <input type="file" ref={photoRefs.visit} accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhotoUpload('visit', e.target.files[0])} className="hidden" />
                <button onClick={() => photoRefs.visit.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-xs text-gray-500">
                  <Upload className="h-4 w-4 mx-auto mb-1" />
                  點擊上傳訪問資訊照片
                </button>
                {state.sections.visit.photoId && (
                  <div className="relative">
                    <img src={state.sections.visit.photoId} alt="訪問資訊照片" className="w-full h-40 object-cover rounded border border-gray-300" />
                    <button onClick={() => setState((p) => ({ ...p, sections: { ...p.sections, visit: { ...p.sections.visit, photoId: undefined } } }))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phase 3：邀請區背景照片 */}
          <div className="rounded-lg border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === 'invite' ? null : 'invite')}
              className="w-full px-4 py-3 font-semibold text-sm text-left bg-gray-50 hover:bg-gray-100 flex items-center justify-between"
            >
              🎯 邀請區（背景照片編輯）
              {expandedSection === 'invite' ? '▼' : '▶'}
            </button>
            {expandedSection === 'invite' && (
              <div className="p-4 space-y-4 border-t">
                <input type="file" ref={photoRefs.invite} accept="image/*" onChange={(e) => e.target.files?.[0] && handlePhotoUpload('invite', e.target.files[0])} className="hidden" />
                <button onClick={() => photoRefs.invite.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded p-3 text-center hover:border-blue-400 text-xs text-gray-500">
                  <Upload className="h-4 w-4 mx-auto mb-1" />
                  點擊上傳背景照片
                </button>
                {state.sections.invite.backgroundPhotoId && (
                  <div className="relative">
                    <img src={state.sections.invite.backgroundPhotoId} alt="邀請區背景" className="w-full h-40 object-cover rounded border border-gray-300" />
                    <button onClick={() => setState((p) => ({ ...p, sections: { ...p.sections, invite: { ...p.sections.invite, backgroundPhotoId: undefined } } }))} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
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
              <h2 className="font-semibold text-sm">完整預覽（Phase 2b+3）</h2>
              <div className="flex gap-1">
                {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
                  <button key={device} onClick={() => setPreviewDevice(device)} className={cn('px-3 py-1 text-xs rounded border font-medium', previewDevice === device ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400')}>
                    {device === 'desktop' ? '💻' : '📱'} {device}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 overflow-auto max-h-[700px]">
              <div className={cn('bg-white p-6', previewDevice === 'desktop' && 'w-full', previewDevice === 'tablet' && 'w-[768px]', previewDevice === 'mobile' && 'w-[390px]')}>
                <div className="space-y-8">
                  {/* 場館故事預覽 */}
                  <div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-purple-600">OUR STORY</p>
                    <h2 className="text-2xl font-bold mt-2">森林裡的球場</h2>
                    <div className="grid gap-4 lg:grid-cols-7 lg:gap-6 mt-6">
                      <div className="lg:col-span-4">
                        {state.sections.story.photo1Id ? <img src={state.sections.story.photo1Id} alt="大圖" className="w-full h-64 lg:h-80 object-cover rounded-lg" /> : <div className="w-full h-64 lg:h-80 bg-gray-300 rounded-lg flex items-center justify-center text-gray-500">大圖預覽</div>}
                      </div>
                      <div className="lg:col-span-3 space-y-4">
                        {state.sections.story.photo2Id ? <img src={state.sections.story.photo2Id} alt="小圖左" className="w-full h-32 object-cover rounded-lg" /> : <div className="w-full h-32 bg-gray-300 rounded-lg flex items-center justify-center text-gray-500 text-xs">小圖左</div>}
                        {state.sections.story.photo3Id ? <img src={state.sections.story.photo3Id} alt="小圖右" className="w-full h-32 object-cover rounded-lg" /> : <div className="w-full h-32 bg-gray-300 rounded-lg flex items-center justify-center text-gray-500 text-xs">小圖右</div>}
                      </div>
                    </div>
                  </div>

                  {/* 訪問資訊預覽 */}
                  <div>
                    <p className="text-xs uppercase tracking-widest font-semibold text-purple-600">VISIT</p>
                    <h2 className="text-2xl font-bold mt-2">下一站</h2>
                    {state.sections.visit.photoId ? <img src={state.sections.visit.photoId} alt="訪問資訊" className="w-full h-40 object-cover rounded-lg mt-4" /> : <div className="w-full h-40 bg-gray-300 rounded-lg flex items-center justify-center text-gray-500 mt-4">訪問資訊照片</div>}
                  </div>

                  {/* 邀請區預覽 */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-50 rounded-lg" />
                    {state.sections.invite.backgroundPhotoId ? <img src={state.sections.invite.backgroundPhotoId} alt="邀請區" className="w-full h-48 object-cover rounded-lg" /> : <div className="w-full h-48 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">邀請區背景</div>}
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                      <div className="text-center text-white">
                        <p className="text-sm uppercase tracking-widest font-semibold mb-2">下一場</p>
                        <h2 className="text-2xl font-bold">約在森林裡</h2>
                      </div>
                    </div>
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
