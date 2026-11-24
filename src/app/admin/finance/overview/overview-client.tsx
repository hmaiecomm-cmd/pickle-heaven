'use client'

import { useState } from 'react'
import { Download, FileText, Printer, Eye, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function FinanceOverviewClient() {
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'month' | 'lastMonth' | 'custom'>('7')
  const [reportType, setReportType] = useState<'operation-summary' | 'court-utilization' | 'booking-entry' | 'door-access' | 'alerts'>('operation-summary')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const reportTypeMap: Record<string, { label: string; desc: string }> = {
    'operation-summary': { label: '營運狀況摘要', desc: '包含 KPI 卡片、異常提示、營運說明' },
    'court-utilization': { label: '場地使用率報表', desc: '按場地、時段統計使用情況' },
    'booking-entry': { label: '預約與進場報表', desc: '預約完成率、進場人次統計' },
    'door-access': { label: '門禁進出報表', desc: '門禁開門成功率、授權統計' },
    'alerts': { label: '營運異常報表', desc: '異常事件與提示列表' },
  }

  const periodMap: Record<string, string> = {
    '7': '最近 7 天',
    '30': '最近 30 天',
    '90': '最近 90 天',
    'month': '本月',
    'lastMonth': '上月',
    'custom': '自訂日期',
  }

  const handlePeriodChange = (value: string) => {
    setPeriod(value as any)
    if (value !== 'custom') {
      setStartDate('')
      setEndDate('')
    }
  }

  const handleDownload = () => {
    const periodText = period === 'custom' ? `${startDate} 至 ${endDate}` : periodMap[period]
    console.log('下載報表', { period, reportType, periodText })
    alert(`下載報表：${reportTypeMap[reportType].label}\n時間：${periodText}`)
  }

  const handlePrint = () => {
    window.print()
  }

  const handlePreview = () => {
    console.log('預覽報表', { period, reportType })
    alert(`預覽報表：${reportTypeMap[reportType].label}`)
  }

  const selectedPeriodText = period === 'custom' ? `${startDate} 至 ${endDate}` : periodMap[period]

  return (
    <div className="space-y-6">
      {/* 日期選擇區 */}
      <Card className="p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-zinc-900 mb-4">報表日期區間</h3>
        <div className="space-y-4">
          {/* 日期下拉選單 */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">選擇時間範圍</label>
            <div className="relative">
              <select
                value={period}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="w-full px-4 py-2.5 md:py-3 border border-zinc-300 rounded-lg text-sm appearance-none bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7cb342] focus:border-transparent"
              >
                <option value="7">最近 7 天</option>
                <option value="30">最近 30 天</option>
                <option value="90">最近 90 天</option>
                <option value="month">本月</option>
                <option value="lastMonth">上月</option>
                <option value="custom">自訂日期</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* 自訂日期欄位 */}
          {period === 'custom' && (
            <div className="space-y-3 pt-3 border-t border-zinc-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">開始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 md:py-3 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">結束日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 md:py-3 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7cb342]"
                  />
                </div>
              </div>
              {startDate && endDate && (
                <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  ✓ 開始日期至結束日期合理
                </div>
              )}
            </div>
          )}

          {/* 統計區間顯示 */}
          {selectedPeriodText && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              📅 目前選擇的統計區間：<strong>{selectedPeriodText}</strong>
            </div>
          )}
        </div>
      </Card>

      {/* 報表類型選擇 - 下拉選單 */}
      <Card className="p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-zinc-900 mb-4">選擇報表類型</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">報表類型</label>
            <div className="relative">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
                className="w-full px-4 py-2.5 md:py-3 border border-zinc-300 rounded-lg text-sm appearance-none bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7cb342] focus:border-transparent"
              >
                <option value="operation-summary">📊 營運狀況摘要</option>
                <option value="court-utilization">🏟️ 場地使用率報表</option>
                <option value="booking-entry">🚪 預約與進場報表</option>
                <option value="door-access">🔐 門禁進出報表</option>
                <option value="alerts">⚠️ 營運異常報表</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* 報表類型說明 */}
          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="text-sm font-medium text-zinc-900">{reportTypeMap[reportType].label}</div>
            <div className="text-xs text-zinc-600 mt-1">{reportTypeMap[reportType].desc}</div>
          </div>
        </div>
      </Card>

      {/* 操作按鈕 */}
      <Card className="p-4 md:p-6 bg-gradient-to-br from-green-50 to-emerald-50">
        <h3 className="text-base md:text-lg font-semibold text-zinc-900 mb-4">報表操作</h3>
        <div className="flex flex-col sm:flex-row gap-2.5 md:gap-3">
          <Button
            onClick={handlePreview}
            variant="secondary"
            className="flex-1 sm:flex-initial h-11 md:h-10"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">預覽報表</span>
            <span className="sm:hidden">預覽</span>
          </Button>
          <Button
            onClick={handleDownload}
            className="flex-1 sm:flex-initial h-11 md:h-10 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">下載報表</span>
            <span className="sm:hidden">下載</span>
          </Button>
          <Button
            onClick={handlePrint}
            variant="secondary"
            className="flex-1 sm:flex-initial h-11 md:h-10"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">列印報表</span>
            <span className="sm:hidden">列印</span>
          </Button>
        </div>
      </Card>

      {/* 支援格式說明 */}
      <Card className="p-4 md:p-6 bg-blue-50 border border-blue-200">
        <h4 className="text-sm md:text-base font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 shrink-0" />
          支援的匯出格式
        </h4>
        <ul className="text-xs md:text-sm text-blue-800 space-y-1.5 md:space-y-2">
          <li>✓ <strong>PDF</strong>：A4 格式，適合列印與存檔</li>
          <li>✓ <strong>列印預覽</strong>：直接開啟瀏覽器列印對話框</li>
          <li>✓ <strong>預覽</strong>：在螢幕上預覽報表內容</li>
        </ul>
      </Card>

      {/* 操作提示 */}
      <Card className="p-4 md:p-6 bg-amber-50 border border-amber-200">
        <h4 className="text-sm md:text-base font-semibold text-amber-900 mb-3">📝 操作提示</h4>
        <ol className="text-xs md:text-sm text-amber-800 space-y-1.5 md:space-y-2">
          <li><span className="font-medium">1</span> 選擇日期區間（預設最近 7 天）</li>
          <li><span className="font-medium">2</span> 選擇要匯出的報表類型</li>
          <li><span className="font-medium">3</span> 點擊「預覽報表」查看內容</li>
          <li><span className="font-medium">4</span> 點擊「下載報表」或「列印報表」完成操作</li>
        </ol>
      </Card>
    </div>
  )
}
