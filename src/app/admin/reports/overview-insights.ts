import type { ChartKey, CourtState, OverviewData } from './overview-types'

export const money = (n: number) => `NT$${Math.round(n).toLocaleString()}`
export const COURT_STATE_LABEL: Record<CourtState, string> = { IN_USE: '使用中', AVAILABLE: '可預約', MAINTENANCE: '維護中', SUSPENDED: '暫停使用' }
const abs = (n: number) => Math.abs(Math.round(n * 10) / 10)

/** 頂部「快速判讀」：依目前期間的 KPI 產生，沒有資料就明說資料不足 */
export function quickRead(d: OverviewData): string[] {
  if (!d.hasData) return []
  const { utilization: u, revenue: r, orders: o, members: m } = d.kpi
  const lines: string[] = []
  if (u.change !== null) lines.push(`使用率 ${u.value}%，較前期${u.change >= 0 ? '上升' : '下降'} ${abs(u.change)} 個百分點${u.change > 0 ? '，場地需求增加' : u.change < 0 ? '，可留意離峰時段的促銷安排' : ''}。`)
  else lines.push(`使用率 ${u.value}%，前期沒有可比較的資料。`)
  if (r.change !== null) lines.push(`營收 ${money(r.value)}，較前期${r.change >= 0 ? '成長' : '減少'} ${abs(r.change)}%。`)
  else lines.push(`營收 ${money(r.value)}，前期沒有可比較的資料。`)
  const oUp = (o.change ?? 0) > 0
  const mUp = (m.change ?? 0) > 0
  if (o.change !== null && m.change !== null && oUp && mUp) lines.push('訂單數與會員數皆較前期成長。')
  else {
    lines.push(o.change === null ? `訂單 ${o.value} 筆，前期沒有可比較的資料。` : `訂單 ${o.value} 筆，較前期${o.change >= 0 ? '增加' : '減少'} ${abs(o.change)}%。`)
    if (m.change !== null) lines.push(`會員共 ${m.value.toLocaleString()} 位，較前期${m.change >= 0 ? '增加' : '減少'} ${abs(m.change)}%。`)
  }
  return lines
}

/** 圖表下方的簡易判讀，只描述目前選中的圖表 */
export function chartRead(chart: ChartKey, d: OverviewData): string {
  if (chart === 'usage') {
    const pts = d.usage.filter((p) => p.value > 0)
    if (!pts.length) return '尚無足夠資料'
    const avg = Math.round((d.usage.reduce((s, p) => s + p.value, 0) / d.usage.length) * 10) / 10
    const hi = d.usage.reduce((a, b) => (b.value > a.value ? b : a))
    const lo = d.usage.reduce((a, b) => (b.value < a.value ? b : a))
    return `平均使用率 ${avg}%；最高 ${hi.label}（${hi.value}%），最低 ${lo.label}（${lo.value}%）。`
  }
  if (chart === 'courts') {
    if (!d.courts.length) return '尚未建立場地'
    const count = (s: CourtState) => d.courts.filter((c) => c.status === s).length
    const ranked = d.courts.filter((c) => c.rate !== null).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))
    const top = ranked[0]
    return `目前使用中 ${count('IN_USE')} 面、可預約 ${count('AVAILABLE')} 面、維護中 ${count('MAINTENANCE')} 面、暫停使用 ${count('SUSPENDED')} 面。${top && (top.rate ?? 0) > 0 ? `期間使用率最高為 ${top.name}（${top.rate}%）。` : ''}`
  }
  if (chart === 'heatmap') {
    let best = { v: -1, at: '' }
    let worst = { v: 101, at: '' }
    for (const row of d.heatmap.rows) row.values.forEach((v, i) => {
      if (v > best.v) best = { v, at: `${row.label} ${d.heatmap.hours[i]}` }
      if (v < worst.v) worst = { v, at: `${row.label} ${d.heatmap.hours[i]}` }
    })
    if (best.v <= 0) return '尚無足夠資料'
    return `最熱門時段為 ${best.at}（${best.v}%），最冷門為 ${worst.at}（${worst.v}%），可作為排程與離峰優惠參考。`
  }
  const total = d.revenue.sources.reduce((s, x) => s + x.amount, 0)
  if (total <= 0) return '此期間尚無營收資料'
  const main = [...d.revenue.sources].sort((a, b) => b.amount - a.amount)[0]
  const c = d.kpi.revenue.change
  return `期間總營收 ${money(total)}${c === null ? '' : `，較前期${c >= 0 ? '成長' : '減少'} ${abs(c)}%`}；主要收入來源為${main.label}（${Math.round((main.amount / total) * 100)}%）。`
}
