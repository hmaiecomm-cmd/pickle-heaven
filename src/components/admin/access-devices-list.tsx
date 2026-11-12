'use client'

import { AlertCircle, Lock, Wifi } from 'lucide-react'

const DEVICES = [
  {
    id: 'door-main',
    name: '大門電子門鎖',
    location: '出入口',
    type: 'electronic-lock',
    status: 'online',
    lastSync: '2026-11-12 14:32:15',
    capacity: '無限制',
    currentActive: 12,
  },
  {
    id: 'door-court-a',
    name: '球場 A 門禁',
    location: '球場 A',
    type: 'rfid-reader',
    status: 'online',
    lastSync: '2026-11-12 14:30:00',
    capacity: '無限制',
    currentActive: 8,
  },
  {
    id: 'door-court-b',
    name: '球場 B 門禁',
    location: '球場 B',
    type: 'rfid-reader',
    status: 'online',
    lastSync: '2026-11-12 14:29:45',
    capacity: '無限制',
    currentActive: 6,
  },
  {
    id: 'door-shop',
    name: 'Pro Shop 門禁',
    location: 'Pro Shop',
    type: 'card-reader',
    status: 'offline',
    lastSync: '2026-11-11 18:15:22',
    capacity: '無限制',
    currentActive: 0,
  },
  {
    id: 'door-rest',
    name: '休息區門禁',
    location: '休息區',
    type: 'rfid-reader',
    status: 'unknown',
    lastSync: null,
    capacity: '無限制',
    currentActive: 0,
  },
]

const TYPE_LABEL = {
  'electronic-lock': '電子門鎖',
  'rfid-reader': 'RFID 讀卡機',
  'card-reader': '門禁卡讀卡機',
  'fingerprint': '指紋辨識',
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

export function AccessDevicesList() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
        {DEVICES.map((device) => (
          <div
            key={device.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-md transition-all"
          >
            {/* 設備頭 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{device.name}</p>
                <p className="text-xs text-muted mt-0.5">{device.location}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                  device.status === 'online'
                    ? 'bg-emerald-100 text-emerald-700'
                    : device.status === 'offline'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Wifi className="w-2.5 h-2.5 mr-1" />
                {STATUS_LABEL[device.status as keyof typeof STATUS_LABEL]}
              </span>
            </div>

            {/* 設備資訊 */}
            <div className="py-3 border-t border-b border-zinc-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">設備類型：</span>
                <span className="font-semibold text-zinc-900">
                  {TYPE_LABEL[device.type as keyof typeof TYPE_LABEL]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">當前授權：</span>
                <span className="font-semibold text-zinc-900">{device.currentActive} 人</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">最後同步：</span>
                <span className="font-semibold text-zinc-900">
                  {device.lastSync ? device.lastSync.split(' ')[1] : '未同步'}
                </span>
              </div>
            </div>

            {/* 操作按鈕 */}
            <div className="mt-3 flex gap-2">
              <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors">
                詳情
              </button>
              <button className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors">
                測試
              </button>
            </div>

            {/* 離線警示 */}
            {device.status === 'offline' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>設備離線，無法授權</span>
              </div>
            )}

            {device.status === 'unknown' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] text-amber-700">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>設備未連接，待配置</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 統計 */}
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3 text-zinc-900">設備統計</h3>
        <div className="grid gap-4 grid-cols-3">
          <div className="text-center">
            <p className="text-xs text-muted">在線設備</p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {DEVICES.filter((d) => d.status === 'online').length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">離線設備</p>
            <p className="mt-1 text-lg font-bold text-red-700">
              {DEVICES.filter((d) => d.status === 'offline').length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">總授權人數</p>
            <p className="mt-1 text-lg font-bold text-zinc-900">
              {DEVICES.reduce((sum, d) => sum + d.currentActive, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
