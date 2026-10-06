'use client'

import { useId, useState, type ReactNode } from 'react'

/**
 * 輕量 SVG 圖表，無第三方相依。
 *
 * 配色依 dataviz 指引驗證（亮／暗各自選步）：
 *   series-1 品牌綠  #0fa36b / #0fa36b
 *   series-2 橘      #eb6834 / #d95926
 *   series-3 藍      #2a78d6 / #3987e5
 * 文字一律用文字色票，不用系列色；單一系列不放圖例，由標題命名。
 */

export const SERIES = ['series-1', 'series-2', 'series-3'] as const
export type Series = (typeof SERIES)[number]

const SERIES_CLASS: Record<Series, string> = {
  'series-1': 'fill-[#0fa36b] dark:fill-[#0fa36b]',
  'series-2': 'fill-[#eb6834] dark:fill-[#d95926]',
  'series-3': 'fill-[#2a78d6] dark:fill-[#3987e5]',
}
const SERIES_STROKE: Record<Series, string> = {
  'series-1': 'stroke-[#0fa36b] dark:stroke-[#0fa36b]',
  'series-2': 'stroke-[#eb6834] dark:stroke-[#d95926]',
  'series-3': 'stroke-[#2a78d6] dark:stroke-[#3987e5]',
}
export const SERIES_DOT: Record<Series, string> = {
  'series-1': 'bg-[#0fa36b] dark:bg-[#0fa36b]',
  'series-2': 'bg-[#eb6834] dark:bg-[#d95926]',
  'series-3': 'bg-[#2a78d6] dark:bg-[#3987e5]',
}

export interface Point {
  label: string
  value: number
}

const fmt = (n: number) => n.toLocaleString()

/** 圖表外框：標題、副標、右上角附加內容。 */
export function ChartCard({ title, subtitle, aside, children }: { title: string; subtitle?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Tooltip({ x, y, label, value, unit }: { x: number; y: number; label: string; value: number; unit: string }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-[rgb(var(--border))] surface px-2 py-1 text-xs shadow-pop"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <p className="text-muted">{label}</p>
      <p className="font-medium tabular-nums">
        {unit === 'NT$' ? `NT$${fmt(value)}` : `${fmt(value)}${unit}`}
      </p>
    </div>
  )
}

/** 直式長條：單一系列、時間或類別在 x 軸。 */
export function BarChart({ data, series = 'series-1', unit = 'NT$', height = 160 }: { data: Point[]; series?: Series; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()
  if (data.length === 0) return <Empty height={height} />

  const W = 100
  const H = 100
  const padB = 14
  const max = Math.max(...data.map((d) => d.value), 1)
  const slot = W / data.length
  const barW = Math.min(slot * 0.6, 8)
  const maxIdx = data.findIndex((d) => d.value === max)
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-labelledby={id}>
        <title id={id}>{data.map((d) => `${d.label} ${fmt(d.value)}`).join('、')}</title>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={W} y1={(H - padB) * (1 - g)} y2={(H - padB) * (1 - g)} className="stroke-[rgb(var(--border))]" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} x2={W} y1={H - padB} y2={H - padB} className="stroke-[rgb(var(--border))]" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const h = ((H - padB) * d.value) / max
          const x = i * slot + (slot - barW) / 2
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <rect
                x={x}
                y={H - padB - h}
                width={barW}
                height={h}
                rx={1}
                className={`${SERIES_CLASS[series]} transition-opacity ${hover !== null && hover !== i ? 'opacity-50' : ''}`}
              />
            </g>
          )
        })}
      </svg>
      {/* x 軸標籤（HTML，避免 SVG 文字被拉伸） */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex text-[10px] text-muted">
        {data.map((d, i) => (
          <span key={i} className="truncate text-center" style={{ width: `${slot}%` }}>
            {i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      {/* 最大值直接標示 */}
      {hover === null && max > 0 && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 text-[10px] font-medium tabular-nums"
          style={{ left: `${(maxIdx + 0.5) * slot}%`, top: 0 }}
        >
          {unit === 'NT$' ? `NT$${fmt(max)}` : `${fmt(max)}${unit}`}
        </span>
      )}
      {hover !== null && (
        <Tooltip x={(hover + 0.5) * slot} y={(1 - data[hover].value / max) * (100 - padB)} label={data[hover].label} value={data[hover].value} unit={unit} />
      )}
    </div>
  )
}

/** 折線：單一系列，適合累計值。 */
export function LineChart({ data, series = 'series-3', unit = 'NT$', height = 160 }: { data: Point[]; series?: Series; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()
  if (data.length === 0) return <Empty height={height} />

  const W = 100
  const H = 100
  const padB = 14
  const values = data.map((d) => d.value)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const slot = W / data.length
  const px = (i: number) => (i + 0.5) * slot
  const py = (v: number) => (H - padB) * (1 - (v - min) / span)
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(d.value)}`).join(' ')
  const zeroY = py(0)
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))
  const last = data.length - 1

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-labelledby={id}>
        <title id={id}>{data.map((d) => `${d.label} ${fmt(d.value)}`).join('、')}</title>
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-[rgb(var(--border))]" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <path d={path} fill="none" className={SERIES_STROKE[series]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
            {(hover === i || i === last) && (
              <circle cx={px(i)} cy={py(d.value)} r={2} className={`${SERIES_CLASS[series]} stroke-[rgb(var(--bg))]`} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            )}
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex text-[10px] text-muted">
        {data.map((d, i) => (
          <span key={i} className="truncate text-center" style={{ width: `${slot}%` }}>
            {i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
      {hover === null && (
        <span
          className="pointer-events-none absolute -translate-y-full text-[10px] font-medium tabular-nums"
          style={{ right: 0, top: `${(py(data[last].value) / H) * 100}%` }}
        >
          {unit === 'NT$' ? `NT$${fmt(data[last].value)}` : `${fmt(data[last].value)}${unit}`}
        </span>
      )}
      {hover !== null && (
        <Tooltip x={px(hover)} y={(py(data[hover].value) / H) * 100} label={data[hover].label} value={data[hover].value} unit={unit} />
      )}
    </div>
  )
}

/** 橫式長條：類別比較，由大到小，直接標值。 */
export function HBarChart({ data, series, unit = 'NT$' }: { data: (Point & { series?: Series })[]; series?: Series; unit?: string }) {
  if (data.length === 0) return <Empty height={120} />
  const max = Math.max(...data.map((d) => d.value), 1)
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-xs">
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-sm ${SERIES_DOT[d.series ?? series ?? 'series-1']}`} aria-hidden />
              {d.label}
            </span>
            <span className="tabular-nums">
              {unit === 'NT$' ? `NT$${fmt(d.value)}` : `${fmt(d.value)}${unit}`}
              <span className="ml-1.5 text-muted">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
            <div className={`h-full rounded-sm ${SERIES_DOT[d.series ?? series ?? 'series-1']}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function Empty({ height }: { height: number }) {
  return (
    <div className="grid place-items-center text-xs text-muted" style={{ height }}>
      此期間沒有資料
    </div>
  )
}
