'use client'

import { CIRCUIT_PLACEMENTS, LOCATION_MARKERS, PLAN_HEIGHT, PLAN_WIDTH, UTILITY_POLE, VENUE_ZONES } from '@/lib/venue-layout'

const colors: Record<string, string> = { booking: '#2563eb', business: '#16a34a', night: '#f97316', power: '#7c3aed' }
function typeOf(circuit: string) { const n = Number(circuit); return n <= 4 ? 'booking' : n <= 9 ? 'business' : n <= 11 ? 'night' : 'power' }

export function VenueLayoutMap() {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm sm:p-4">
        <div className="overflow-x-auto rounded-xl bg-white [touch-action:pan-x_pinch-zoom]">
          <svg viewBox="0 0 136 72" role="img" aria-label="場館設備配置圖" className="block h-auto min-w-[680px] w-full select-none sm:min-w-0">
            <rect width="136" height="72" fill="#fff" />
            <rect x="2" y="2" width="132" height="66" rx="2" fill="#fafafa" stroke="#e5e7eb" strokeWidth=".35" />
            {VENUE_ZONES.map((z) => (
              <g key={z.id}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={z.tone === 'court' ? '#3f9b4b' : z.tone === 'deck' ? '#f7deb0' : z.tone === 'room' ? '#fffaf3' : '#fff'} stroke={z.tone === 'court' ? '#167534' : '#cdb58a'} strokeWidth=".3" />
                {z.tone === 'court' && <><rect x={z.x + 9} y={z.y + 3} width={z.w - 18} height={z.h - 6} fill="#2454d6" stroke="#fff" strokeWidth=".35" /><path d={`M${z.x + 9} ${z.y + z.h / 2}h${z.w - 18}M${z.x + z.w / 2} ${z.y + 3}v${z.h - 6}`} stroke="#fff" strokeWidth=".25" /><rect x={z.x + z.w / 2 - 5} y={z.y + z.h / 2 - 2} width="10" height="4" rx="1" fill="#fff" opacity=".9" /><text x={z.x + z.w / 2} y={z.y + z.h / 2 + 1.2} textAnchor="middle" fontSize="2.2" fontWeight="700" fill="#21448e">{z.name}</text></>}
                {z.tone !== 'court' && <text x={z.x + 1.2} y={z.y + 3.2} fontSize="2.6" fontWeight="700" fill="#4b5563">{z.name}</text>}
              </g>
            ))}
            <line x1={UTILITY_POLE.x} y1={UTILITY_POLE.y1} x2={UTILITY_POLE.x} y2={UTILITY_POLE.y2} stroke="#9a6738" strokeWidth=".8" />
            <text x="120" y="30" fontSize="2.1" fill="#6b7280">電線桿</text>
            {LOCATION_MARKERS.map((m) => <g key={m.id}><circle cx={m.x} cy={m.y} r="2.2" fill="#fff" stroke="#9ca3af" strokeWidth=".35" strokeDasharray=".7 .5" /><text x={m.x} y={m.y + .7} textAnchor="middle" fontSize="2.2" fill="#6b7280">⌖</text></g>)}
            {CIRCUIT_PLACEMENTS.map((p, i) => { const color = colors[typeOf(p.circuit)]; return <g key={`${p.circuit}-${i}`}><circle cx={p.x} cy={p.y} r="2.2" fill="#fff" stroke={color} strokeWidth=".55" /><circle cx={p.x} cy={p.y} r="1.15" fill={color} opacity=".18" /><text x={p.x + 2.5} y={p.y + .8} fontSize="2.3" fontWeight="700" fill="#374151">{p.circuit}</text></g> })}
          </svg>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 sm:grid-cols-5">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />預約動態控制（01–04）</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600" />營業時間控制（05–09）</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" />環境夜間控制（10–11）</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-violet-600" />24 小時供電（12–16）</span>
        <span>⌖ 位置標記（不可控）</span>
      </div>
    </section>
  )
}
