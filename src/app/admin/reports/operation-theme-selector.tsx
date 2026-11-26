'use client'
import { OPERATION_THEME_LABELS, type OperationTheme } from './member-operations-types'

export function OperationThemeSelector({ value, onChange }: { value: OperationTheme; onChange: (t: OperationTheme) => void }) {
  const themes: OperationTheme[] = ['off-peak-fill', 'casual-to-prepay', 'card-renewal', 'dormant-recovery', 'organizer-analysis', 'noshowm-manage']
  
  return (
    <div className="rounded-2xl border border-[#e3e8dc] bg-white p-6">
      <h2 className="mb-4 text-base font-bold">選擇營運痛點</h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {themes.map(t => {
          const label = OPERATION_THEME_LABELS[t]
          return (
            <button key={t} onClick={() => onChange(t)} className={`rounded-lg p-3 text-left border-2 ${value === t ? 'border-[#2f7d3b] bg-[#f1f5ec]' : 'border-[#e3e8dc]'}`}>
              <div className="font-semibold text-sm">{label.title}</div>
              <div className="text-xs text-muted mt-1">{label.subtitle}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
