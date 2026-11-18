'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface BannerEditorProps {
  bannerId?: string
  onClose?: () => void
  onSave?: (data: BannerFormData) => Promise<void>
}

export interface BannerFormData {
  title: string
  subtitle?: string
  description?: string
  imageAssetId?: string
  buttonText?: string
  buttonUrl?: string
  displayPages: string
  sortOrder: number
  active: boolean
  startAt?: string
  endAt?: string
}

const DISPLAY_PAGE_OPTIONS = [
  { value: 'HOMEPAGE', label: '首頁' },
  { value: 'ALL', label: '全站顯示' },
  { value: 'BOOKING', label: '預約頁面' },
  { value: 'MEMBERS', label: '會員專區' },
]

export function BannerEditor({ bannerId, onClose, onSave }: BannerEditorProps) {
  const [formData, setFormData] = useState<BannerFormData>({
    title: '',
    subtitle: '',
    description: '',
    buttonText: '',
    buttonUrl: '',
    displayPages: 'HOMEPAGE',
    sortOrder: 0,
    active: true,
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.currentTarget
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.currentTarget as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onSave) return

    setIsSaving(true)
    try {
      await onSave(formData)
      onClose?.()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center">
      <Card className="w-full max-w-2xl mx-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-zinc-200 p-6">
          <h2 className="text-lg font-semibold">{bannerId ? '編輯橫幕' : '新增橫幕'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6 py-6">
            {/* 標題 */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-zinc-900">
                橫幕標題 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                placeholder="輸入標題，例如：夏季優惠活動"
              />
            </div>

            {/* 副標題 */}
            <div>
              <label htmlFor="subtitle" className="block text-sm font-medium text-zinc-900">
                副標題
              </label>
              <input
                type="text"
                id="subtitle"
                name="subtitle"
                value={formData.subtitle || ''}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                placeholder="輸入副標題（選填）"
              />
            </div>

            {/* 描述 */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-zinc-900">
                描述
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={3}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                placeholder="輸入詳細描述（選填）"
              />
            </div>

            {/* 按鈕文字與連結 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="buttonText" className="block text-sm font-medium text-zinc-900">
                  按鈕文字
                </label>
                <input
                  type="text"
                  id="buttonText"
                  name="buttonText"
                  value={formData.buttonText || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  placeholder="例如：立即預約"
                />
              </div>
              <div>
                <label htmlFor="buttonUrl" className="block text-sm font-medium text-zinc-900">
                  按鈕連結
                </label>
                <input
                  type="url"
                  id="buttonUrl"
                  name="buttonUrl"
                  value={formData.buttonUrl || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* 顯示頁面 */}
            <div>
              <label htmlFor="displayPages" className="block text-sm font-medium text-zinc-900">
                顯示頁面
              </label>
              <select
                id="displayPages"
                name="displayPages"
                value={formData.displayPages}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
              >
                {DISPLAY_PAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 顯示時間 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startAt" className="block text-sm font-medium text-zinc-900">
                  開始日期
                </label>
                <input
                  type="datetime-local"
                  id="startAt"
                  name="startAt"
                  value={formData.startAt || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="endAt" className="block text-sm font-medium text-zinc-900">
                  結束日期
                </label>
                <input
                  type="datetime-local"
                  id="endAt"
                  name="endAt"
                  value={formData.endAt || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
                />
              </div>
            </div>

            {/* 狀態 */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="active"
                name="active"
                checked={formData.active}
                onChange={handleChange}
                className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-600"
              />
              <label htmlFor="active" className="text-sm font-medium text-zinc-900">
                啟用此橫幕
              </label>
            </div>

            {/* 按鈕 */}
            <div className="flex gap-3 border-t border-zinc-200 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
