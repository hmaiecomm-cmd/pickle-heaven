'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Coach {
  id: string
  name: string
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE'
  phone: string | null
  email: string | null
  hourlyRate: number
  bio: string | null
  specialties: any
}

interface EditFormProps {
  coach: Coach
}

export function CoachEditForm({ coach }: EditFormProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: coach.name,
    status: coach.status,
    phone: coach.phone || '',
    email: coach.email || '',
    hourlyRate: coach.hourlyRate || 0,
    bio: coach.bio || '',
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'hourlyRate' ? Number(value) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      // 实际实现中这里应该调用 API
      console.log('Saving coach data:', formData)
      // 模拟 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1000))
      alert('教練資料已保存')
    } catch (error) {
      console.error('Error saving coach:', error)
      alert('保存失敗，請重試')
    } finally {
      setIsSaving(false)
    }
  }

  const sel = 'h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 基本資料卡片 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold mb-4">基本資料</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-2">教練名稱</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`${sel} w-full`}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">狀態</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className={`${sel} w-full`}
            >
              <option value="ACTIVE">在職</option>
              <option value="ON_LEAVE">請假</option>
              <option value="INACTIVE">停用</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">電話</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className={`${sel} w-full`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`${sel} w-full`}
            />
          </div>
        </div>
      </section>

      {/* 授課設定卡片 */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold mb-4">授課設定</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-2">時薪（元/小時）</label>
            <input
              type="number"
              name="hourlyRate"
              value={formData.hourlyRate}
              onChange={handleInputChange}
              min="0"
              className={`${sel} w-full`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">教練簡介</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              className={`${sel} w-full h-24 resize-none p-3`}
              placeholder="輸入教練簡介..."
            />
          </div>
        </div>
      </section>

      {/* 操作按鈕 */}
      <div className="flex gap-2 justify-end">
        <Link href="/admin/members?tab=coaches" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50">
          取消
        </Link>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存更改'}
        </button>
      </div>
    </form>
  )
}
