'use client'

import { useEffect, useState } from 'react'

interface DevicePoint {
  id: string
  num: number
  x: number
  y: number
  type: 'booking' | 'business' | 'night' | 'power' | 'location'
  label?: string
}

interface VenueLayoutMapProps {
  devices?: DevicePoint[]
  className?: string
  interactive?: boolean
}

const DEVICE_TYPES = {
  booking: { color: '#3b82f6', label: '預約動態控制（01-04）' },
  business: { color: '#22c55e', label: '營業時間控制（05-09）' },
  night: { color: '#ea580c', label: '環境夜間控制（10-11）' },
  power: { color: '#8b5cf6', label: '24 小時供電（12-16）' },
  location: { color: '#d1d5db', label: '位置標記（不可控）' },
}

export function VenueLayoutMap({ devices = DEFAULT_DEVICES, className = '', interactive = true }: VenueLayoutMapProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(390)
  const [mounted, setMounted] = useState(false)

  // SVG 坐標系統：1200x1600（桌面基準）
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
    <div className={`space-y-4 ${className}`}>
      {/* 標題與控制項 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-0">
        <div>
          <h2 className="text-lg font-semibold">設施地圖</h2>
          <p className="text-xs text-muted mt-1 sm:mt-0">可拖曳移動 / 縮放查看</p>
        </div>
        {interactive && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => setScale(Math.max(scale - 0.1, 0.5))}
              className="rounded px-2 py-1 text-xs border border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100"
              title="縮小"
            >
              −
            </button>
            <span className="px-3 py-1 text-xs text-muted whitespace-nowrap">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(Math.min(scale + 0.1, 2))}
              className="rounded px-2 py-1 text-xs border border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100"
              title="放大"
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* 地圖容器 */}
      <div className="overflow-auto rounded-lg border border-zinc-200 bg-white shadow-sm" style={{ maxHeight: '600px' }}>
        <div
          style={{
            width: containerWidth,
            height: displayHeight * scale,
            transformOrigin: 'top left',
          }}
          className="inline-block min-w-full"
        >
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            width={containerWidth}
            height={displayHeight}
            className="bg-white"
          >
            {/* 背景 */}
            <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#ffffff" />

            {/* 外圍綠色停車位指示 */}
            {Array.from({ length: 15 }).map((_, i) => (
              <circle
                key={`parking-${i}`}
                cx={30 + (i % 2) * 20}
                cy={150 + Math.floor(i / 2) * 60}
                r="12"
                fill="#86efac"
                opacity="0.5"
              />
            ))}

            {/* 建築主體區域 */}
            <g>
              {/* 浴廁 */}
              <rect x="100" y="200" width="150" height="120" fill="#fff8f0" stroke="#d4a574" strokeWidth="2" />
              <text x="175" y="250" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#8b6914">
                浴廁
              </text>

              {/* Pro Shop */}
              <rect x="250" y="200" width="140" height="120" fill="#f0f8ff" stroke="#87ceeb" strokeWidth="2" />
              <text x="320" y="230" fontSize="16" fontWeight="bold" textAnchor="middle" fill="#003d82">
                Pro Shop
              </text>

              {/* 辦公室 */}
              <rect x="390" y="200" width="150" height="120" fill="#fff0f5" stroke="#dda0dd" strokeWidth="2" />
              <text x="465" y="250" fontSize="20" fontWeight="bold" textAnchor="middle" fill="#8b008b">
                辦公室
              </text>

              {/* 出入口 */}
              <rect x="540" y="200" width="140" height="120" fill="#f0fff0" stroke="#98fb98" strokeWidth="2" />
              <text x="610" y="230" fontSize="16" fontWeight="bold" textAnchor="middle" fill="#228b22">
                出入口
              </text>

              {/* 桌區 */}
              <rect x="680" y="200" width="140" height="120" fill="#fffacd" stroke="#bdb76b" strokeWidth="2" />
              <text x="750" y="250" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#8b8b00">
                桌區
              </text>

              {/* 休息區（站板） */}
              <rect x="100" y="380" width="720" height="100" fill="#fff9e6" stroke="#daa520" strokeWidth="2" />
              <text x="460" y="430" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#8b6914">
                休息區 (站板)
              </text>

              {/* 球場 A */}
              <g>
                <rect x="850" y="200" width="300" height="150" fill="#1e40af" stroke="#1e3a8a" strokeWidth="2" rx="8" />
                <rect x="880" y="230" width="240" height="90" fill="#ffffff" stroke="#1e3a8a" strokeWidth="1" rx="4" />
                <text x="1000" y="275" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#ffffff">
                  球場 A
                </text>
              </g>

              {/* 球場 B */}
              <g>
                <rect x="850" y="430" width="300" height="150" fill="#1e40af" stroke="#1e3a8a" strokeWidth="2" rx="8" />
                <rect x="880" y="460" width="240" height="90" fill="#ffffff" stroke="#1e3a8a" strokeWidth="1" rx="4" />
                <text x="1000" y="505" fontSize="18" fontWeight="bold" textAnchor="middle" fill="#ffffff">
                  球場 B
                </text>
              </g>
            </g>

            {/* 設備點 */}
            {devices.map((device) => (
              <g key={device.id}>
                <circle
                  cx={device.x}
                  cy={device.y}
                  r="20"
                  fill={DEVICE_TYPES[device.type].color}
                  opacity="0.8"
                  stroke={selectedDevice === device.id ? '#000' : DEVICE_TYPES[device.type].color}
                  strokeWidth={selectedDevice === device.id ? 2 : 0}
                  style={{
                    cursor: interactive ? 'pointer' : 'default',
                    transition: 'all 200ms ease',
                  }}
                  onClick={() => interactive && setSelectedDevice(device.id)}
                />
                <text
                  x={device.x}
                  y={device.y + 6}
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="#ffffff"
                  pointerEvents="none"
                >
                  {device.num}
                </text>
              </g>
            ))}

            {/* 停車場 */}
            <g>
              <rect x="1150" y="200" width="80" height="380" fill="#e8f5e9" stroke="#4caf50" strokeWidth="2" rx="4" />
              <text x="1190" y="300" fontSize="14" fontWeight="bold" textAnchor="middle" fill="#2e7d32" transform="rotate(-90 1190 300)">
                停車場
              </text>
            </g>

            {/* 電燈柱 */}
            <rect x="1150" y="650" width="20" height="300" fill="#8b4513" stroke="#654321" strokeWidth="2" />
            <text x="1160" y="850" fontSize="12" textAnchor="middle" fill="#654321">
              電燈柱
            </text>
          </svg>
        </div>
      </div>

      {/* 圖例 */}
      <div className="space-y-2 rounded-lg bg-zinc-50 p-4">
        <h3 className="text-sm font-semibold mb-3">設備說明</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(DEVICE_TYPES).map(([type, { color, label }]) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 選中設備資訊 */}
      {selectedDevice && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <div className="font-medium text-blue-900">
            設備編號：{devices.find((d) => d.id === selectedDevice)?.num}
          </div>
          <div className="text-blue-700 mt-1">
            類型：{DEVICE_TYPES[devices.find((d) => d.id === selectedDevice)?.type || 'location'].label}
          </div>
        </div>
      )}
    </div>
  )
}

