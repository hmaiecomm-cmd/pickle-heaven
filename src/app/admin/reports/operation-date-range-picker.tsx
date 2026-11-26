'use client'
import { useState } from 'react'
import { calculateDateRange } from './operation-utils'

interface DateRangePickerProps {
  value: 'preset' | 'custom'
  preset?: '7' | '30' | '90' | '180'
  fromDate?: string
  toDate?: string
  onRangeChange: (preset: '7' | '30' | '90' | '180') => void
  onCustomChange: (from: string, to: string) => void
}

export function OperationDateRangePicker({ value, preset = '30', fromDate, toDate, onRangeChange, onCustomChange }: DateRangePickerProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>(value)
  const [customFrom, setCustomFrom] = useState(fromDate || '')
  const [customTo, setCustomTo] = useState(toDate || '')
  const [error, setError] = useState('')

  const handlePresetClick = (days: '7' | '30' | '90' | '180') => {
    setMode('preset')
    setError('')
    onRangeChange(days)
  }

  const handleCustomApply = () => {
    setError('')

    if (!customFrom || !customTo) {
      setError('請輸入開始和結束日期')
      return
    }

    const from = new Date(customFrom)
    const to = new Date(customTo)

    if (from > to) {
      setError('開始日期不可晚於結束日期')
      return
    }

    const diffTime = Math.abs(to.getTime() - from.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 365) {
      setError('日期範圍不可超過 365 天')
      return
    }

    setMode('custom')
    onCustomChange(customFrom, customTo)
  }

  const getDisplayRange = () => {
    if (mode === 'preset') {
      const { from, to } = calculateDateRange(parseInt(preset))
      return `${from.toLocaleDateString('zh-TW')} ~ ${to.toLocaleDateString('zh-TW')}`
    }
    return customFrom && customTo ? `${customFrom} ~ ${customTo}` : '未選擇'
  }

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6">
      <h2 className="mb-4 text-base font-bold">查看期間</h2>

      {/* 預設選項 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        {(['7', '30', '90', '180'] as const).map(days => (
          <button
            key={days}
            onClick={() => handlePresetClick(days)}
            className={`p-2.5 rounded-lg border-2 text-sm font-semibold transition ${
              mode === 'preset' && preset === days
                ? 'border-[#2f7d3b] bg-[#f1f5ec] text-[#2f7d3b]'
                : 'border-[#e3e8dc] hover:border-[#2f7d3b]'
            }`}
          >
            近 {days} 天
          </button>
        ))}
      </div>

      {/* 自訂日期 */}
      <div className="border-t border-[#e3e8dc] pt-4 mt-4">
        <div className="mb-3 text-sm font-semibold">自訂日期</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">開始日期</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full px-3 py-2 border border-[#e3e8dc] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">結束日期</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-full px-3 py-2 border border-[#e3e8dc] rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2 col-span-1 md:col-span-2 items-end">
            <button
              onClick={handleCustomApply}
              className="flex-1 px-4 py-2 bg-[#2f7d3b] text-white rounded-lg text-sm font-semibold hover:bg-[#1f5a2b] transition"
            >
              套用
            </button>
            <button
              onClick={() => {
                setCustomFrom('')
                setCustomTo('')
                setError('')
                setMode('preset')
              }}
              className="flex-1 px-4 py-2 border border-[#e3e8dc] rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
            >
              清除
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
      </div>

      {/* 顯示當前選擇 */}
      <div className="mt-4 pt-4 border-t border-[#e3e8dc]">
        <div className="text-xs text-gray-600">目前選擇：</div>
        <div className="text-sm font-semibold text-[#2f7d3b]">{getDisplayRange()}</div>
      </div>
    </div>
  )
}
