'use client'

import { useState } from 'react'
import { AlertCircle, Info, Lightbulb, Wind, PlugZap, AtSign, Lock, Droplet } from 'lucide-react'

const FACILITIES = [
  { id: 'a', name: '球場 A', type: 'court', x: 65, y: 35, width: 20, height: 25 },
  { id: 'b', name: '球場 B', type: 'court', x: 65, y: 65, width: 20, height: 25 },
  { id: 'shop', name: 'Pro Shop', type: 'shop', x: 35, y: 35, width: 20, height: 20 },
  { id: 'rest', name: '休息區', type: 'rest', x: 35, y: 65, width: 20, height: 20 },
  { id: 'entrance', name: '出入口', type: 'entrance', x: 10, y: 50, width: 15, height: 15 },
  { id: 'bathroom', name: '廁所', type: 'utility', x: 90, y: 50, width: 8, height: 12 },
]

const DEVICE_TYPES = [
  { icon: Lightbulb, label: '照明', color: '#fbbf24' },
  { icon: Wind, label: '風扇', color: '#60a5fa' },
  { icon: PlugZap, label: '插座', color: '#ec4899' },
  { icon: AtSign, label: '招牌', color: '#8b5cf6' },
  { icon: Lock, label: '門禁', color: '#10b981' },
  { icon: Droplet, label: '設施', color: '#6366f1' },
]

const CIRCUITS = [
  {
    id: 1,
    name: '球場 A 主燈',
    category: 'dynamic',
    devices: [{ type: 'light', x: 73, y: 40, label: '主燈' }],
  },
  {
    id: 2,
    name: '球場 A 涼風扇',
    category: 'dynamic',
    devices: [{ type: 'fan', x: 70, y: 48, label: '風扇' }],
  },
  {
    id: 3,
    name: '球場 B 主燈',
    category: 'dynamic',
    devices: [{ type: 'light', x: 73, y: 70, label: '主燈' }],
  },
  {
    id: 4,
    name: '球場 B 涼風扇',
    category: 'dynamic',
    devices: [{ type: 'fan', x: 70, y: 78, label: '風扇' }],
  },
  {
    id: 5,
    name: '大門與 Pro Shop 招牌',
    category: 'business',
    devices: [
      { type: 'sign', x: 15, y: 50, label: '招牌' },
      { type: 'light', x: 43, y: 35, label: '招牌燈' },
    ],
  },
  {
    id: 6,
    name: 'Pro Shop 室內照明',
    category: 'business',
    devices: [{ type: 'light', x: 40, y: 42, label: '照明' }],
  },
  {
    id: 7,
    name: 'Pro Shop 室內插座',
    category: 'business',
    devices: [{ type: 'outlet', x: 45, y: 40, label: '插座' }],
  },
  {
    id: 8,
    name: '休息區壁掛扇',
    category: 'business',
    devices: [{ type: 'fan', x: 42, y: 72, label: '壁扇' }],
  },
  {
    id: 9,
    name: '浴室熱水器',
    category: 'business',
    devices: [{ type: 'heater', x: 94, y: 56, label: '熱水器' }],
  },
  {
    id: 10,
    name: '環境氣氛燈－露營燈',
    category: 'night',
    devices: [{ type: 'light', x: 50, y: 20, label: '露營燈' }],
  },
  {
    id: 11,
    name: '環境氣氛燈－地燈',
    category: 'night',
    devices: [{ type: 'light', x: 55, y: 82, label: '地燈' }],
  },
  {
    id: 12,
    name: '大門監控與門鎖供電',
    category: '24h',
    devices: [
      { type: 'lock', x: 12, y: 47, label: '門鎖' },
      { type: 'light', x: 15, y: 56, label: '監控' },
    ],
  },
  {
    id: 13,
    name: 'Pro Shop 冷氣供電',
    category: '24h',
    devices: [{ type: 'outlet', x: 38, y: 28, label: '冷氣' }],
  },
  {
    id: 14,
    name: '辦公室弱電箱專用插座',
    category: '24h',
    devices: [{ type: 'outlet', x: 30, y: 10, label: '弱電' }],
  },
  {
    id: 15,
    name: '辦公室電器',
    category: '24h',
    devices: [{ type: 'outlet', x: 28, y: 15, label: '辦公' }],
  },
  {
    id: 16,
    name: '販賣機專用插座',
    category: '24h',
    devices: [{ type: 'outlet', x: 92, y: 70, label: '販賣機' }],
  },
  {
    id: 17,
    name: '預留迴路 1',
    category: 'reserved',
    devices: [],
  },
  {
    id: 18,
    name: '預留迴路 2',
    category: 'reserved',
    devices: [],
  },
]

const CATEGORY_LABEL = {
  dynamic: '預約動態控制（01-04）',
  business: '營業時間控制（05-09）',
  night: '環境夜間控制（10-11）',
  '24h': '24 小時供電（12-16）',
  reserved: '預留迴路（17-18）',
}

