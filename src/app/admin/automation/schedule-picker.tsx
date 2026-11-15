'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ControlSchedulePanel } from '@/components/admin/control-schedule-panel'
import { CIRCUIT_DEFINITIONS, type CircuitNumber } from '@/lib/control-types'
import { CATEGORY_INFO, CIRCUIT_NUMBERS, type CircuitCategory } from '@/lib/venue-layout'

const SCHEDULABLE = CIRCUIT_NUMBERS.filter((n) => CIRCUIT_DEFINITIONS[n].scheduleControlEnabled).sort()

export function SchedulePicker({ initial, canEdit, businessHours }: { initial: CircuitNumber; canEdit: boolean; businessHours?: { openMinute: number; closeMinute: number } }) {
  const router = useRouter()
  const [circuit, setCircuit] = React.useState<CircuitNumber>(initial)
  const groups = (Object.keys(CATEGORY_INFO) as CircuitCategory[])
    .map((c) => ({ c, items: SCHEDULABLE.filter((n) => CIRCUIT_DEFINITIONS[n].category === c) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">迴路</span>
        <select
          className="h-10 min-w-0 flex-1 rounded-xl border border-[rgb(var(--border))] bg-white px-3 sm:max-w-sm"
          value={circuit}
          onChange={(e) => {
            const n = e.target.value as CircuitNumber
            setCircuit(n)
            router.replace(`/admin/automation?circuit=${n}`, { scroll: false })
          }}
        >
          {groups.map((g) => (
            <optgroup key={g.c} label={`${CATEGORY_INFO[g.c].range} ${CATEGORY_INFO[g.c].label}`}>
              {g.items.map((n) => (
                <option key={n} value={n}>
                  {n}　{CIRCUIT_DEFINITIONS[n].name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <ControlSchedulePanel key={circuit} circuitNumber={circuit} category={CIRCUIT_DEFINITIONS[circuit].category} canEdit={canEdit} businessHours={businessHours} />
    </div>
  )
}
