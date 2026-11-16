'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AirVent,
  Cable,
  ChevronDown,
  Clock,
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
import { VenuePlanBase } from './venue-plan-base'
import { ControlSchedulePanel } from './control-schedule-panel'
import { CIRCUIT_DEFINITIONS, type CircuitNumber } from '@/lib/control-types'
import { ANOMALY_TYPE_LABEL, HEALTH_COLORS, type AnomalyType, type DeviceHealth } from '@/lib/device-health'
import { useDeviceAnomalies } from '@/hooks/useDeviceAnomalies'
import { useAnomalyWebSocket } from '@/hooks/useAnomalyWebSocket'
import {
  CATEGORY_INFO,
  CIRCUIT_NUMBERS,
  CIRCUIT_PLACEMENTS,
  CIRCUIT_SPECS,
  LOCATION_MARKERS,
  PLAN_HEIGHT,
  PLAN_WIDTH,
  UNPLACED_CIRCUITS,
  circuitLocation,
  isPending,
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
  blue: { stroke: '#2563eb', chip: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' },
  green: { stroke: '#16a34a', chip: 'bg-green-50 text-green-700 ring-green-200', dot: 'bg-green-500' },
  orange: { stroke: '#ea580c', chip: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  purple: { stroke: '#7c3aed', chip: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  zinc: { stroke: '#71717a', chip: 'bg-zinc-100 text-zinc-600 ring-zinc-200', dot: 'bg-zinc-400' },
}

const CATEGORIES = Object.keys(CATEGORY_INFO) as CircuitCategory[]
const toneOf = (n: CircuitNumber) => TONE[CATEGORY_INFO[CIRCUIT_DEFINITIONS[n].category].tone]

type Selection = { type: 'circuit'; id: CircuitNumber } | { type: 'marker'; id: string } | null

export function DeviceManager({ canEditSchedule = false }: { canEditSchedule?: boolean }) {
  const [selected, setSelected] = React.useState<Selection>({ type: 'circuit', id: '01' })
  const detailRef = React.useRef<HTMLDivElement>(null)

  // 提取當前選中迴路的編號（用於 useDeviceAnomalies）
  const currentCircuitId = selected?.type === 'circuit' ? selected.id : null

  // 獲取異常數據（API 驅動）
  const { anomalies, isUpdating, acknowledge, resolve, refetch } = useDeviceAnomalies(
    currentCircuitId || '01',
    'admin@example.com', // TODO: 從用戶會話獲取操作人
    10000 // 10 秒自動刷新
  )

  // WebSocket 實時推送（收到異常更新時自動刷新）
  useAnomalyWebSocket(true, (event) => {
    // 如果更新涉及當前迴路，刷新異常列表
    if (event.circuitId === currentCircuitId) {
      refetch()
    }
  })

  // 從下方清單選取時，詳情面板可能在畫面外，捲動到可見處
  const selectFromList = (s: Selection) => {
    setSelected(s)
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="map-title" className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="map-title" className="text-sm font-semibold">
              電力迴路終點配置圖
            </h2>
            <p className="text-[11px] text-muted">依現場配置圖繪製，比例為示意</p>
          </div>
          <FloorPlan selected={selected} onSelect={setSelected} />
          <UnplacedNote selected={selected} onSelect={setSelected} />
          <Legend />
        </section>

        <div ref={detailRef} className="scroll-mt-4 space-y-3">
          <DetailPanel selected={selected} canEditSchedule={canEditSchedule} />
          <AnomalyPanel
            selected={selected}
            anomalies={anomalies}
            isUpdating={isUpdating}
            onAcknowledge={acknowledge}
            onResolve={resolve}
          />
        </div>
      </div>

      <CircuitList selected={selected} onSelect={selectFromList} />
    </div>
  )
}

function FloorPlan({ selected, onSelect }: { selected: Selection; onSelect: (s: Selection) => void }) {
  const selectedCircuit = selected?.type === 'circuit' ? selected.id : null
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`} className="h-auto w-full min-w-[560px] select-none" role="group" aria-label="電力迴路終點配置圖">
        <VenuePlanBase />

        {CIRCUIT_PLACEMENTS.map((p, i) => {
          const tone = toneOf(p.circuit)
          const Icon = KIND_ICON[p.kind]
          const isSel = selectedCircuit === p.circuit
          const name = CIRCUIT_DEFINITIONS[p.circuit].name
          return (
            <g
              key={`${p.circuit}-${i}`}
              role="button"
              tabIndex={0}
              aria-label={`迴路 ${p.circuit} ${name}`}
              aria-pressed={isSel}
              onClick={() => onSelect({ type: 'circuit', id: p.circuit })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect({ type: 'circuit', id: p.circuit })}
              className="cursor-pointer outline-none"
            >
              {isSel && <circle cx={p.x} cy={p.y} r="3.3" fill={tone.stroke} opacity="0.18" />}
              <circle cx={p.x} cy={p.y} r="2.2" fill="white" stroke={tone.stroke} strokeWidth={isSel ? 0.7 : 0.4} />
              <Icon x={p.x - 1.25} y={p.y - 1.25} width={2.5} height={2.5} color={tone.stroke} strokeWidth={2} aria-hidden />
              <text x={p.x + 2.6} y={p.y + 0.6} fontSize="1.6" fontWeight={700} fill="#27272a" paintOrder="stroke" stroke="white" strokeWidth="0.5">
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
              <circle cx={m.x} cy={m.y} r="2" fill="white" stroke="#a1a1aa" strokeWidth={isSel ? 0.6 : 0.35} strokeDasharray="0.8 0.6" />
              <MapPin x={m.x - 1.1} y={m.y - 1.1} width={2.2} height={2.2} color="#71717a" strokeWidth={2} aria-hidden />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function UnplacedNote({ selected, onSelect }: { selected: Selection; onSelect: (s: Selection) => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
      <span className="font-medium">配置圖尚未標出位置：</span>
      {UNPLACED_CIRCUITS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect({ type: 'circuit', id: n })}
          aria-pressed={selected?.type === 'circuit' && selected.id === n}
          className="rounded-full bg-white px-2 py-0.5 ring-1 ring-amber-300 hover:bg-amber-100"
        >
          {n} {CIRCUIT_DEFINITIONS[n].name}
        </button>
      ))}
    </div>
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

function DetailPanel({ selected, canEditSchedule = false }: { selected: Selection; canEditSchedule?: boolean }) {
  const [scheduleExpanded, setScheduleExpanded] = React.useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false)

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
        點選配置圖或清單中的設備查看配置
      </aside>
    )
  }
  const n = selected.id
  const def = CIRCUIT_DEFINITIONS[n]
  const cat = CATEGORY_INFO[def.category]
  const spec = CIRCUIT_SPECS[n]
  const yesNo = (v: boolean) => (v ? '可' : '不可')

  // Demo: 模擬異常狀態（Phase 5 示範）
  const demoHealth: DeviceHealth = n === '12' ? 'critical' : n === '05' ? 'warning' : 'healthy'
  const demoAnomalies = demoHealth !== 'healthy' ? (demoHealth === 'critical' ? 2 : 1) : 0
  const healthColor = HEALTH_COLORS[demoHealth]

  return (
    <aside aria-label="設備詳情" className="rounded-2xl border border-zinc-200 bg-white p-4">
      {/* 健康狀態指示 */}
      <div className={cn('mb-3 flex items-center gap-2 rounded-lg px-3 py-2', healthColor.bg)}>
        <div className={cn('h-3 w-3 rounded-full', demoHealth === 'critical' ? 'blink-critical' : '', healthColor.dot)} aria-hidden />
        <span className={cn('text-xs font-semibold', healthColor.text)}>{healthColor.label}</span>
        {demoAnomalies > 0 && <span className={cn('ml-auto text-xs font-medium', healthColor.text)}>{demoAnomalies} 個異常</span>}
      </div>

      <p className="text-xs text-muted">迴路 {n}</p>
      <h3 className="mt-1 text-base font-semibold">{def.name}</h3>
      <span className={cn('mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TONE[cat.tone].chip)}>
        {cat.label}・{cat.schedule}
      </span>
      <p className="mt-2 text-xs text-muted">{cat.rule}</p>
      {def.category === 'ALWAYS_ON' && <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">24 小時供電迴路，不受預約與排程控制。</p>}
      {def.scheduleControlEnabled && (
        <>
          <button
            type="button"
            onClick={() => setScheduleExpanded(!scheduleExpanded)}
            className="mt-4 w-full inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50"
          >
            <Clock className="h-4 w-4" aria-hidden />
            {scheduleExpanded ? '收合排程設定' : '展開排程設定'}
            <ChevronDown className={cn('h-4 w-4 transition-transform ml-auto', scheduleExpanded && 'rotate-180')} aria-hidden />
          </button>
          {scheduleExpanded && (
            <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4">
              <ControlSchedulePanel
                key={n}
                circuitNumber={n}
                category={def.category}
                canEdit={canEditSchedule}
              />
            </div>
          )}
        </>
      )}
    </aside>
  )
}

interface AnomalyPanelProps {
  selected: Selection
  anomalies: Array<{
    id: string
    type: AnomalyType
    severity: 'warning' | 'error' | 'critical'
    status: 'pending' | 'acknowledged' | 'resolved'
    occurredAt: string
    lastReportedAt: string
  }>
  isUpdating?: boolean
  onAcknowledge?: (id: string, notes?: string) => Promise<void>
  onResolve?: (id: string, notes?: string) => Promise<void>
}

function AnomalyPanel({
  selected,
  anomalies,
  isUpdating = false,
  onAcknowledge,
  onResolve,
}: AnomalyPanelProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [notes, setNotes] = React.useState<Record<string, string>>({})

  if (!selected || selected.type !== 'circuit') {
    return null
  }

  if (anomalies.length === 0) {
    return null
  }

  const severityColor: Record<'warning' | 'error' | 'critical', string> = {
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
  }

  const severityLabel: Record<'warning' | 'error' | 'critical', string> = {
    warning: '警告',
    error: '異常',
    critical: '嚴重',
  }

  const handleAcknowledge = async (id: string) => {
    if (!onAcknowledge) return
    try {
      await onAcknowledge(id, notes[id])
      setNotes((prev) => ({ ...prev, [id]: '' }))
    } catch (error) {
      console.error('確認異常失敗', error)
    }
  }

  const handleResolve = async (id: string) => {
    if (!onResolve) return
    try {
      await onResolve(id, notes[id])
      setNotes((prev) => ({ ...prev, [id]: '' }))
    } catch (error) {
      console.error('解決異常失敗', error)
    }
  }

  return (
    <aside aria-label="異常詳情" className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold">異常紀錄</h3>
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
          {anomalies.filter((a) => a.status === 'pending').length}
        </span>
      </div>

      <ul className="space-y-2">
        {anomalies.map((a) => (
          <li key={a.id} className={cn('rounded-lg border px-3 py-2.5', severityColor[a.severity])}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs font-semibold">{ANOMALY_TYPE_LABEL[a.type]}</p>
                <p className="mt-0.5 text-xs opacity-75">
                  嚴重程度：{severityLabel[a.severity]} · 狀態：{a.status === 'pending' ? '待處理' : a.status === 'acknowledged' ? '已確認' : '已解決'}
                </p>
              </div>
              <span className="shrink-0 text-[10px] opacity-70">{new Date(a.occurredAt).toLocaleTimeString('zh-TW')}</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => handleAcknowledge(a.id)}
                disabled={isUpdating || a.status !== 'pending'}
                className="inline-flex h-7 flex-1 items-center justify-center rounded border border-current border-opacity-30 bg-white bg-opacity-40 text-[11px] font-medium hover:bg-opacity-60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                確認
              </button>
              <button
                type="button"
                onClick={() => handleResolve(a.id)}
                disabled={isUpdating || a.status === 'resolved'}
                className="inline-flex h-7 flex-1 items-center justify-center rounded border border-current border-opacity-30 bg-white bg-opacity-40 text-[11px] font-medium hover:bg-opacity-60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                解決
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2">
        <label htmlFor="anomaly-notes" className="block text-xs font-medium text-zinc-700">
          全局備註
        </label>
        <textarea
          id="anomaly-notes"
          placeholder="記錄異常處理過程或備註..."
          className="mt-1 block w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          rows={2}
          disabled={isUpdating}
        />
      </div>
    </aside>
  )
}

function CircuitList({ selected, onSelect }: { selected: Selection; onSelect: (s: Selection) => void }) {
  return (
    <section aria-labelledby="circuits-title" className="rounded-2xl border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <h2 id="circuits-title" className="text-sm font-semibold">
          18 路強電控制迴路
        </h2>
        <p className="flex items-center gap-1 text-[11px] text-muted">
          <Cable className="h-3.5 w-3.5" aria-hidden />
          尚未確認的電壓、負載與控制器一律標示「待確認」
        </p>
      </div>

      <div className="hidden grid-cols-[2.5rem_minmax(0,1.4fr)_minmax(0,1.3fr)_7rem] gap-3 border-b border-zinc-100 px-4 py-2 text-[11px] font-medium text-muted md:grid">
        <span>編號</span>
        <span>控制設備／區域</span>
        <span>電壓／負載（功率）</span>
        <span className="text-right">狀態</span>
      </div>

      {CATEGORIES.map((c) => {
        const info = CATEGORY_INFO[c]
        const items = CIRCUIT_NUMBERS.filter((n) => CIRCUIT_DEFINITIONS[n].category === c)
        return (
          <div key={c} className="border-b border-zinc-100 last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-zinc-50/70 px-4 py-2">
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TONE[info.tone].chip)}>
                {info.range}　{info.label}・{info.schedule}
              </span>
              <span className="text-[11px] text-muted">{info.rule}</span>
            </div>
            <ul>
              {items.map((n) => {
                const def = CIRCUIT_DEFINITIONS[n]
                const spec = CIRCUIT_SPECS[n]
                const isSel = selected?.type === 'circuit' && selected.id === n
                const power = `${spec.voltage}／${spec.load}`
                return (
                  <li key={n}>
                    <button
                      type="button"
                      onClick={() => onSelect({ type: 'circuit', id: n })}
                      aria-pressed={isSel}
                      className={cn(
                        'grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors md:grid-cols-[2.5rem_minmax(0,1.4fr)_minmax(0,1.3fr)_7rem]',
                        isSel ? 'bg-emerald-50/70' : 'hover:bg-zinc-50',
                      )}
                    >
                      <span className="font-mono text-xs font-semibold text-zinc-500">{n}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {def.name}
                          {spec.units ? <span className="ml-1 font-normal text-muted">（{spec.units}）</span> : null}
                        </span>
                        <span className="block truncate text-[11px] text-muted">{circuitLocation(n)}</span>
                      </span>
                      <span className={cn('hidden truncate text-xs md:block', isPending(power) ? 'text-amber-700' : 'text-zinc-700')}>{power}</span>
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
