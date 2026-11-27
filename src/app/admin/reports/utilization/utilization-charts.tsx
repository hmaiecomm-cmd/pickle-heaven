'use client'
import type { ChartType, UtilizationData, HeatmapCell } from './types'
import { cn } from '@/lib/utils'

interface UtilizationChartsPanelProps {
  data: UtilizationData
  activeChart: ChartType
  onChartChange: (c: ChartType) => void
  selectedCourtId?: string
}

// Demo 熱力圖數據
const DEMO_HEATMAP_DATA = {
  'A': [
    // 週一（平日）- 晚上高峰
    { dayIndex: 0, hour: '08:00', rate: 15 },
    { dayIndex: 0, hour: '10:00', rate: 25 },
    { dayIndex: 0, hour: '12:00', rate: 35 },
    { dayIndex: 0, hour: '14:00', rate: 42 },
    { dayIndex: 0, hour: '16:00', rate: 55 },
    { dayIndex: 0, hour: '18:00', rate: 78 },
    { dayIndex: 0, hour: '20:00', rate: 85 },
    { dayIndex: 0, hour: '22:00', rate: 72 },
    // 週二-週五（類似）
    { dayIndex: 1, hour: '08:00', rate: 18 },
    { dayIndex: 1, hour: '10:00', rate: 28 },
    { dayIndex: 1, hour: '12:00', rate: 38 },
    { dayIndex: 1, hour: '14:00', rate: 45 },
    { dayIndex: 1, hour: '16:00', rate: 58 },
    { dayIndex: 1, hour: '18:00', rate: 81 },
    { dayIndex: 1, hour: '20:00', rate: 88 },
    { dayIndex: 1, hour: '22:00', rate: 75 },
    { dayIndex: 2, hour: '08:00', rate: 12 },
    { dayIndex: 2, hour: '10:00', rate: 22 },
    { dayIndex: 2, hour: '12:00', rate: 32 },
    { dayIndex: 2, hour: '14:00', rate: 40 },
    { dayIndex: 2, hour: '16:00', rate: 52 },
    { dayIndex: 2, hour: '18:00', rate: 76 },
    { dayIndex: 2, hour: '20:00', rate: 83 },
    { dayIndex: 2, hour: '22:00', rate: 70 },
    { dayIndex: 3, hour: '08:00', rate: 20 },
    { dayIndex: 3, hour: '10:00', rate: 30 },
    { dayIndex: 3, hour: '12:00', rate: 40 },
    { dayIndex: 3, hour: '14:00', rate: 48 },
    { dayIndex: 3, hour: '16:00', rate: 60 },
    { dayIndex: 3, hour: '18:00', rate: 82 },
    { dayIndex: 3, hour: '20:00', rate: 86 },
    { dayIndex: 3, hour: '22:00', rate: 73 },
    { dayIndex: 4, hour: '08:00', rate: 25 },
    { dayIndex: 4, hour: '10:00', rate: 35 },
    { dayIndex: 4, hour: '12:00', rate: 45 },
    { dayIndex: 4, hour: '14:00', rate: 52 },
    { dayIndex: 4, hour: '16:00', rate: 65 },
    { dayIndex: 4, hour: '18:00', rate: 84 },
    { dayIndex: 4, hour: '20:00', rate: 89 },
    { dayIndex: 4, hour: '22:00', rate: 76 },
    // 週六（週末）- 下午至晚上高峰
    { dayIndex: 5, hour: '08:00', rate: 32 },
    { dayIndex: 5, hour: '10:00', rate: 48 },
    { dayIndex: 5, hour: '12:00', rate: 62 },
    { dayIndex: 5, hour: '14:00', rate: 75 },
    { dayIndex: 5, hour: '16:00', rate: 82 },
    { dayIndex: 5, hour: '18:00', rate: 86 },
    { dayIndex: 5, hour: '20:00', rate: 85 },
    { dayIndex: 5, hour: '22:00', rate: 68 },
    // 週日（週末）
    { dayIndex: 6, hour: '08:00', rate: 28 },
    { dayIndex: 6, hour: '10:00', rate: 42 },
    { dayIndex: 6, hour: '12:00', rate: 58 },
    { dayIndex: 6, hour: '14:00', rate: 71 },
    { dayIndex: 6, hour: '16:00', rate: 78 },
    { dayIndex: 6, hour: '18:00', rate: 84 },
    { dayIndex: 6, hour: '20:00', rate: 83 },
    { dayIndex: 6, hour: '22:00', rate: 65 },
  ],
  'B': [
    // 週一 - 低峰
    { dayIndex: 0, hour: '08:00', rate: 22 },
    { dayIndex: 0, hour: '10:00', rate: 32 },
    { dayIndex: 0, hour: '12:00', rate: 28 },
    { dayIndex: 0, hour: '14:00', rate: 35 },
    { dayIndex: 0, hour: '16:00', rate: 25 },
    { dayIndex: 0, hour: '18:00', rate: 65 },
    { dayIndex: 0, hour: '20:00', rate: 72 },
    { dayIndex: 0, hour: '22:00', rate: 55 },
    // 週二-週五
    { dayIndex: 1, hour: '08:00', rate: 18 },
    { dayIndex: 1, hour: '10:00', rate: 28 },
    { dayIndex: 1, hour: '12:00', rate: 24 },
    { dayIndex: 1, hour: '14:00', rate: 32 },
    { dayIndex: 1, hour: '16:00', rate: 22 },
    { dayIndex: 1, hour: '18:00', rate: 62 },
    { dayIndex: 1, hour: '20:00', rate: 68 },
    { dayIndex: 1, hour: '22:00', rate: 52 },
    { dayIndex: 2, hour: '08:00', rate: 25 },
    { dayIndex: 2, hour: '10:00', rate: 35 },
    { dayIndex: 2, hour: '12:00', rate: 31 },
    { dayIndex: 2, hour: '14:00', rate: 38 },
    { dayIndex: 2, hour: '16:00', rate: 28 },
    { dayIndex: 2, hour: '18:00', rate: 68 },
    { dayIndex: 2, hour: '20:00', rate: 75 },
    { dayIndex: 2, hour: '22:00', rate: 58 },
    { dayIndex: 3, hour: '08:00', rate: 20 },
    { dayIndex: 3, hour: '10:00', rate: 30 },
    { dayIndex: 3, hour: '12:00', rate: 26 },
    { dayIndex: 3, hour: '14:00', rate: 34 },
    { dayIndex: 3, hour: '16:00', rate: 24 },
    { dayIndex: 3, hour: '18:00', rate: 64 },
    { dayIndex: 3, hour: '20:00', rate: 71 },
    { dayIndex: 3, hour: '22:00', rate: 54 },
    { dayIndex: 4, hour: '08:00', rate: 28 },
    { dayIndex: 4, hour: '10:00', rate: 38 },
    { dayIndex: 4, hour: '12:00', rate: 34 },
    { dayIndex: 4, hour: '14:00', rate: 41 },
    { dayIndex: 4, hour: '16:00', rate: 31 },
    { dayIndex: 4, hour: '18:00', rate: 70 },
    { dayIndex: 4, hour: '20:00', rate: 77 },
    { dayIndex: 4, hour: '22:00', rate: 60 },
    // 週六 - 高峰
    { dayIndex: 5, hour: '08:00', rate: 35 },
    { dayIndex: 5, hour: '10:00', rate: 55 },
    { dayIndex: 5, hour: '12:00', rate: 68 },
    { dayIndex: 5, hour: '14:00', rate: 80 },
    { dayIndex: 5, hour: '16:00', rate: 85 },
    { dayIndex: 5, hour: '18:00', rate: 82 },
    { dayIndex: 5, hour: '20:00', rate: 78 },
    { dayIndex: 5, hour: '22:00', rate: 60 },
    // 週日 - 中等
    { dayIndex: 6, hour: '08:00', rate: 30 },
    { dayIndex: 6, hour: '10:00', rate: 50 },
    { dayIndex: 6, hour: '12:00', rate: 62 },
    { dayIndex: 6, hour: '14:00', rate: 74 },
    { dayIndex: 6, hour: '16:00', rate: 79 },
    { dayIndex: 6, hour: '18:00', rate: 76 },
    { dayIndex: 6, hour: '20:00', rate: 72 },
    { dayIndex: 6, hour: '22:00', rate: 58 },
  ]
}

