'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface AlwaysOpenToggleProps {
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export function AlwaysOpenToggle({ value, onChange, disabled }: AlwaysOpenToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 rounded-full border-2 border-transparent transition-colors',
        value ? 'bg-[#1f4d34]' : 'bg-zinc-300',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
          value ? 'translate-x-7' : 'translate-x-0'
        )}
      />
      <span className={cn(
        'absolute inset-0 flex items-center justify-center text-xs font-semibold transition-colors',
        value ? 'text-white' : 'text-zinc-600'
      )}>
        {value ? '開啟' : '關閉'}
      </span>
    </button>
  )
}
