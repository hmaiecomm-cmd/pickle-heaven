'use client'

import { useEffect, useState } from 'react'

interface DevicePoint {
  id: string
  num: number
  x: number
  y: number
  type: 'booking' | 'business' | 'night' | 'power' | 'location'
}

const DEVICE_TYPES = {
  booking: { color: '#3b82f6', label: '預約動態控制（01-04）' },
  business: { color: '#22c55e', label: '營業時間控制（05-09）' },
  night: { color: '#ea580c', label: '環境夜間控制（10-11）' },
  power: { color: '#8b5cf6', label: '24 小時供電（12-16）' },
  location: { color: '#d1d5db', label: '位置標記（不可控）' },
}

const DEFAULT_DEVICES: DevicePoint[] = [
  { id: 'b01', num: 1, x: 320, y: 350, type: 'booking' },
  { id: 'b02', num: 2, x: 1000, y: 420, type: 'booking' },
  { id: 'b03', num: 3, x: 450, y: 400, type: 'booking' },
  { id: 'b04', num: 4, x: 1000, y: 630, type: 'booking' },
  { id: 'g05', num: 5, x: 150, y: 420, type: 'business' },
  { id: 'g06', num: 6, x: 350, y: 450, type: 'business' },
  { id: 'g07', num: 7, x: 500, y: 480, type: 'business' },
  { id: 'g08', num: 8, x: 650, y: 500, type: 'business' },
  { id: 'g09', num: 9, x: 100, y: 150, type: 'business' },
  { id: 'o10', num: 10, x: 200, y: 580, type: 'night' },
  { id: 'o11', num: 11, x: 300, y: 600, type: 'night' },
  { id: 'p12', num: 12, x: 900, y: 350, type: 'power' },
  { id: 'p13', num: 13, x: 950, y: 450, type: 'power' },
  { id: 'p14', num: 14, x: 850, y: 300, type: 'power' },
  { id: 'p15', num: 15, x: 1050, y: 280, type: 'power' },
  { id: 'p16', num: 16, x: 1100, y: 400, type: 'power' },
]

export function VenueLayoutMap({ devices = DEFAULT_DEVICES, interactive = true }: { devices?: DevicePoint[]; interactive?: boolean }) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(390)
  const [mounted, setMounted] = useState(false)

  const SVG_WIDTH = 1200
  const SVG_HEIGHT = 1600

  useEffect(() => {
    setMounted(true)
    const updateWidth = () => {
      if (typeof window !== 'undefined') {
        const width = Math.min(window.innerWidth - 32, 800)
        setContainerWidth(Math.max(width, 320))
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  if (!mounted) return null

  const currentScale = containerWidth / SVG_WIDTH
  const displayHeight = SVG_HEIGHT * currentScale

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">設施地圖</h2>
          <p className="text-xs text-muted mt-1 sm:mt-0">可拖曳移動 / 縮放查看</p>
        </div>
        {interactive && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => setScale(Math.max(scale - 0.1, 0.5))} className="rounded px-2 py-1 text-xs border border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100">−</button>
            <span className="px-3 py-1 text-xs text-muted whitespace-nowrap">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(Math.min(scale + 0.1, 2))} className="rounded px-2 py-1 text-xs border border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100">+</button>
          </div>
        )}
      </div>

      <div className="overflow-auto rounded-lg border border-zinc-200 bg-white shadow-sm" style={{maxHeight:'600px'}}>
        <div style={{width:containerWidth,height:displayHeight*scale}} className="inline-block min-w-full">
          <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} width={containerWidth} height={displayHeight} className="bg-white">
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#ffffff"/>
            <rect x="100" y="200" width="150" height="120" fill="#fff8f0" stroke="#d4a574" strokeWidth="2"/>
            <text x="175" y="250" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#8b6914">浴廁</text>
            <rect x="850" y="200" width="300" height="150" fill="#1e40af" stroke="#1e3a8a" strokeWidth="2" rx="8"/>
            <rect x="880" y="230" width="240" height="90" fill="#ffffff" stroke="#1e3a8a" strokeWidth="1" rx="4"/>
            <text x="1000" y="275" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#ffffff">球場 A</text>
            {devices.map((device) => (<g key={device.id}><circle cx={device.x} cy={device.y} r="20" fill={DEVICE_TYPES[device.type].color} opacity="0.8" stroke={selectedDevice===device.id?'#000':DEVICE_TYPES[device.type].color} strokeWidth={selectedDevice===device.id?2:0} onClick={()=>interactive&&setSelectedDevice(device.id)}/><text x={device.x} y={device.y+6} fontSize="14" fontWeight="bold" textAnchor="middle" fill="#ffffff" pointerEvents="none">{device.num}</text></g>))}
          </svg>
        </div>
      </div>

      <div className="space-y-2 rounded-lg bg-zinc-50 p-4 border border-zinc-200">
        <h3 className="text-sm font-semibold mb-3">設備說明</h3>
        <div className="grid grid-cols-1 gap-2">
          {Object.entries(DEVICE_TYPES).map(([type, { color, label }]) => (
            <div key={type} className="flex items-center gap-2 text-xs p-2 rounded hover:bg-white">
              <div className="w-5 h-5 rounded-full" style={{backgroundColor:color}}/>
              <span className="text-muted">{label}</span>
              <span className="text-xs">{devices.filter(d=>d.type===type).length}個</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