function getHeatColor(rate: number): string {
  if (rate >= 80) return 'bg-red-500 text-white'
  if (rate >= 75) return 'bg-orange-400 text-white'
  if (rate >= 60) return 'bg-amber-300 text-[#1f2a22]'
  if (rate >= 30) return 'bg-lime-200 text-[#1f2a22]'
  return 'bg-green-200 text-[#1f2a22]'
}

function HeatmapTable({ title, courtId, data }: { title: string; courtId: string; data: typeof DEMO_HEATMAP_DATA.A }) {
  const daysOfWeek = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']
  const timeSlots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']

  // 組織數據
  const heatmapByDayTime = new Map<string, number>()
  data.forEach(cell => {
    const key = `${cell.dayIndex}-${cell.hour}`
    heatmapByDayTime.set(key, cell.rate)
  })

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-[#1f2a22] text-sm">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse border border-zinc-200">
          <thead>
            <tr className="bg-zinc-50">
              <th className="p-2 text-left font-semibold text-[#1f2a22] border border-zinc-200">時段</th>
              {daysOfWeek.map((day, i) => (
                <th key={i} className="p-2 text-center font-semibold text-[#1f2a22] border border-zinc-200 w-12">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot) => (
              <tr key={slot}>
                <td className="p-2 font-semibold text-[#1f2a22] border border-zinc-200 bg-zinc-50">{slot}</td>
                {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                  const rate = heatmapByDayTime.get(`${dayIdx}-${slot}`) ?? 0
                  return (
                    <td
                      key={dayIdx}
                      className={cn('p-2 text-center font-semibold border border-zinc-200', getHeatColor(rate))}
                      title={`${rate}%`}
                    >
                      {rate}%
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CourtComparisonChart({ courts }: { courts: Array<{ id: string; name: string; rate: number; prevRate: number }> }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-[#1f2a22] text-sm">各場地使用率</h3>
      <div className="space-y-3">
        {courts.map((court) => {
          const change = court.rate - court.prevRate
          const isPositive = change >= 0

          return (
            <div key={court.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1f2a22]">{court.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1f2a22]">{court.rate}%</span>
                  <span className={cn('text-xs font-semibold', isPositive ? 'text-emerald-600' : 'text-red-600')}>
                    {isPositive ? '▲' : '▼'} {Math.abs(change)}%
                  </span>
                </div>
              </div>
              <div className="h-6 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-end pr-2 transition-all"
                  style={{ width: `${court.rate}%` }}
                >
                  {court.rate > 15 && <span className="text-xs font-bold text-white">{court.rate}%</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function UtilizationChartsPanel({ data, activeChart, onChartChange, selectedCourtId = '' }: UtilizationChartsPanelProps) {
  const isAllCourts = !selectedCourtId || selectedCourtId === ''

  // 模擬的法庭使用率數據（實際應該從 data 傳入）
  const courtComparisonData = [
    { id: 'A', name: 'A 場', rate: 68, prevRate: 62 },
    { id: 'B', name: 'B 場', rate: 54, prevRate: 48 },
  ]

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 md:p-6 space-y-6">
      <h2 className="text-lg font-bold text-[#1f3d2b]">收益策略分析</h2>

      {/* 熱力圖與場地比較 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* A 場熱力圖 */}
        {(isAllCourts || selectedCourtId === 'A') && (
          <HeatmapTable title="A 場 - 時段 × 星期使用率熱力圖" courtId="A" data={DEMO_HEATMAP_DATA.A} />
        )}

        {/* B 場熱力圖 */}
        {(isAllCourts || selectedCourtId === 'B') && (
          <HeatmapTable title="B 場 - 時段 × 星期使用率熱力圖" courtId="B" data={DEMO_HEATMAP_DATA.B} />
        )}

        {/* 場地比較圖 */}
        {isAllCourts && (
          <CourtComparisonChart courts={courtComparisonData} />
        )}

        {/* 單一場地時的場地比較 */}
        {!isAllCourts && selectedCourtId === 'A' && (
          <CourtComparisonChart courts={[courtComparisonData[0]]} />
        )}
        {!isAllCourts && selectedCourtId === 'B' && (
          <CourtComparisonChart courts={[courtComparisonData[1]]} />
        )}
      </div>

      {/* 色彩圖例 */}
      <div className="flex flex-wrap gap-3 text-xs p-3 bg-zinc-50 rounded-lg border border-zinc-200">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-500 rounded"></div>
          <span className="font-semibold text-[#1f2a22]">高峰 ≥80%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-orange-400 rounded"></div>
          <span className="font-semibold text-[#1f2a22]">75%～79%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-amber-300 rounded"></div>
          <span className="font-semibold text-[#1f2a22]">60%～74%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-lime-200 rounded"></div>
          <span className="font-semibold text-[#1f2a22]">30%～59%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-200 rounded"></div>
          <span className="font-semibold text-[#1f2a22]">低峰 &lt;30%</span>
        </div>
      </div>
    </section>
  )
}
