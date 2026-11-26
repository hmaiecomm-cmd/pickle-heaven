'use client'
import type { MemberIdentity } from './member-operations-types'

export function OperationFilterPanel({ rangeDays, onRangeChange, venues, onVenuesChange, memberTypes, onMemberTypesChange, venueOptions }: any) {
  const rangeOptions = [{ label: '近 7 天', value: 7 }, { label: '近 30 天', value: 30 }, { label: '近 90 天', value: 90 }, { label: '近 180 天', value: 180 }]

  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6">
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-sm font-semibold">時間範圍</h3>
          <div className="flex gap-2">
            {rangeOptions.map(o => (
              <button key={o.value} onClick={() => onRangeChange(o.value)} className={`px-3 py-2 text-sm rounded-lg ${rangeDays === o.value ? 'bg-[#2f7d3b] text-white' : 'border border-[#d0d5ca]'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
