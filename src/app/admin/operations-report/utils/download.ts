import type {
  OperationMetrics,
  DailyOperationTrend,
  TimeSlotDistribution,
  CourtComparison,
  WeekdayComparison,
  BookingStatusDistribution,
  OperationAlert,
} from '@/server/operation-metrics'

export interface DownloadData {
  metrics: OperationMetrics
  trends: DailyOperationTrend[]
  timeSlots: TimeSlotDistribution[]
  courts: CourtComparison[]
  weekday: WeekdayComparison[]
  bookingStatus: BookingStatusDistribution
  alerts: OperationAlert[]
  summary: string
  fromDate: string
  toDate: string
}

/**
 * 下載 PDF 報表
 * 使用 jsPDF 和 html2canvas 生成可列印的 PDF 檔案
 */
export async function downloadPDF(data: DownloadData) {
  try {
    const { jsPDF: jsPDFClass } = (await import('jspdf')) as any
    const html2canvasModule = (await import('html2canvas')) as any
    const html2canvas = html2canvasModule.default || html2canvasModule

    // 獲取報表容器
    const element = document.getElementById('operations-report-content')
    if (!element) {
      console.error('報表容器未找到')
      return
    }

    // 轉換為圖片
    const canvas = await html2canvas(element, {
      useCORS: true,
      logging: false,
    } as any)

    // 建立 PDF
    const imgWidth = 210 // A4 寬度（毫米）
    const pageHeight = 297 // A4 高度（毫米）
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    const pdf = new jsPDFClass('p', 'mm', 'a4')
    let position = 0

    // 添加圖片到 PDF
    const imgData = canvas.toDataURL('image/png')
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // 下載
    const filename = `營運狀況報表_${data.fromDate}_${data.toDate}.pdf`
    pdf.save(filename)
  } catch (error) {
    console.error('下載報表失敗:', error)
    alert('下載報表失敗，請稍後重試')
  }
}

/**
 * 列印報表
 * 設定列印樣式並打開列印對話框
 */
export function printReport() {
  // 添加列印樣式
  const style = document.createElement('style')
  style.textContent = `
    @media print {
      body {
        background: white;
      }

      .admin-sidebar,
      .operations-toolbar,
      .no-print {
        display: none !important;
      }

      .operations-report-print {
        margin: 0;
        padding: 20mm;
        max-width: 100%;
      }

      .chart,
      .summary-section,
      .alerts-section {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      h3 {
        margin-top: 20px;
      }

      .metric-card,
      .alert-card {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  `
  document.head.appendChild(style)

  // 打開列印對話框
  window.print()

  // 移除樣式（列印後清理）
  setTimeout(() => {
    document.head.removeChild(style)
  }, 100)
}

/**
 * 匯出為 CSV（可選）
 */
export function exportCSV(data: DownloadData) {
  const lines: string[] = []

  // 標題
  lines.push('營運狀況報表')
  lines.push(`統計期間: ${data.fromDate} 至 ${data.toDate}`)
  lines.push('')

  // 統計卡片
  lines.push('主要統計指標')
  lines.push(`預約完成率,${data.metrics.bookingCompletion.completionRate}%`)
  lines.push(`場地使用率,${data.metrics.courtUtilization.overallUtilization}%`)
  lines.push(`進場人次,${data.metrics.entries.totalEntries}`)
  lines.push(`門禁開門成功率,${data.metrics.doorAccess.successRate}%`)
  lines.push('')

  // 每日資料
  lines.push('每日營運趨勢')
  lines.push('日期,預約數,進場人次,完成率%')
  data.trends.forEach((trend) => {
    lines.push(`${trend.date},${trend.bookingCount},${trend.entryCount},${trend.completionRate}`)
  })
  lines.push('')

  // 場地資料
  lines.push('場地使用率')
  lines.push('場地,使用率%,尖峰%,離峰%')
  data.courts.forEach((court) => {
    lines.push(
      `${court.courtName},${court.utilizationRate},${court.peakUtilization},${court.offPeakUtilization}`
    )
  })

  // 下載 CSV
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.setAttribute('href', URL.createObjectURL(blob))
  link.setAttribute(
    'download',
    `營運狀況報表_${data.fromDate}_${data.toDate}.csv`
  )
  link.click()
}
