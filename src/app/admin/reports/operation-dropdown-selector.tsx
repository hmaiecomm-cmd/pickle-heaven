'use client'
import { useState } from 'react'

interface Option {
  value: string
  label: string
  subtitle?: string
}

interface DropdownSelectorProps {
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  fullWidth?: boolean
}

export function DropdownSelector({ label, value, options, onChange, fullWidth = false }: DropdownSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className={fullWidth ? 'w-full' : 'flex-1'}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-4 py-2.5 border border-[#e3e8dc] rounded-lg bg-white text-left flex justify-between items-center hover:border-[#2f7d3b] transition ${fullWidth ? 'text-base' : 'text-sm'}`}
        >
          <span className="font-medium">{selectedOption?.label || '請選擇'}</span>
          <svg className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e3e8dc] rounded-lg shadow-lg z-50">
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-3 border-b border-[#e3e8dc] last:border-b-0 hover:bg-[#f1f5ec] transition ${
                  value === opt.value ? 'bg-[#f1f5ec] border-l-4 border-l-[#2f7d3b]' : ''
                }`}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                {opt.subtitle && <div className="text-xs text-gray-500 mt-1">{opt.subtitle}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
