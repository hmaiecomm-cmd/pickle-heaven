'use client'

import { useState } from 'react'
import { AlertCircle, Play } from 'lucide-react'

const CAMERAS = [
  { id: 1, name: '出入口', position: 'top-left' },
  { id: 2, name: '門內監看', position: 'top-center' },
  { id: 3, name: '休息區', position: 'top-right' },
  { id: 4, name: '球場 A', position: 'bottom-left' },
  { id: 5, name: 'Pro Shop', position: 'bottom-center' },
  { id: 6, name: '球場 B', position: 'bottom-right' },
]

export function CameraMonitor() {
  const [selectedCamera, setSelectedCamera] = useState(1)

  const generateDemoImage = (cameraId: number) => {
    // 生成簡單的 SVG demo 圖像
    const colors = ['#2ecc71', '#3498db', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c']
    return `data:image/svg+xml,%3Csvg width='100%25' height='100%25' viewBox='0 0 800 600' xmlns='http://www.w3.org/2000/svg'%3E%3Crect fill='%23${colors[cameraId - 1].replace('#', '')}' width='800' height='600'/%3E%3Ctext x='400' y='300' font-size='48' fill='white' text-anchor='middle' dominant-baseline='middle'%3ECamera ${cameraId}%3C/text%3E%3Ctext x='400' y='360' font-size='32' fill='white' text-anchor='middle'%3E${CAMERAS[cameraId - 1].name}%3C/text%3E%3Crect x='50' y='50' width='700' height='500' fill='none' stroke='white' stroke-width='3'/%3E%3C/svg%3E`
  }

  return (
    <div className="space-y-4">
      {/* 主監控畫面 */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-900 aspect-video">
        <img
          src={generateDemoImage(selectedCamera)}
          alt={`Camera ${selectedCamera} - ${CAMERAS[selectedCamera - 1].name}`}
          className="w-full h-full object-cover"
        />
        {/* Live indicator */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          LIVE
        </div>
        {/* Camera name */}
        <div className="absolute bottom-4 left-4 bg-black/60 text-white px-4 py-2 rounded-lg">
          <p className="text-sm font-semibold">{CAMERAS[selectedCamera - 1].name}</p>
        </div>
      </div>

      {/* 平面圖與攝影機縮圖 */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* 球館平面圖 */}
        <div className="lg:col-span-1 rounded-2xl border border-zinc-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-zinc-600 mb-3">球館平面圖</h3>
          <div className="relative w-full aspect-square bg-zinc-50 rounded-lg border border-zinc-200 overflow-hidden">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* 球館邊界 */}
              <rect x="10" y="10" width="180" height="180" fill="none" stroke="#e5e7eb" strokeWidth="2" />

              {/* 球場區域 */}
              <rect x="30" y="30" width="140" height="140" fill="#f0fdf4" stroke="#86efac" strokeWidth="1" />

              {/* 攝影機位置標記 */}
              {CAMERAS.map((cam) => {
                let x = 100,
                  y = 100
                if (cam.position === 'top-left') {
                  x = 40
                  y = 30
                } else if (cam.position === 'top-center') {
                  x = 100
                  y = 20
                } else if (cam.position === 'top-right') {
                  x = 160
                  y = 30
                } else if (cam.position === 'bottom-left') {
                  x = 40
                  y = 170
                } else if (cam.position === 'bottom-center') {
                  x = 100
                  y = 180
                } else if (cam.position === 'bottom-right') {
                  x = 160
                  y = 170
                }

                return (
                  <g
                    key={cam.id}
                    onClick={() => setSelectedCamera(cam.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={selectedCamera === cam.id ? 8 : 6}
                      fill={selectedCamera === cam.id ? '#10b981' : '#d1d5db'}
                      stroke={selectedCamera === cam.id ? '#059669' : 'none'}
                      strokeWidth="2"
                    />
                    <text x={x} y={y + 12} fontSize="8" textAnchor="middle" fill="#6b7280">
                      {cam.id}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        {/* 六路攝影機縮圖 */}
        <div className="lg:col-span-3 space-y-3">
          <h3 className="text-xs font-semibold text-zinc-600">攝影機清單</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CAMERAS.map((cam) => (
              <button
                key={cam.id}
                onClick={() => setSelectedCamera(cam.id)}
                className={`group relative overflow-hidden rounded-lg border-2 transition-all ${
                  selectedCamera === cam.id
                    ? 'border-emerald-500 ring-2 ring-emerald-200'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="relative aspect-video bg-zinc-900">
                  <img
                    src={generateDemoImage(cam.id)}
                    alt={cam.name}
                    className="w-full h-full object-cover"
                  />
                  {/* 狀態指示器 */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    {selectedCamera === cam.id ? (
                      <Play className="h-4 w-4 text-white drop-shadow" fill="white" />
                    ) : (
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    )}
                  </div>
                </div>
                <p className="px-2 py-1 text-[11px] font-semibold text-zinc-700 text-center">{cam.name}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 異常警示 */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold mb-3">最近事件</h3>
        <div className="flex items-center gap-2 text-sm text-emerald-800 py-2">
          <div className="w-2 h-2 bg-emerald-600 rounded-full"></div>
          所有攝影機運作正常
        </div>
      </div>
    </div>
  )
}
