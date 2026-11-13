'use client'

import * as React from 'react'
import { ChevronDown, Clock, Plus, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORY_INFO, type CircuitCategory } from '@/lib/venue-layout'
import { CIRCUIT_DEFINITIONS, DEFAULT_CIRCUIT_CONFIG, type CircuitNumber } from '@/lib/control-types'

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const CONTROL_MODES: Array<{
  category: CircuitCategory
  circuits: CircuitNumber[]
  color: string
}> = [
  {
    category: 'RESERVATION_DYNAMIC',
    circuits: ['01', '02', '03', '04'],
    color: 'blue',
  },
  {
    category: 'OPERATING_HOURS',
    circuits: ['05', '06', '07', '08', '09'],
    color: 'green',
  },
  {
    category: 'NIGHT_AMBIENT',
    circuits: ['10', '11'],
    color: 'orange',
  },
  {
    category: 'ALWAYS_ON',
    circuits: ['12', '13', '14', '15', '16'],
    color: 'purple',
  },
  {
    category: 'RESERVED',
    circuits: ['17', '18'],
    color: 'zinc',
  },
]

const TONE_STYLES: Record<string, { chip: string; icon: string; border: string }> = {
  blue: {
    chip: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: 'text-blue-600',
    border: 'border-blue-200',
  },
  green: {
    chip: 'bg-green-50 text-green-700 ring-green-200',
    icon: 'text-green-600',
    border: 'border-green-200',
  },
  orange: {
    chip: 'bg-orange-50 text-orange-700 ring-orange-200',
    icon: 'text-orange-600',
    border: 'border-orange-200',
  },
  purple: {
    chip: 'bg-violet-50 text-violet-700 ring-violet-200',
    icon: 'text-violet-600',
    border: 'border-violet-200',
  },
  zinc: {
    chip: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
    icon: 'text-zinc-500',
    border: 'border-zinc-200',
  },
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  weekdays?: string
  note?: string
}

interface ScheduleState {
  [key: string]: {
    enabled: boolean
    defaultStart?: string
    defaultEnd?: string
    customSlots: TimeSlot[]
  }
}

interface ControlSchedulePanelProps {
  circuitNumber: CircuitNumber
  category: CircuitCategory
}

