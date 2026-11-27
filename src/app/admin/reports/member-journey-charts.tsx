'use client'

// 會員旅程圖表
export function MemberJourneyChart() {
  const stages = [
    { label: '新會員', value: 528, color: 'bg-green-500' },
    { label: '已綁定 LINE', value: 471, rate: '89.2%', color: 'bg-blue-500' },
    { label: '首次預約', value: 382, rate: '81.1%', color: 'bg-orange-500' },
    { label: '活躍會員', value: 296, rate: '77.5%', color: 'bg-purple-500' },
    { label: '沉睡會員', value: 143, rate: '—', color: 'bg-gray-400' },
    { label: '回訪會員', value: 118, rate: '82.5%', color: 'bg-green-600' }
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">會員旅程（會員生命週期）</h2>

      <div className="overflow-x-auto">
        <div className="flex gap-2 md:gap-4 justify-between min-w-full pb-4">
          {stages.map((stage, idx) => (
            <div key={idx} className="flex-1 text-center">
              <div className={`${stage.color} rounded-full h-16 md:h-20 w-16 md:w-20 flex items-center justify-center mx-auto mb-2 text-white font-bold text-sm md:text-base`}>
                {stage.value}
              </div>
              <p className="text-xs md:text-sm font-semibold text-gray-900">{stage.label}</p>
              {stage.rate && <p className="text-xs text-green-600 font-semibold">{stage.rate}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
        <p className="font-semibold mb-1">整體轉換率</p>
        <p>新會員 → 回訪會員：82.5% (從 528 人到 118 人完成回訪)</p>
      </div>
    </div>
  )
}

// 會員分群分布圖
export function MemberSegmentationChart() {
  const segments = [
    { name: '活躍會員', value: 1964, percentage: 50.5, color: 'bg-green-500' },
    { name: '一般會員', value: 783, percentage: 20.1, color: 'bg-blue-500' },
    { name: '沉睡會員', value: 502, percentage: 12.9, color: 'bg-gray-400' },
    { name: '新會員', value: 323, percentage: 8.3, color: 'bg-orange-500' },
    { name: '高風險會員', value: 320, percentage: 8.2, color: 'bg-red-500' }
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">會員分群分布</h2>

      <div className="space-y-3">
        {segments.map((seg) => (
          <div key={seg.name} className="space-y-1">
            <div className="flex justify-between text-xs md:text-sm">
              <span className="font-semibold text-gray-900">{seg.name}</span>
              <span className="text-gray-600">{seg.value.toLocaleString()} 人 ({seg.percentage.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`${seg.color} h-full rounded-full`}
                style={{ width: `${seg.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        <p className="font-semibold mb-1">分析重點</p>
        <p>活躍會員佔 50.5%，應成為重點經營對象。高風險會員 8.2%，需要喚回方案。</p>
      </div>
    </div>
  )
}

// 留存 Cohort 分析
export function CohortAnalysisChart() {
  const cohortData = [
    { month: '2025/06', m1: '100%', m2: '100%', m3: '78%', m4: '72%', m5: '68%', m6: '66%', m7: '64%' },
    { month: '2025/07', m1: '100%', m2: '100%', m3: '82%', m4: '78%', m5: '74%', m6: '—', m7: '—' },
    { month: '2025/08', m1: '100%', m2: '100%', m3: '82%', m4: '78%', m5: '—', m6: '—', m7: '—' },
    { month: '2025/09', m1: '100%', m2: '85%', m3: '80%', m4: '—', m5: '—', m6: '—', m7: '—' },
    { month: '2025/10', m1: '100%', m2: '86%', m3: '—', m4: '—', m5: '—', m6: '—', m7: '—' },
    { month: '2025/11', m1: '100%', m2: '—', m3: '—', m4: '—', m5: '—', m6: '—', m7: '—' }
  ]

  const getColor = (percentage: string) => {
    if (percentage === '—') return 'bg-gray-100 text-gray-400'
    const value = parseInt(percentage)
    if (value >= 90) return 'bg-green-500 text-white'
    if (value >= 80) return 'bg-green-400 text-white'
    if (value >= 70) return 'bg-yellow-400 text-white'
    return 'bg-orange-500 text-white'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">留存率 Cohort 分析</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 font-semibold text-gray-900">註冊月份</th>
              <th className="text-center py-2 px-1 font-semibold text-gray-700">第 1 月</th>
              <th className="text-center py-2 px-1 font-semibold text-gray-700">第 2 月</th>
              <th className="text-center py-2 px-1 font-semibold text-gray-700">第 3 月</th>
              <th className="text-center py-2 px-1 font-semibold text-gray-700">第 4 月</th>
              <th className="text-center py-2 px-1 font-semibold text-gray-700">第 5 月</th>
              <th className="text-center py-2 px-1 font-semibold text-gray-700">第 6 月</th>
            </tr>
          </thead>
          <tbody>
            {cohortData.map((row) => (
              <tr key={row.month} className="border-b border-gray-100">
                <td className="py-2 px-2 font-semibold text-gray-900">{row.month}</td>
                <td className="py-2 px-1"><span className={`inline-block px-2 py-1 rounded font-semibold ${getColor(row.m1)}`}>{row.m1}</span></td>
                <td className="py-2 px-1"><span className={`inline-block px-2 py-1 rounded font-semibold ${getColor(row.m2)}`}>{row.m2}</span></td>
                <td className="py-2 px-1"><span className={`inline-block px-2 py-1 rounded font-semibold ${getColor(row.m3)}`}>{row.m3}</span></td>
                <td className="py-2 px-1"><span className={`inline-block px-2 py-1 rounded font-semibold ${getColor(row.m4)}`}>{row.m4}</span></td>
                <td className="py-2 px-1"><span className={`inline-block px-2 py-1 rounded font-semibold ${getColor(row.m5)}`}>{row.m5}</span></td>
                <td className="py-2 px-1"><span className={`inline-block px-2 py-1 rounded font-semibold ${getColor(row.m6)}`}>{row.m6}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
        <p className="font-semibold mb-1">留存趨勢</p>
        <p>第 1 月留存率 100%，第 3 月下降至 78-82%，第 6 月穩定在 64-66%。需要在第 2-3 月加強會員黏著度。</p>
      </div>
    </div>
  )
}

// LINE 訊息成效
export function LineMessagePerformanceChart() {
  const data = [
    { metric: '送達率', value: 98.6, color: 'bg-blue-500' },
    { metric: '開啟率', value: 68.4, color: 'bg-green-500' },
    { metric: '點擊率', value: 24.8, color: 'bg-orange-500' },
    { metric: '轉換率', value: 14.8, color: 'bg-purple-500' }
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">LINE 訊息成效</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((item) => (
          <div key={item.metric} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">{item.metric}</span>
              <span className="text-lg font-bold text-gray-900">{item.value.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`${item.color} h-full rounded-full`}
                style={{ width: `${Math.min(item.value, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        <p className="font-semibold mb-1">改善方向</p>
        <p>開啟率已達 68.4%，但點擊率僅 24.8%。建議優化訊息內容與 CTA，提高點擊吸引力。</p>
      </div>
    </div>
  )
}

// 取消／No-show 趨勢
export function CancelNoShowTrendChart() {
  const days = ['10/29', '11/06', '11/13', '11/14', '11/22']
  const cancelRate = [12, 11, 10, 8.6, 5]
  const noshowRate = [5, 4, 3.5, 2.8, 2.5]

  const maxRate = Math.max(...cancelRate, ...noshowRate)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">取消／No-show 趨勢</h2>

      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            取消率
          </h3>
          <div className="flex items-end gap-2 h-32">
            {cancelRate.map((rate, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-red-500 rounded-t-lg transition-all"
                  style={{ height: `${(rate / maxRate) * 100}%` }}
                />
                <span className="text-xs font-semibold text-gray-700">{rate}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            No-show 率
          </h3>
          <div className="flex items-end gap-2 h-32">
            {noshowRate.map((rate, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-orange-500 rounded-t-lg transition-all"
                  style={{ height: `${(rate / maxRate) * 100}%` }}
                />
                <span className="text-xs font-semibold text-gray-700">{rate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 font-semibold">取消率改善</p>
          <p className="text-red-600 text-xs">從 12% ↓ 5.8%，改善 51.7%</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-orange-700 font-semibold">No-show 率改善</p>
          <p className="text-orange-600 text-xs">從 5% ↓ 2.5%，改善 50%</p>
        </div>
      </div>
    </div>
  )
}