// 預設設備點數據
const DEFAULT_DEVICES: DevicePoint[] = [
  // 預約動態控制 (藍色)
  { id: 'b01', num: 1, x: 320, y: 350, type: 'booking' },
  { id: 'b02', num: 2, x: 1000, y: 420, type: 'booking' },
  { id: 'b03', num: 3, x: 450, y: 400, type: 'booking' },
  { id: 'b04', num: 4, x: 1000, y: 630, type: 'booking' },

  // 營業時間控制 (綠色)
  { id: 'g05', num: 5, x: 150, y: 420, type: 'business' },
  { id: 'g06', num: 6, x: 350, y: 450, type: 'business' },
  { id: 'g07', num: 7, x: 500, y: 480, type: 'business' },
  { id: 'g08', num: 8, x: 650, y: 500, type: 'business' },
  { id: 'g09', num: 9, x: 100, y: 150, type: 'business' },

  // 環境夜間控制 (橙色)
  { id: 'o10', num: 10, x: 200, y: 580, type: 'night' },
  { id: 'o11', num: 11, x: 300, y: 600, type: 'night' },

  // 24 小時供電 (紫色)
  { id: 'p12', num: 12, x: 900, y: 350, type: 'power' },
  { id: 'p13', num: 13, x: 950, y: 450, type: 'power' },
  { id: 'p14', num: 14, x: 850, y: 300, type: 'power' },
  { id: 'p15', num: 15, x: 1050, y: 280, type: 'power' },
  { id: 'p16', num: 16, x: 1100, y: 400, type: 'power' },

  // 位置標記 (灰色)
  { id: 'l01', num: 0, x: 50, y: 100, type: 'location' },
  { id: 'l02', num: 0, x: 100, y: 50, type: 'location' },
]
