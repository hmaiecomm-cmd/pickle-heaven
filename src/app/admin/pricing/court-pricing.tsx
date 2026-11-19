'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface SpecialDatePrice {
  id: string
  startDate: string
  endDate: string
  peakStartTime: string
  peakEndTime: string
  peakPrice: number
  offpeakStartTime: string
  offpeakEndTime: string
  offpeakPrice: number
}

export function CourtPricingTab() {
  const { toast } = useToast()
  const [specialDates, setSpecialDates] = useState<SpecialDatePrice[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<SpecialDatePrice>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const stored = localStorage.getItem('specialDates')
    if (stored) setSpecialDates(JSON.parse(stored))
  }, [])

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.startDate) errors.startDate = '必須填寫開始日期'
    if (!formData.endDate) errors.endDate = '必須填寫結束日期'
    if (formData.startDate && formData.endDate && formData.startDate > formData.endDate) {
      errors.endDate = '結束日期必須 ≥ 開始日期'
    }
    if (!formData.peakStartTime) errors.peakStartTime = '必須填寫尖峰開始時間'
    if (!formData.peakEndTime) errors.peakEndTime = '必須填寫尖峰結束時間'
    if (!formData.offpeakStartTime) errors.offpeakStartTime = '必須填寫離峰開始時間'
    if (!formData.offpeakEndTime) errors.offpeakEndTime = '必須填寫離峰結束時間'
    if (!formData.peakPrice || formData.peakPrice <= 0) errors.peakPrice = '尖峰價格必須 > 0'
    if (!formData.offpeakPrice || formData.offpeakPrice <= 0) errors.offpeakPrice = '離峰價格必須 > 0'
    if (!Number.isInteger(formData.peakPrice)) errors.peakPrice = '尖峰價格必須為整數'
    if (!Number.isInteger(formData.offpeakPrice)) errors.offpeakPrice = '離峰價格必須為整數'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveSpecialDate = () => {
    if (!validateForm()) return
    if (editingId) {
      setSpecialDates((s) => s.map((d) => (d.id === editingId ? { ...d, ...formData } as SpecialDatePrice : d)))
      toast('已更新指定日期價格', 'success')
    } else {
      const newDate: SpecialDatePrice = {
        id: Date.now().toString(),
        ...formData,
      } as SpecialDatePrice
      setSpecialDates((s) => [newDate, ...s])
      toast('已新增指定日期價格', 'success')
    }
    localStorage.setItem('specialDates', JSON.stringify(specialDates))
    resetForm()
  }

  const handleEditSpecialDate = (date: SpecialDatePrice) => {
    setFormData(date)
    setEditingId(date.id)
    setShowForm(true)
  }

  const handleDeleteSpecialDate = (id: string) => {
    setSpecialDates((s) => s.filter((d) => d.id !== id))
    toast('已刪除指定日期價格', 'success')
  }

  const resetForm = () => {
    setFormData({})
    setFormErrors({})
    setEditingId(null)
    setShowForm(false)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
        <h3 className="font-semibold">場地價格優先序</h3>
        <p className="mt-1 text-xs text-muted">指定日期價格 &gt; 週末價格 &gt; 平日價格</p>
      </div>

      <div className="rounded-lg border border-[rgb(var(--border))]">
        <div className="border-b border-[rgb(var(--border))] px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">指定日期價格</h3>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                新增
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="border-b border-[rgb(var(--border))] p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">開始日期</label>
                <input
                  type="date"
                  value={formData.startDate || ''}
                  onChange={(e) => setFormData((d) => ({ ...d, startDate: e.target.value }))}
                  className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2"
                />
                {formErrors.startDate && <p className="text-xs text-red-500 mt-1">{formErrors.startDate}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">結束日期</label>
                <input
                  type="date"
                  value={formData.endDate || ''}
                  onChange={(e) => setFormData((d) => ({ ...d, endDate: e.target.value }))}
                  className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2"
                />
                {formErrors.endDate && <p className="text-xs text-red-500 mt-1">{formErrors.endDate}</p>}
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[rgb(var(--border))]">
              <p className="text-xs font-medium text-muted">尖峰時段</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">開始時間</label>
                  <input
                    type="time"
                    value={formData.peakStartTime || ''}
                    onChange={(e) => setFormData((d) => ({ ...d, peakStartTime: e.target.value }))}
                    className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                  />
                  {formErrors.peakStartTime && <p className="text-xs text-red-500 mt-1">{formErrors.peakStartTime}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium">結束時間</label>
                  <input
                    type="time"
                    value={formData.peakEndTime || ''}
                    onChange={(e) => setFormData((d) => ({ ...d, peakEndTime: e.target.value }))}
                    className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                  />
                  {formErrors.peakEndTime && <p className="text-xs text-red-500 mt-1">{formErrors.peakEndTime}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium">價格</label>
                  <input
                    type="number"
                    value={formData.peakPrice || ''}
                    onChange={(e) => setFormData((d) => ({ ...d, peakPrice: Number(e.target.value) }))}
                    className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                  />
                  {formErrors.peakPrice && <p className="text-xs text-red-500 mt-1">{formErrors.peakPrice}</p>}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-[rgb(var(--border))]">
              <p className="text-xs font-medium text-muted">離峰時段</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium">開始時間</label>
                  <input
                    type="time"
                    value={formData.offpeakStartTime || ''}
                    onChange={(e) => setFormData((d) => ({ ...d, offpeakStartTime: e.target.value }))}
                    className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                  />
                  {formErrors.offpeakStartTime && <p className="text-xs text-red-500 mt-1">{formErrors.offpeakStartTime}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium">結束時間</label>
                  <input
                    type="time"
                    value={formData.offpeakEndTime || ''}
                    onChange={(e) => setFormData((d) => ({ ...d, offpeakEndTime: e.target.value }))}
                    className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                  />
                  {formErrors.offpeakEndTime && <p className="text-xs text-red-500 mt-1">{formErrors.offpeakEndTime}</p>}
                </div>
                <div>
                  <label className="text-xs font-medium">價格</label>
                  <input
                    type="number"
                    value={formData.offpeakPrice || ''}
                    onChange={(e) => setFormData((d) => ({ ...d, offpeakPrice: Number(e.target.value) }))}
                    className="mt-1 w-full rounded border border-[rgb(var(--border))] px-3 py-2 text-sm"
                  />
                  {formErrors.offpeakPrice && <p className="text-xs text-red-500 mt-1">{formErrors.offpeakPrice}</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[rgb(var(--border))]">
              <Button size="sm" variant="ghost" onClick={resetForm}>
                取消
              </Button>
              <Button size="sm" onClick={handleSaveSpecialDate}>
                儲存
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-[rgb(var(--border))]">
          {specialDates.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">尚未設定指定日期價格</p>
          ) : (
            specialDates.map((date) => (
              <div key={date.id}>
                <div
                  className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer hover:bg-[rgb(var(--bg-hover))]"
                  onClick={() => setExpandedId(expandedId === date.id ? null : date.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{date.startDate} 至 {date.endDate}</p>
                    <p className="text-xs text-muted">尖峰: NT${date.peakPrice} | 離峰: NT${date.offpeakPrice}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditSpecialDate(date)
                      }}
                    >
                      編輯
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSpecialDate(date.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {expandedId === date.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {expandedId === date.id && (
                  <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-hover))] px-4 py-3 text-sm space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted">尖峰時段</p>
                        <p>{date.peakStartTime} - {date.peakEndTime}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">離峰時段</p>
                        <p>{date.offpeakStartTime} - {date.offpeakEndTime}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
