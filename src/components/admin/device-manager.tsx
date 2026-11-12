'use client'

import * as React from 'react'
import {
  AirVent,
  Cable,
  CupSoda,
  DoorClosed,
  Fan,
  Flame,
  LampFloor,
  Lightbulb,
  MapPin,
  Monitor,
  PlugZap,
  Server,
  Signpost,
  Tent,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CIRCUIT_DEFINITIONS, type CircuitNumber } from '@/lib/control-types'
import {
  CATEGORY_INFO,
  CIRCUIT_NUMBERS,
  CIRCUIT_PLACEMENTS,
  LOCATION_MARKERS,
  VENUE_ZONES,
  ZONE_NAME,
  type CircuitCategory,
  type DeviceKind,
} from '@/lib/venue-layout'

const KIND_ICON: Record<DeviceKind, LucideIcon> = {
  light: Lightbulb,
  fan: Fan,
  outlet: PlugZap,
  sign: Signpost,
  heater: Flame,
  ambient: Tent,
  groundLight: LampFloor,
  door: DoorClosed,
  ac: AirVent,
  network: Server,
  appliance: Monitor,
  vending: CupSoda,
}

const TONE: Record<string, { stroke: string; chip: string; dot: string }> = {
  emerald: { stroke: '#059669', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  sky: { stroke: '#0284c7', chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  violet: { stroke: '#7c3aed', chip: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  amber: { stroke: '#d97706', chip: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  zinc: { stroke: '#71717a', chip: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' },
}

const ZONE_FILL: Record<string, string> = {
  court: '#ecfdf5',
  room: '#f8fafc',
  service: '#f4f4f5',
  outdoor: '#fffbeb',
}

const CATEGORIES = Object.keys(CATEGORY_INFO) as CircuitCategory[]
const placementOf = (n: CircuitNumber) => CIRCUIT_PLACEMENTS.find((p) => p.circuit === n)

type Selection = { type: 'circuit'; id: CircuitNumber } | { type: 'marker'; id: string } | null

export function DeviceManager() {
  const [selected, setSelected] = React.useState<Selection>({ type: 'circuit', id: '01' })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="map-title" className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="map-title" className="text-sm font-semibold">
              球館平面配置圖
            </h2>
            <p className="text-[11px] text-muted">區域與設備位置為示意，待現場確認</p>
          </div>
          <FloorPlan selected={selected} onSelect={setSelected} />
          <Legend />
        </section>

        <DetailPanel selected={selected} />
      </div>

      <CircuitList selected={selected} onSelect={setSelected} />
    </div>
  )
}

function FloorPlan({ selected, onSelect }: { selected: Selection; onSelect: (s: Selection) => void }) {
  return (
    <svg viewBox="0 0 100 70" className="h-auto w-full select-none" role="group" aria-label="球館平面配置圖">
      <rect x="0.5" y="0.5" width="99" height="69" rx="2" fill="#fafafa" stroke="#e4e4e7" strokeWidth="0.3" />
      {VENUE_ZONES.map((z) => (
        <g key={z.id}>
          <rect x={z.x} y={z.y} width={z.w} height={z.h} rx="1.2" fill={ZONE_FILL[z.tone]} stroke="#d4d4d8" strokeWidth="0.3" />
          <text x={z.x + 1.2} y={z.y + 2.8} fontSize="2" fontWeight={600} fill="#52525b">
            {z.name}
          </text>
        </g>
      ))}
      {[61.5, 86.5].map((cx) => (
        <line key={cx} x1={cx} y1="8" x2={cx} y2="62" stroke="#a7f3d0" strokeWidth="0.3" strokeDasharray="1 1" />
      ))}
      <text x="6" y="51" fontSize="1.6" fill="#a1a1aa" textAnchor="middle">
        戶外動線
      </text>

      {CIRCUIT_PLACEMENTS.map((p) => {
        const def = CIRCUIT_DEFINITIONS[p.circuit]
        const tone = TONE[CATEGORY_INFO[def.category].tone]
        const Icon = KIND_ICON[p.kind]
        const isSel = selected?.type === 'circuit' && selected.id === p.circuit
        return (
          <g
            key={p.circuit}
            role="button"
            tabIndex={0}
            aria-label={`迴路 ${p.circuit} ${def.name}`}
            aria-pressed={isSel}
            onClick={() => onSelect({ type: 'circuit', id: p.circuit })}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect({ type: 'circuit', id: p.circuit })}
            className="cursor-pointer outline-none"
          >
            {isSel && <circle cx={p.x} cy={p.y} r="3.2" fill="none" stroke={tone.stroke} strokeWidth="0.5" opacity="0.5" />}
            <circle cx={p.x} cy={p.y} r="2.2" fill="white" stroke={tone.stroke} strokeWidth={isSel ? 0.7 : 0.4} />
            <Icon x={p.x - 1.25} y={p.y - 1.25} width={2.5} height={2.5} color={tone.stroke} strokeWidth={2} aria-hidden />
            <text x={p.x + 2.6} y={p.y + 0.6} fontSize="1.6" fontWeight={700} fill="#3f3f46">
              {p.circuit}
            </text>
          </g>
        )
      })}

      {LOCATION_MARKERS.map((m) => {
        const isSel = selected?.type === 'marker' && selected.id === m.id
        return (
          <g
            key={m.id}
            role="button"
            tabIndex={0}
            aria-label={`${m.name}（位置標記，不可控制）`}
            aria-pressed={isSel}
            onClick={() => onSelect({ type: 'marker', id: m.id })}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect({ type: 'marker', id: m.id })}
            className="cursor-pointer outline-none"
          >
            <circle cx={m.x} cy={m.y} r="2.2" fill="white" stroke="#a1a1aa" strokeWidth={isSel ? 0.6 : 0.35} strokeDasharray="0.8 0.6" />
            <MapPin x={m.x - 1.2} y={m.y - 1.2} width={2.4} height={2.4} color="#71717a" strokeWidth={2} aria-hidden />
          </g>
        )
      })}
    </svg>
  )
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-zinc-600">
      {CATEGORIES.filter((c) => c !== 'RESERVED').map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', TONE[CATEGORY_INFO[c].tone].dot)} aria-hidden />
          {CATEGORY_INFO[c].label}（{CATEGORY_INFO[c].range}）
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <MapPin className="h-3 w-3 text-zinc-400" aria-hidden />
        位置標記（不可控制）
      </li>
    </ul>
  )
}

function Row({ label, value, pending }: { label: string; value: React.ReactNode; pending?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={cn('text-right', pending && 'text-amber-700')}>{value}</dd>
    </div>
  )
}

function DetailPanel({ selected }: { selected: Selection }) {
  if (selected?.type === 'marker') {
    const m = LOCATION_MARKERS.find((x) => x.id === selected.id)!
    return (
      <aside aria-label="設備詳情" className="rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-xs text-muted">位置標記</p>
        <h3 className="mt-1 text-base font-semibold">{m.name}</h3>
        <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">這是位置標記，不是電力迴路，沒有任何控制功能。</p>
      </aside>
    )
  }
  if (!selected) {
    return (
      <aside aria-label="設備詳情" className="grid place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-muted">
        點選平面圖或清單中的設備查看詳情
      </aside>
    )
  }
  const n = selected.id
  const def = CIRCUIT_DEFINITIONS[n]
  const cat = CATEGORY_INFO[def.category]
  const place = placementOf(n)
  const control =
    def.category === 'ALWAYS_ON'
      ? '不適用：24 小時供電，不套用預約自動斷電'
      : def.category === 'RESERVED'
        ? '不啟用：預留迴路'
        : '尚未串接硬體，Demo Mode 不提供開關'

  return (
    <aside aria-label="設備詳情" className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-muted">迴路 {n}</p>
      <h3 className="mt-1 text-base font-semibold">{def.name}</h3>
      <span className={cn('mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', TONE[cat.tone].chip)}>{cat.label}</span>
      <p className="mt-2 text-xs leading-relaxed text-zinc-600">{cat.rule}</p>

      <dl className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100">
        <Row label="位置" value={place ? `${ZONE_NAME[place.zone]}（示意）` : '未配置'} />
        <Row label="連線狀態" value={<span className="font-medium text-amber-700">未連線（Demo Mode）</span>} />
        <Row label="目前狀態" value="未知（尚未串接）" />
        <Row label="控制器／通道" value="待確認" pending />
        <Row label="電壓" value="待確認" pending />
        <Row label="額定功率" value="待確認" pending />
        <Row label="遠端控制" value={control} />
      </dl>
    </aside>
  )
}

function CircuitList({ selected, onSelect }: { selected: Selection; onSelect: (s: Selection) => void }) {
  return (
    <section aria-labelledby="circuits-title" className="rounded-2xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <h2 id="circuits-title" className="text-sm font-semibold">
          18 路電力迴路
        </h2>
        <p className="flex items-center gap-1 text-[11px] text-muted">
          <Cable className="h-3.5 w-3.5" aria-hidden />
          硬體、電壓與功率未確認的項目一律標示「待確認」
        </p>
      </div>

      {CATEGORIES.map((c) => {
        const info = CATEGORY_INFO[c]
        const items = CIRCUIT_NUMBERS.filter((n) => CIRCUIT_DEFINITIONS[n].category === c)
        return (
          <div key={c} className="border-b border-zinc-100 last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-zinc-50/70 px-4 py-2">
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TONE[info.tone].chip)}>
                {info.range}　{info.label}
              </span>
              <span className="text-[11px] text-muted">{info.rule}</span>
            </div>
            <ul>
              {items.map((n) => {
                const def = CIRCUIT_DEFINITIONS[n]
                const place = placementOf(n)
                const isSel = selected?.type === 'circuit' && selected.id === n
                return (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => onSelect({ type: 'circuit', id: n })}
                      aria-pressed={isSel}
                      className={cn(
                        'grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors sm:grid-cols-[2.5rem_minmax(0,1fr)_8rem_9rem]',
                        isSel ? 'bg-emerald-50/70' : 'hover:bg-zinc-50',
                      )}
                    >
                      <span className="font-mono text-xs font-semibold text-zinc-500">{n}</span>
                      <span className="truncate font-medium">{def.name}</span>
                      <span className="hidden truncate text-xs text-muted sm:block">{place ? ZONE_NAME[place.zone] : '—'}</span>
                      <span className="justify-self-end text-xs font-medium text-amber-700">
                        {c === 'RESERVED' ? <span className="text-zinc-500">預留未使用</span> : '未連線（Demo）'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
