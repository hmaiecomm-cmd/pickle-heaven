'use client'

import * as React from 'react'
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
  ChevronRight,
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
  const [selected, setSelected] = React.useState<Selection>(null)
  const [expandedGroups, setExpandedGroups] = React.useState<Set<CircuitCategory>>(new Set(['RESERVATION_DYNAMIC']))
  const [planExpanded, setPlanExpanded] = React.useState(false)

  // 提取當前選中迴路的編號（用於 useDeviceAnomalies）
  const currentCircuitId = selected?.type === 'circuit' ? selected.id : null

  // 獲取異常數據（API 驅動）
  const { anomalies, isUpdating, acknowledge, resolve, refetch } = useDeviceAnomalies(
    currentCircuitId || '01',
    'admin@example.com',
    10000
  )

  // WebSocket 實時推送
  useAnomalyWebSocket(true, (event) => {
    if (event.circuitId === currentCircuitId) {
      refetch()
    }
  })

  const toggleGroup = (category: CircuitCategory) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-6">
      {/* 電力迴路配置（頁面最頂端） */}
      <FloorPlanCollapsible selected={selected} onSelect={setSelected} expanded={planExpanded} onExpandedChange={setPlanExpanded} />

      {/* 點選迴路後的設定區（直接在配置下方） */}
      {selected?.type === 'circuit' && (
        <div className="space-y-3">
          <DetailPanel selected={selected} canEditSchedule={canEditSchedule} />
          <AnomalyPanel
            selected={selected}
            anomalies={anomalies}
            isUpdating={isUpdating}
            onAcknowledge={acknowledge}
            onResolve={resolve}
          />
        </div>
      )}

      {/* 設備控制區（分類清單 - 備用） */}
      <section aria-labelledby="device-control-title" className="space-y-3">
        <h2 id="device-control-title" className="text-sm font-semibold px-1">設備控制</h2>
        <DeviceGroupList selected={selected} onSelect={setSelected} expandedGroups={expandedGroups} onToggleGroup={toggleGroup} />
      </section>
    </div>
  )
}

