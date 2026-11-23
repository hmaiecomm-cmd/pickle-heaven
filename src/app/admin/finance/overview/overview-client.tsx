'use client'

import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function FinanceOverviewClient() {
  const handleDownloadPDF = () => {
    const link = document.createElement('a')
    link.href = '/reports/financial_report.pdf'
    link.download = 'financial_report.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* 預覽卡片 */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">財務報表｜管理總覽</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              A4 橫式格式，包含營收指標、收入組成、來源明細、每日趨勢及營運指標
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950 rounded-full border border-amber-200 dark:border-amber-800">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">📋 範例資料</span>
          </div>
        </div>

        {/* PDF 預覽區域 */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <iframe
            src="/reports/financial_report.pdf#toolbar=0"
            className="w-full rounded"
            style={{ height: '600px' }}
            title="財務報表預覽"
          />
        </div>

        {/* 下載按鈕和說明 */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleDownloadPDF}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              下載 PDF 報表
            </Button>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>檔案格式：PDF（A4 橫式）</p>
              <p>檔案大小：約 456 KB</p>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              報表內容說明
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>📊 <strong>指標卡</strong>：總營收、場地收入、活動收入三大指標</li>
              <li>📈 <strong>收入組成</strong>：場租與活動收入的堆疊比例圖與占比</li>
              <li>📋 <strong>來源明細</strong>：按收入來源和類型的詳細表格</li>
              <li>📉 <strong>每日趨勢</strong>：展示 12 天期間內的日收入變化</li>
              <li>🎯 <strong>營運指標</strong>：有收入日、平均日收入、平均單筆付款、預約數等</li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
              ✅ 設計特性
            </h4>
            <ul className="text-sm text-green-800 dark:text-green-200 space-y-1">
              <li>🎨 森林綠色頁首與淺色背景設計</li>
              <li>📱 手機放大後仍保持清晰可讀</li>
              <li>💚 金額靠右對齊，易於掃描</li>
              <li>🌍 完整繁體中文支援，無裁切</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* 後續步驟 */}
      <Card className="p-6 bg-gray-50 dark:bg-gray-900">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">後續步驟</h3>
        <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <li><span className="font-medium">1. 預覽確認</span>：檢查報表內容和格式是否符合需求</li>
          <li><span className="font-medium">2. 下載使用</span>：點擊「下載 PDF 報表」按鈕取得檔案</li>
          <li><span className="font-medium">3. 客戶分享</span>：將 PDF 分享給場館客戶，展示後台功能</li>
          <li><span className="font-medium">4. 實時報表</span>：在正式版本中，此頁面將顯示實時財務數據</li>
        </ol>
      </Card>
    </div>
  )
}