export function ControlSchedulePanel({ circuitNumber, category }: ControlSchedulePanelProps) {
  const [expanded, setExpanded] = React.useState<CircuitCategory | null>(category)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [saveMessage, setSaveMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [schedules, setSchedules] = React.useState<ScheduleState>({
    RESERVATION_DYNAMIC: {
      enabled: true,
      customSlots: [],
    },
    OPERATING_HOURS: {
      enabled: true,
      defaultStart: '08:00',
      defaultEnd: '22:00',
      customSlots: [],
    },
    NIGHT_AMBIENT: {
      enabled: true,
      defaultStart: '18:00',
      defaultEnd: '22:00',
      customSlots: [],
    },
    ALWAYS_ON: {
      enabled: true,
      customSlots: [],
    },
    RESERVED: {
      enabled: false,
      customSlots: [],
    },
  })

  // 載入已保存的排程數據
  React.useEffect(() => {
    const loadSchedules = async () => {
      try {
        const response = await fetch(`/api/admin/circuits/schedule?circuitNumber=${circuitNumber}&category=${category}`)
        if (!response.ok) return

        const data = await response.json()

        // 如果有已保存的排程數據，更新到 state
        if (data.schedules && data.schedules.length > 0) {
          const mainSchedule = data.schedules.find((s: any) => !s.note)
          const customSchedules = data.schedules.filter((s: any) => s.note)

          if (mainSchedule) {
            setSchedules((prev) => ({
              ...prev,
              [category]: {
                ...prev[category],
                defaultStart: minutesToTime(mainSchedule.startMinute),
                defaultEnd: minutesToTime(mainSchedule.endMinute),
              },
            }))
          }

          if (customSchedules.length > 0) {
            setSchedules((prev) => ({
              ...prev,
              [category]: {
                ...prev[category],
                customSlots: customSchedules.map((s: any) => ({
                  id: s.id,
                  startTime: minutesToTime(s.startMinute),
                  endTime: minutesToTime(s.endMinute),
                  weekdays: s.weekdays,
                  note: s.note,
                })),
              },
            }))
          }
        }

        // 載入預約控制設定
        if (data.reservationAdvanceMinutes !== undefined) {
          setSchedules((prev) => ({
            ...prev,
            RESERVATION_DYNAMIC: {
              ...prev.RESERVATION_DYNAMIC,
              defaultStart: String(data.reservationAdvanceMinutes),
              defaultEnd: String(data.reservationDelayMinutes),
            },
          }))
        }
      } catch (error) {
        console.error('Failed to load schedules:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSchedules()
  }, [circuitNumber, category])

  const handleSave = async (saveCategory: CircuitCategory) => {
    setIsSaving(true)
    setSaveMessage(null)

    try {
      const response = await fetch('/api/admin/circuits/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circuitNumber,
          category: saveCategory,
          operatingHours:
            saveCategory === 'OPERATING_HOURS'
              ? {
                  startMinute: timeToMinutes(schedules[saveCategory].defaultStart || '08:00'),
                  endMinute: timeToMinutes(schedules[saveCategory].defaultEnd || '22:00'),
                  weekdays: '0,1,2,3,4,5,6',
                }
              : undefined,
          nightAmbience:
            saveCategory === 'NIGHT_AMBIENT'
              ? {
                  startMinute: timeToMinutes(schedules[saveCategory].defaultStart || '18:00'),
                  endMinute: timeToMinutes(schedules[saveCategory].defaultEnd || '22:00'),
                  weekdays: '0,1,2,3,4,5,6',
                }
              : undefined,
          reservationControl:
            saveCategory === 'RESERVATION_DYNAMIC'
              ? {
                  advanceMinutes: parseInt(schedules[saveCategory].defaultStart || '0'),
                  delayMinutes: parseInt(schedules[saveCategory].defaultEnd || '0'),
                }
              : undefined,
          customSlots:
            (schedules[saveCategory].customSlots && schedules[saveCategory].customSlots.length > 0)
              ? schedules[saveCategory].customSlots.map((s) => ({
                  id: s.id,
                  startMinute: timeToMinutes(s.startTime),
                  endMinute: timeToMinutes(s.endTime),
                  weekdays: s.weekdays || '0,1,2,3,4,5,6',
                  note: s.note,
                }))
              : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      setSaveMessage({ type: 'success', text: '設定已保存' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      setSaveMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失敗，請稍後重試' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleMode = (category: CircuitCategory) => {
    setExpanded(expanded === category ? null : category)
  }

  const handleTimeChange = (
    category: CircuitCategory,
    field: 'defaultStart' | 'defaultEnd',
    value: string
  ) => {
    setSchedules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }))
  }

  const handleAddSlot = (category: CircuitCategory) => {
    const newSlot: TimeSlot = {
      id: `${Date.now()}-${Math.random()}`,
      startTime: '09:00',
      endTime: '10:00',
    }
    setSchedules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        customSlots: [...prev[category].customSlots, newSlot],
      },
    }))
  }

  const handleRemoveSlot = (category: CircuitCategory, slotId: string) => {
    setSchedules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        customSlots: prev[category].customSlots.filter((s) => s.id !== slotId),
      },
    }))
  }

  const handleSlotChange = (
    category: CircuitCategory,
    slotId: string,
    field: keyof TimeSlot,
    value: string
  ) => {
    setSchedules((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        customSlots: prev[category].customSlots.map((s) =>
          s.id === slotId ? { ...s, [field]: value } : s
        ),
      },
    }))
  }

  // 找到當前迴路對應的分類信息
  const currentMode = CONTROL_MODES.find((m) => m.category === category)
  const info = currentMode ? CATEGORY_INFO[currentMode.category] : null
  const tone = currentMode ? TONE_STYLES[currentMode.color] : null
  const def = CIRCUIT_DEFINITIONS[circuitNumber]

  return (
    <aside aria-label="控制排程管理" className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-xs text-muted">迴路 {circuitNumber}</p>
          <h2 className="mt-1 text-base font-semibold">{def.name}</h2>
        </div>
      </div>

      {info && tone && (
        <div className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', tone.chip)}>
          {info.range}・{info.label}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{info?.rule}</p>

      <div className="mt-4 space-y-3">
        {CONTROL_MODES.map((mode) => {
          const info = CATEGORY_INFO[mode.category]
          const tone = TONE_STYLES[mode.color]
          const state = schedules[mode.category]
          const isExpanded = expanded === mode.category

          return (
            <div
              key={mode.category}
              className={cn(
                'rounded-lg border transition-colors',
                isExpanded ? tone.border : 'border-zinc-200',
                isExpanded ? 'bg-blue-50/30' : 'bg-white'
              )}
            >
              <button
                type="button"
                onClick={() => handleToggleMode(mode.category)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left',
                  'transition-colors hover:bg-white/50'
                )}
              >
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    isExpanded && 'rotate-180'
                  )}
                />

                <div className="flex-1 min-w-0">
                  <div className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', tone.chip)}>
                    {info.range}・{info.label}
                  </div>
                  <p className="mt-1 text-xs text-muted">{info.rule}</p>
                </div>

                {mode.category === 'ALWAYS_ON' && (
                  <span className="whitespace-nowrap rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                    24H 供電
                  </span>
                )}
                {mode.category === 'RESERVED' && (
                  <span className="whitespace-nowrap rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600">
                    未啟用
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-200 px-4 py-3">
                  {mode.category === 'RESERVATION_DYNAMIC' && (
                    <div className="space-y-3 text-sm">
                      <div className="rounded-lg bg-zinc-50 p-3">
                        <label className="block text-xs font-medium text-zinc-700">
                          預約前提前開啟（分鐘）
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          defaultValue="0"
                          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                        />
                      </div>
                      <div className="rounded-lg bg-zinc-50 p-3">
                        <label className="block text-xs font-medium text-zinc-700">
                          預約後延遲關閉（分鐘）
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          defaultValue="0"
                          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-600">
                        ℹ️ 本分類自動依預約時間運作，不需額外設定營業時間
                      </p>
                    </div>
                  )}

                  {mode.category === 'OPERATING_HOURS' && (
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-zinc-50 p-3">
                          <label className="block text-xs font-medium text-zinc-700">
                            開啟時間
                          </label>
                          <input
                            type="time"
                            value={state.defaultStart || '08:00'}
                            onChange={(e) =>
                              handleTimeChange(mode.category, 'defaultStart', e.target.value)
                            }
                            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="rounded-lg bg-zinc-50 p-3">
                          <label className="block text-xs font-medium text-zinc-700">
                            關閉時間
                          </label>
                          <input
                            type="time"
                            value={state.defaultEnd || '22:00'}
                            onChange={(e) =>
                              handleTimeChange(mode.category, 'defaultEnd', e.target.value)
                            }
                            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900">
                        <p className="font-medium">適用迴路：05–09</p>
                        <p className="mt-1">大門招牌、Pro Shop 照明與插座、休息區風扇、浴室熱水器</p>
                      </div>
                    </div>
                  )}

                  {mode.category === 'NIGHT_AMBIENT' && (
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-zinc-50 p-3">
                          <label className="block text-xs font-medium text-zinc-700">
                            開啟時間
                          </label>
                          <input
                            type="time"
                            value={state.defaultStart || '18:00'}
                            onChange={(e) =>
                              handleTimeChange(mode.category, 'defaultStart', e.target.value)
                            }
                            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div className="rounded-lg bg-zinc-50 p-3">
                          <label className="block text-xs font-medium text-zinc-700">
                            關閉時間
                          </label>
                          <input
                            type="time"
                            value={state.defaultEnd || '22:00'}
                            onChange={(e) =>
                              handleTimeChange(mode.category, 'defaultEnd', e.target.value)
                            }
                            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900">
                        <p className="font-medium">適用迴路：10–11</p>
                        <p className="mt-1">露營燈、地燈（夜間環境氣氛）</p>
                      </div>
                    </div>
                  )}

                  {mode.category === 'ALWAYS_ON' && (
                    <div className="space-y-2 text-sm">
                      <div className="rounded-lg bg-purple-50 p-3">
                        <p className="font-medium text-purple-900">持續供電</p>
                        <p className="mt-1 text-xs text-purple-700">
                          24 小時不斷電，包括門禁、監控、弱電設備。不提供排程斷電操作。
                        </p>
                      </div>
                    </div>
                  )}

                  {mode.category === 'RESERVED' && (
                    <div className="space-y-2 text-sm">
                      <div className="rounded-lg bg-zinc-50 p-3">
                        <p className="font-medium text-zinc-700">未啟用</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          預留迴路 17–18 尚未配置，不可控制。
                        </p>
                      </div>
                    </div>
                  )}

                  {(mode.category === 'OPERATING_HOURS' || mode.category === 'NIGHT_AMBIENT') && (
                    <div className="mt-4 border-t border-zinc-200 pt-3">
                      <button
                        type="button"
                        onClick={() => handleAddSlot(mode.category)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 py-2 text-sm text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
                      >
                        <Plus className="h-4 w-4" />
                        新增其他時段
                      </button>

                      {state.customSlots.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {state.customSlots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex gap-2 rounded-lg bg-zinc-50 p-2 items-end"
                            >
                              <input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) =>
                                  handleSlotChange(
                                    mode.category,
                                    slot.id,
                                    'startTime',
                                    e.target.value
                                  )
                                }
                                className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                              />
                              <span className="text-zinc-400">–</span>
                              <input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) =>
                                  handleSlotChange(
                                    mode.category,
                                    slot.id,
                                    'endTime',
                                    e.target.value
                                  )
                                }
                                className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveSlot(mode.category, slot.id)}
                                className="rounded p-1 text-zinc-400 hover:bg-white hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2 border-t border-zinc-200 pt-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSave(mode.category)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                      儲存設定
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(null)}
                      className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      收合
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {saveMessage && (
        <div
          className={cn(
            'mt-4 rounded-lg border p-3 text-xs font-medium',
            saveMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          )}
        >
          {saveMessage.text}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-medium">⚠️ Demo 模式</p>
        <p className="mt-1">排程設定尚未連接硬體控制器，儲存後不會實際控制設備。</p>
      </div>
    </aside>
  )
}
