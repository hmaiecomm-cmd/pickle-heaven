'use client'

import { useState } from 'react'
import { Download, FileText, Printer, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function FinanceOverviewClient() {
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'custom'>('7')
  const [reportType, setReportType] = useState<'operation-summary' | 'court-utilization' | 'booking-entry' | 'door-access' | 'alerts'>('operation-summary')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const handlePeriodChange = (value: '7' | '30' | '90' | 'custom') => {
    setPeriod(value)
    if (value !== 'custom') {
      setStartDate('')
      setEndDate('')
    }
  }

  const handleDownload = () => {
    console.log('下載報表', { period, reportType, startDate, endDate })
    alert(`下載報表：${reportType} (${period === 'custom' ? `${startDate} 至 ${endDate}` : `最近 ${period} 天`})`)
  }

  const handlePrint = () => {
    console.log('列印報表', { period, reportType, startDate, endDate })
    window.print()
  }

  const handlePreview = () => {
    console.log('預覽報表', { period, reportType, startDate, endDate })
    alert(`預覽報表：${reportType}`)
  }

  const reportTypes = [
    { id: 'operation-summary', label: '📊 營運狀況摘要', desc: '包含 KPI 卡片、異常提示、營運說明' },
    { id: 'court-utilization', label: '🏟️ 場地使用率報表', desc: '按場地、時段統計使用情況' },
    { id: 'booking-entry', label: '🚪 預約與進場報表', desc: '預約完成率、進場人次統計' },
    { id: 'door-access', label: '🔐 門禁進出報表', desc: '門禁開門成功率、授權統計' },
    { id: 'alerts', label: '⚠️ 營運異常報表', desc: '異常事件與提示列表' },
  ]

  return (
    <div className="space-y-6">
      {/* 日期選擇區 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">報表日期區間</h3>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { label: '最近 7 天', value: '7' },
              { label: '最近 30 天', value: '30' },
              { label: '最近 90 天', value: '90' },
              { label: '自訂日期', value: 'custom' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => handlePeriodChange(opt.value as any)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  period === opt.value
                    ? 'bg-[#7cb342] text-white'
                    : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-200">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">開始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">結束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          {(period !== 'custom' || (startDate && endDate)) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              📅 目前選擇的統計區間：
              {period === 'custom' ? `${startDate} 至 ${endDate}` : `最近 ${period} 天`}
            </div>
          )}
        </div>
      </Card>

      {/* 報表類型選擇 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">選擇報表類型</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reportTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setReportType(type.id as any)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-colors',
                reportType === type.id
                  ? 'border-[#7cb342] bg-green-50'
                  : 'border-zinc-200 bg-white hover:border-zinc-300'
              )}
            >
              <div className="font-medium text-zinc-900">{type.label}</div>
              <div className="text-sm text-zinc-600 mt-1">{type.desc}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* 操作按鈕 */}
      <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50">
        <h3 className="text-lg font-semibold text-zinc-900 mb-4">報表操作</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handlePreview}
            variant="secondary"
          >
            <Eye className="w-4 h-4" />
            預覽報表
          </Button>
          <Button
            onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4" />
            下載報表
          </Button>
          <Button
            onClick={handlePrint}
            variant="secondary"
          >
            <Printer className="w-4 h-4" />
            列印報表
          </Button>
        </div>
      </Card>

      {/* 支援格式說明 */}
      <Card className="p-6 bg-blue-50 border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          支援的匯出格式
        </h4>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>✓ <strong>PDF</strong>：A4 格式，適合列印與存檔</li>
          <li>✓ <strong>列印預覽</strong>：直接開啟瀏覽器列印對話框</li>
          <li>✓ <strong>預覽</strong>：在螢幕上預覽報表內容</li>
        </ul>
      </Card>

      {/* 操作提示 */}
      <Card className="p-6 bg-amber-50 border border-amber-200">
        <h4 className="font-semibold text-amber-900 mb-3">📝 操作提示</h4>
        <ul className="text-sm text-amber-800 space-y-2">
          <li>1️⃣ 選擇日期區間（預設最近 7 天）</li>
          <li>2️⃣ 選擇要匯出的報表類型</li>
          <li>3️⃣ 點擊「預覽報表」查看內容</li>
          <li>4️⃣ 點擊「下載報表」或「列印報表」完成操作</li>
        </ul>
      </Card>
    </div>
  )
}
