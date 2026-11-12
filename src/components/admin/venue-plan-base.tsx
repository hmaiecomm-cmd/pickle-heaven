import { BUILDING, PLAN_HEIGHT, PLAN_WIDTH, UTILITY_POLE, VENUE_ZONES } from '@/lib/venue-layout'

/**
 * 球館平面圖底圖（區域、建築、樹、電線桿），座標為 venue-layout 的 viewBox。
 * 放在 <svg> 內使用；設備配置圖與即時監控共用，標記由各頁自行疊加。
 */

const ZONE_STYLE: Record<string, { fill: string; stroke: string; text: string }> = {
  court: { fill: '#1d4ed8', stroke: '#15803d', text: '#ffffff' },
  room: { fill: '#fffaf3', stroke: '#d6c3a5', text: '#57534e' },
  service: { fill: '#f5f5f4', stroke: '#d6c3a5', text: '#57534e' },
  deck: { fill: '#f6deb2', stroke: '#e3c48a', text: '#78350f' },
  outdoor: { fill: '#ffffff', stroke: '#d4d4d8', text: '#52525b' },
}

function Tree({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="1.6" fill="#86c46d" stroke="#5c9e45" strokeWidth="0.25" />
}

export function VenuePlanBase() {
  return (
    <g aria-hidden>
      <rect x="0.4" y="0.4" width={PLAN_WIDTH - 0.8} height={PLAN_HEIGHT - 0.8} rx="1.5" fill="#fbfbfa" stroke="#e4e4e7" strokeWidth="0.3" />

      {[3, 9, 15, 21, 27, 46, 52, 58, 64].map((y) => (
        <Tree key={`l${y}`} x={3} y={y} />
      ))}
      {[78, 86, 94, 102, 110, 118].map((x) => (
        <Tree key={`t${x}`} x={x} y={3} />
      ))}

      <rect x={BUILDING.x} y={BUILDING.y} width={BUILDING.w} height={BUILDING.h} rx="0.6" fill="#fffaf3" stroke="#b08d57" strokeWidth="0.5" />

      {VENUE_ZONES.map((z) => {
        const s = ZONE_STYLE[z.tone]
        if (z.tone === 'court') {
          return (
            <g key={z.id}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="#3f9b47" stroke={s.stroke} strokeWidth="0.3" />
              <rect x={z.x + z.w * 0.18} y={z.y + 3} width={z.w * 0.64} height={z.h - 6} fill={s.fill} stroke="white" strokeWidth="0.35" />
              <line x1={z.x + z.w / 2} y1={z.y + 3} x2={z.x + z.w / 2} y2={z.y + z.h - 3} stroke="white" strokeWidth="0.3" />
              <line x1={z.x + z.w * 0.18} y1={z.y + z.h / 2} x2={z.x + z.w * 0.82} y2={z.y + z.h / 2} stroke="white" strokeWidth="0.3" />
              <rect x={z.x + z.w / 2 - 6} y={z.y + z.h / 2 - 2.2} width="12" height="4.4" rx="1" fill="white" opacity="0.92" />
              <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 0.8} fontSize="2.2" fontWeight={700} fill="#1e3a8a" textAnchor="middle">
                {z.name}
              </text>
            </g>
          )
        }
        if (z.id === 'parking') {
          return (
            <g key={z.id}>
              {[0, 1, 2].map((i) => (
                <rect key={i} x={z.x + i * 5} y={z.y} width="5" height={z.h} fill="white" stroke="#a1a1aa" strokeWidth="0.25" />
              ))}
              <text x={z.x + z.w / 2} y={z.y + z.h + 1.6} fontSize="1.6" fill="#71717a" textAnchor="middle">
                {z.name}
              </text>
            </g>
          )
        }
        if (z.id === 'deck') {
          return (
            <g key={z.id}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={s.fill} stroke={s.stroke} strokeWidth="0.3" />
              <rect x={z.x + z.w / 2 - 8} y={z.y + z.h - 3.6} width="16" height="3" rx="1.5" fill="white" stroke="#f87171" strokeWidth="0.25" />
              <text x={z.x + z.w / 2} y={z.y + z.h - 1.5} fontSize="1.8" fontWeight={700} fill={s.text} textAnchor="middle">
                {z.name}
              </text>
            </g>
          )
        }
        return (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} fill={s.fill} stroke={s.stroke} strokeWidth="0.3" />
            <text x={z.x + 1} y={z.y + 2.6} fontSize="1.8" fontWeight={600} fill={s.text}>
              {z.name}
            </text>
          </g>
        )
      })}

      <line x1={UTILITY_POLE.x} y1={UTILITY_POLE.y1} x2={UTILITY_POLE.x} y2={UTILITY_POLE.y2} stroke="#8b5e34" strokeWidth="0.8" />
      <text x={UTILITY_POLE.x + 1.2} y={UTILITY_POLE.y1 + 3.5} fontSize="1.6" fill="#57534e">
        電線桿
      </text>
    </g>
  )
}
