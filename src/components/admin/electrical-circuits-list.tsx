'use client'

import { useState } from 'react'
import { Power, Zap, Clock, AlertCircle, Wifi } from 'lucide-react'

const CIRCUITS = [
  {
    id: 1,
    name: '球場 A 主燈',
    category: 'dynamic',
    status: 'online',
    power: true,
    devices: ['LED 主燈 18×4'],
    controlType: '預約自動控制',
    nextAction: '預約時自動開啟',
  },
  {
    id: 2,
    name: '球場 A 涼風扇',
    category: 'dynamic',
    status: 'online',
    power: false,
    devices: ['涼風扇'],
    controlType: '預約自動控制',
    nextAction: '預約時自動開啟',
  },
  {
    id: 3,
    name: '球場 B 主燈',
    category: 'dynamic',
    status: 'online',
    power: true,
    devices: ['LED 主燈 18×4'],
    controlType: '預約自動控制',
    nextAction: '預約時自動開啟',
  },
  {
    id: 4,
    name: '球場 B 涼風扇',
    category: 'dynamic',
    status: 'offline',
    power: false,
    devices: ['涼風扇'],
    controlType: '預約自動控制',
    nextAction: '待連接',
  },
  {
    id: 5,
    name: '大門與 Pro Shop 招牌',
    category: 'business',
    status: 'online',
    power: true,
    devices: ['招牌燈', '大門照明'],
    controlType: '營業時間控制',
    nextAction: '晚間 18:00 自動開啟',
  },
  {
    id: 6,
    name: 'Pro Shop 室內照明',
    category: 'business',
    status: 'online',
    power: true,
    devices: ['天花板燈組'],
    controlType: '營業時間控制',
    nextAction: '營業時開啟',
  },
  {
    id: 7,
    name: 'Pro Shop 室內插座',
    category: 'business',
    status: 'online',
    power: true,
    devices: ['販售台電源', '收銀機'],
    controlType: '24 小時供電',
    nextAction: '持續供電',
  },
  {
    id: 8,
    name: '休息區壁掛扇',
    category: 'business',
    status: 'online',
    power: false,
    devices: ['壁掛扇'],
    controlType: '營業時間控制',
    nextAction: '營業時開啟',
  },
  {
    id: 9,
    name: '浴室熱水器',
    category: 'business',
    status: 'unknown',
    power: false,
    devices: ['即熱式熱水器'],
    controlType: '營業時間控制',
    nextAction: '待確認',
  },
  {
    id: 10,
    name: '環境氣氛燈－露營燈',
    category: 'night',
    status: 'online',
    power: false,
    devices: ['LED 露營燈串'],
    controlType: '夜間自動控制',
    nextAction: '夜間 20:00 開啟',
  },
  {
    id: 11,
    name: '環境氣氛燈－地燈',
    category: 'night',
    status: 'online',
    power: false,
    devices: ['LED 地燈組'],
    controlType: '夜間自動控制',
    nextAction: '夜間 20:00 開啟',
  },
  {
    id: 12,
    name: '大門監控與門鎖供電',
    category: '24h',
    status: 'online',
    power: true,
    devices: ['門鎖電源', '監控攝影機'],
    controlType: '24 小時供電',
    nextAction: '持續供電',
  },
  {
    id: 13,
    name: 'Pro Shop 冷氣供電',
    category: '24h',
    status: 'online',
    power: true,
    devices: ['冷氣主機'],
    controlType: '24 小時供電',
    nextAction: '持續供電',
  },
  {
    id: 14,
    name: '辦公室弱電箱專用插座',
    category: '24h',
    status: 'online',
    power: true,
    devices: ['弱電設備'],
    controlType: '24 小時供電',
    nextAction: '持續供電',
  },
  {
    id: 15,
    name: '辦公室電器',
    category: '24h',
    status: 'online',
    power: true,
    devices: ['電腦', '印表機', '電話'],
    controlType: '24 小時供電',
    nextAction: '持續供電',
  },
  {
    id: 16,
    name: '販賣機專用插座',
    category: '24h',
    status: 'online',
    power: true,
    devices: ['飲料販賣機'],
    controlType: '24 小時供電',
    nextAction: '持續供電',
  },
  {
    id: 17,
    name: '預留迴路 1',
    category: 'reserved',
    status: 'unknown',
    power: false,
    devices: [],
    controlType: '待配置',
    nextAction: '未使用',
  },
  {
    id: 18,
    name: '預留迴路 2',
    category: 'reserved',
    status: 'unknown',
    power: false,
    devices: [],
    controlType: '待配置',
    nextAction: '未使用',
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
  dynamic: 'blue',
  business: 'orange',
  night: 'indigo',
  '24h': 'emerald',
  reserved: 'gray',
}

const STATUS_LABEL = {
  online: '在線',
  offline: '離線',
  unknown: '未知',
}

const STATUS_COLOR = {
  online: 'emerald',
  offline: 'red',
  unknown: 'amber',
}

export function ElectricalCircuitsList() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categories = Object.keys(CATEGORY_LABEL)
  const filteredCircuits = selectedCategory ? CIRCUITS.filter((c) => c.category === selectedCategory) : CIRCUITS

  return (
    <div className="space-y-4">
      {/* 分類過濾 */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            selectedCategory === null
              ? 'bg-brand-600 text-white'
              : 'border border-zinc-200 bg-white hover:bg-zinc-50'
          }`}
        >
          全部迴路
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              selectedCategory === cat
                ? `bg-${CATEGORY_COLOR[cat as keyof typeof CATEGORY_COLOR]}-600 text-white`
                : `border border-${CATEGORY_COLOR[cat as keyof typeof CATEGORY_COLOR]}-200 bg-${CATEGORY_COLOR[cat as keyof typeof CATEGORY_COLOR]}-50 hover:bg-${CATEGORY_COLOR[cat as keyof typeof CATEGORY_COLOR]}-100`
            }`}
          >
            {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}
          </button>
        ))}
      </div>

      {/* 迴路列表 */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {filteredCircuits.map((circuit) => (
          <div
            key={circuit.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-md transition-all"
          >
            {/* 迴路頭 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">迴路 {circuit.id}</p>
                <p className="text-xs text-muted mt-0.5">{circuit.name}</p>
              </div>
              <div className="flex gap-1">
                {circuit.power && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                    <Power className="w-2.5 h-2.5 mr-1" />
                    供電中
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                    circuit.status === 'online'
                      ? 'bg-emerald-100 text-emerald-700'
                      : circuit.status === 'offline'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Wifi className="w-2.5 h-2.5 mr-1" />
                  {STATUS_LABEL[circuit.status as keyof typeof STATUS_LABEL]}
                </span>
              </div>
            </div>

            {/* 設備清單 */}
            {circuit.devices.length > 0 && (
              <div className="mb-3 py-3 border-t border-b border-zinc-100">
                <p className="text-[11px] font-semibold text-muted mb-2">設備</p>
                <ul className="space-y-1">
                  {circuit.devices.map((device, idx) => (
                    <li key={idx} className="text-xs text-zinc-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></span>
                      {device}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 控制模式和下一步動作 */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-muted">控制方式：</span>
                <span className="font-semibold text-zinc-900">{circuit.controlType}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-muted">下一步動作：</span>
                <span className="font-semibold text-zinc-900">{circuit.nextAction}</span>
              </div>
            </div>

            {/* 操作按鈕 */}
            {circuit.status !== 'unknown' && circuit.devices.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-100 flex gap-2">
                <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">
                  詳情
                </button>
                <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-700 transition-colors">
                  控制
                </button>
              </div>
            )}

            {/* 未連接警示 */}
            {circuit.status === 'offline' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>設備離線，無法控制</span>
              </div>
            )}

            {circuit.status === 'unknown' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] text-amber-700">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>設備未連接，待配置</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 統計信息 */}
      <div className="mt-6 rounded-2xl border border-zinc-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
        <h3 className="text-sm font-semibold mb-3 text-zinc-900">迴路統計</h3>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
          {categories.map((cat) => {
            const catCircuits = CIRCUITS.filter((c) => c.category === cat)
            const onlineCount = catCircuits.filter((c) => c.status === 'online').length
            return (
              <div key={cat} className="text-center">
                <p className="text-xs text-muted">{CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}</p>
                <p className="mt-1 text-lg font-bold text-zinc-900">{catCircuits.length}</p>
                <p className="text-[10px] text-emerald-700">
                  {onlineCount} 在線
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