function DeviceGroupList({
  selected,
  onSelect,
  expandedGroups,
  onToggleGroup,
}: {
  selected: Selection
  onSelect: (s: Selection) => void
  expandedGroups: Set<CircuitCategory>
  onToggleGroup: (category: CircuitCategory) => void
}) {
  const selectedCircuit = selected?.type === 'circuit' ? selected.id : null

  return (
    <div className="space-y-2">
      {CATEGORIES.map((category) => {
        const info = CATEGORY_INFO[category]
        const items = CIRCUIT_NUMBERS.filter((n) => CIRCUIT_DEFINITIONS[n].category === category)
        const isExpanded = expandedGroups.has(category)

        return (
          <div key={category} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            {/* 群組標題 */}
            <button
              type="button"
              onClick={() => onToggleGroup(category)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 shrink-0', TONE[info.tone].chip)}>
                  {info.range}
                </span>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium truncate">{info.label}</p>
                  <p className="text-xs text-muted truncate">{items.length} 個設備</p>
                </div>
              </div>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-180')} />
            </button>

            {/* 展開設備列表 */}
            {isExpanded && (
              <div className="border-t border-zinc-100 divide-y divide-zinc-100">
                {items.map((n) => {
                  const def = CIRCUIT_DEFINITIONS[n]
                  const spec = CIRCUIT_SPECS[n]
                  const isSel = selectedCircuit === n
                  const demoHealth: DeviceHealth = n === '12' ? 'critical' : n === '05' ? 'warning' : 'healthy'

                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onSelect({ type: 'circuit', id: n })}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                        isSel ? 'bg-brand-50/50' : 'hover:bg-zinc-50'
                      )}
                    >
                      {/* 圖示 */}
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', TONE[info.tone].chip)}>
                        <Lightbulb className="h-4 w-4" />
                      </div>

                      {/* 設備資訊 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-mono font-bold text-zinc-700">迴路 {n}</span>
                          <span className="text-sm font-medium truncate">{def.name}</span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">{CATEGORY_INFO[def.category].label}</p>
                      </div>

                      {/* 狀態指示 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className={cn('h-2 w-2 rounded-full', HEALTH_COLORS[demoHealth].dot)} />
                        <ChevronRight className="h-4 w-4 text-muted" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FloorPlanCollapsible({
  selected,
  onSelect,
  expanded,
  onExpandedChange,
}: {
  selected: Selection
  onSelect: (s: Selection) => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}) {
  const selectedCircuit = selected?.type === 'circuit' ? selected.id : null

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-100"
      >
        <h3 className="text-sm font-semibold">電力迴路配置圖</h3>
        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="p-4">
          <FloorPlan selected={selected} onSelect={onSelect} />
          <UnplacedNote selected={selected} onSelect={onSelect} />
          <Legend />
        </div>
      )}
    </section>
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


function DetailPanel({ selected, canEditSchedule = false }: { selected: Selection; canEditSchedule?: boolean }) {
  const [scheduleExpanded, setScheduleExpanded] = React.useState(false)
  const [detailsExpanded, setDetailsExpanded] = React.useState(false)

  if (!selected || selected.type !== 'circuit') {
    return null
  }

  const n = selected.id
  const def = CIRCUIT_DEFINITIONS[n]
  const cat = CATEGORY_INFO[def.category]
  const spec = CIRCUIT_SPECS[n]

  const demoHealth: DeviceHealth = n === '12' ? 'critical' : n === '05' ? 'warning' : 'healthy'
  const demoAnomalies = demoHealth !== 'healthy' ? (demoHealth === 'critical' ? 2 : 1) : 0
  const healthColor = HEALTH_COLORS[demoHealth]

  return (
    <aside aria-label="設備詳情" className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4">
      {/* 設備名稱和狀態 */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-mono font-bold text-zinc-700">迴路 {n}</p>
            <h3 className="mt-1 text-lg font-semibold">{def.name}</h3>
          </div>
          <div className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 shrink-0', healthColor.bg)}>
            <div className={cn('h-2 w-2 rounded-full', demoHealth === 'critical' ? 'blink-critical' : '', healthColor.dot)} aria-hidden />
            <span className={cn('text-xs font-semibold', healthColor.text)}>{healthColor.label}</span>
          </div>
        </div>
        <span className={cn('mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1', TONE[cat.tone].chip)}>
          {cat.label}
        </span>
      </div>

      {/* 目前時段控制 */}
      <div className="space-y-3 rounded-lg bg-zinc-50 p-3">
        <h4 className="text-sm font-semibold text-zinc-900">目前時段控制</h4>
        <p className="text-xs text-muted">設定此迴路目前的開啟與關閉時間。儲存後會更新此迴路的排程摘要。</p>

        {/* 時間控制欄位 */}
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">開啟時間</label>
            <input
              type="time"
              defaultValue="09:00"
              className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1.5">關閉時間</label>
            <input
              type="time"
              defaultValue="23:00"
              className="w-full h-9 rounded-lg border border-zinc-300 px-3 text-sm bg-white"
            />
          </div>
        </div>
      </div>

      {/* 開關控制 */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-700">設備目前狀態：開啟</label>
        <div className="flex gap-2">
          <button className="flex-1 h-9 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors">
            開啟
          </button>
          <button className="flex-1 h-9 rounded-lg border border-zinc-300 bg-white text-sm font-medium hover:bg-zinc-50 transition-colors">
            關閉
          </button>
        </div>
        <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded">Demo Mode：尚未串接真實設備，操作不會送出實際控制指令。</p>
      </div>

      {/* 目前排程 */}
      {def.scheduleControlEnabled && (
        <>
          <div>
            <p className="text-xs font-medium text-zinc-700">目前排程</p>
            <p className="mt-1 text-sm font-medium">{cat.schedule}</p>
            <p className="mt-1 text-xs text-muted">預約前提前開啟 10 分鐘，預約後延遲關閉 5 分鐘</p>
          </div>

          {/* 排程設定按鈕 */}
          <button
            type="button"
            onClick={() => setScheduleExpanded(!scheduleExpanded)}
            className="w-full h-9 flex items-center justify-between gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            <span>排程設定</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', scheduleExpanded && 'rotate-180')} />
          </button>

          {scheduleExpanded && (
            <div className="pt-2 border-t border-zinc-200">
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

      {/* 詳細資料 */}
      <button
        type="button"
        onClick={() => setDetailsExpanded(!detailsExpanded)}
        className="w-full h-9 flex items-center justify-between gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 transition-colors"
      >
        <span>查看詳細資料</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', detailsExpanded && 'rotate-180')} />
      </button>

      {detailsExpanded && (
        <div className="pt-2 border-t border-zinc-200 space-y-2 text-sm">
          <Row label="位置" value={circuitLocation(n)} />
          <Row label="電壓" value={spec.voltage || '待確認'} pending={isPending(spec.voltage)} />
          <Row label="負載" value={spec.load || '待確認'} pending={isPending(spec.load)} />
          <Row label="連線狀態" value="未連線（Demo）" />
          <Row label="Demo 模式" value="是" />
          {spec.note && <Row label="備註" value={spec.note} />}
        </div>
      )}
    </aside>
  )
}

function Row({ label, value, pending }: { label: string; value: React.ReactNode; pending?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted text-xs">{label}</dt>
      <dd className={cn('text-right text-xs', pending && 'text-amber-700')}>{value}</dd>
    </div>
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