const CATEGORY_COLOR = {
  dynamic: 'from-blue-100 to-blue-50',
  business: 'from-orange-100 to-orange-50',
  night: 'from-indigo-100 to-indigo-50',
  '24h': 'from-emerald-100 to-emerald-50',
  reserved: 'from-gray-100 to-gray-50',
}

export function DeviceConfigMap() {
  const [selectedCircuit, setSelectedCircuit] = useState<number | null>(null)
  const circuitsByCategory: Record<string, typeof CIRCUITS> = {
    dynamic: [],
    business: [],
    night: [],
    '24h': [],
    reserved: [],
  }

  CIRCUITS.forEach((c) => {
    circuitsByCategory[c.category as keyof typeof circuitsByCategory]?.push(c)
  })

  const getDeviceIcon = (type: string) => {
    const map: Record<string, any> = {
      light: Lightbulb,
      fan: Wind,
      outlet: PlugZap,
      sign: AtSign,
      lock: Lock,
      heater: Droplet,
    }
    return map[type] || Info
  }

  return (
    <div className="space-y-6">
      {/* 平面圖 */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">球館平面圖</h3>
          <div className="flex gap-2 flex-wrap">
            {DEVICE_TYPES.map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-1 text-[11px]">
                <Icon className="w-3 h-3" style={{ color }} />
                <span className="text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <svg viewBox="0 0 100 100" className="w-full border border-zinc-200 rounded-lg bg-gradient-to-b from-green-50 to-white">
          {/* 邊界 */}
          <rect x="5" y="5" width="90" height="90" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />

          {/* 設施區域 */}
          {FACILITIES.map((f) => (
            <g key={f.id}>
              <rect
                x={f.x}
                y={f.y}
                width={f.width}
                height={f.height}
                fill={f.type === 'court' ? '#dbeafe' : '#fef3c7'}
                stroke="#9ca3af"
                strokeWidth="0.3"
                rx="1"
              />
              <text
                x={f.x + f.width / 2}
                y={f.y + f.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="3"
                fontWeight="500"
                fill="#374151"
              >
                {f.name}
              </text>
            </g>
          ))}

          {/* 設備標記 */}
          {CIRCUITS.map((circuit) =>
            circuit.devices.map((device, idx) => {
              const Icon = getDeviceIcon(device.type)
              const isSelected = selectedCircuit === circuit.id
              return (
                <g
                  key={`${circuit.id}-${idx}`}
                  onClick={() => setSelectedCircuit(isSelected ? null : circuit.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    cx={device.x}
                    cy={device.y}
                    r={isSelected ? 2.5 : 1.5}
                    fill={isSelected ? '#10b981' : '#f97316'}
                    opacity={isSelected ? 1 : 0.8}
                    style={{
                      transition: 'all 0.2s',
                    }}
                  />
                  <text
                    x={device.x}
                    y={device.y + 3}
                    textAnchor="middle"
                    fontSize="2"
                    fill="#ffffff"
                    fontWeight="bold"
                  >
                    {circuit.id}
                  </text>
                </g>
              )
            }),
          )}
        </svg>

        {selectedCircuit && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="text-sm font-semibold text-emerald-900">
              迴路 {selectedCircuit}: {CIRCUITS.find((c) => c.id === selectedCircuit)?.name}
            </p>
          </div>
        )}
      </div>

      {/* 迴路分類列表 */}
      <div className="space-y-4">
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <div key={key} className={`rounded-2xl border border-zinc-200 bg-gradient-to-r ${CATEGORY_COLOR[key as keyof typeof CATEGORY_COLOR]} p-4`}>
            <h3 className="text-sm font-semibold mb-3">{label}</h3>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {circuitsByCategory[key as keyof typeof circuitsByCategory].map((circuit) => (
                <button
                  key={circuit.id}
                  onClick={() => setSelectedCircuit(selectedCircuit === circuit.id ? null : circuit.id)}
                  className={`p-3 rounded-lg text-left text-sm transition-all ${
                    selectedCircuit === circuit.id
                      ? 'bg-white ring-2 ring-emerald-500 shadow-md'
                      : 'bg-white/50 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-900">迴路 {circuit.id}</p>
                      <p className="text-xs text-muted">{circuit.name}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                      {circuit.devices.length === 0 ? '預留' : `${circuit.devices.length} 設備`}
                    </span>
                  </div>
                  {circuit.devices.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {circuit.devices.map((device, idx) => {
                        const Icon = getDeviceIcon(device.type)
                        return (
                          <div key={idx} className="flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px]">
                            <Icon className="w-3 h-3" />
                            <span>{device.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 注意事項 */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">使用說明</p>
            <ul className="mt-2 text-xs text-amber-800 space-y-1">
              <li>• 點擊平面圖或清單中的迴路可查看詳細信息</li>
              <li>• 預約動態控制（01-04）在預約時段自動開關</li>
              <li>• 營業時間控制（05-09）依營業時間自動管理</li>
              <li>• 24 小時供電（12-16）不適用一般自動斷電規則</li>
              <li>• 所有遠端控制操作均需授權且記錄在案</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
