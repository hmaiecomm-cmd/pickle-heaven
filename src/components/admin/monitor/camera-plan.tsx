'use client'

import * as React from 'react'
import { PLAN_HEIGHT, PLAN_WIDTH } from '@/lib/venue-layout'
import { conePath } from '@/lib/camera-layout'
import { VenuePlanBase } from '../venue-plan-base'

type Marker = { id: string; name: string; x: number; y: number; facing: number; enabled: boolean }

/**
 * 攝影機位置平面圖。點標記 → onSelect；提供 onPlace 時，點平面圖空白處可把選取的攝影機移到該位置。
 */
export function CameraPlan({
  cameras,
  selectedId,
  onSelect,
  onPlace,
  label = '攝影機位置平面圖',
}: {
  cameras: Marker[]
  selectedId: string
  onSelect: (id: string) => void
  onPlace?: (x: number, y: number) => void
  label?: string
}) {
  const ref = React.useRef<SVGSVGElement>(null)

  const place = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPlace || !ref.current) return
    const pt = ref.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = ref.current.getScreenCTM()
    if (!m) return
    const p = pt.matrixTransform(m.inverse())
    onPlace(Math.round(Math.min(PLAN_WIDTH - 2, Math.max(2, p.x)) * 2) / 2, Math.round(Math.min(PLAN_HEIGHT - 2, Math.max(2, p.y)) * 2) / 2)
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${PLAN_WIDTH} ${PLAN_HEIGHT}`}
      className={`h-auto w-full select-none ${onPlace ? 'cursor-crosshair' : ''}`}
      role="group"
      aria-label={label}
      onClick={place}
    >
      <VenuePlanBase />
      {cameras.map((c) => {
        const isSel = c.id === selectedId
        const select = (e: React.SyntheticEvent) => {
          e.stopPropagation()
          onSelect(c.id)
        }
        return (
          <g
            key={c.id}
            role="button"
            tabIndex={0}
            aria-label={`Camera ${c.id} ${c.name}`}
            aria-pressed={isSel}
            data-camera={c.id}
            onClick={select}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), select(e))}
            className="cursor-pointer outline-none"
            opacity={c.enabled ? 1 : 0.45}
          >
            <path d={conePath(c)} fill={isSel ? '#16a34a' : '#71717a'} opacity={isSel ? 0.3 : 0.12} />
            {isSel && <circle cx={c.x} cy={c.y} r="4.8" fill="#16a34a" opacity="0.22" />}
            <circle cx={c.x} cy={c.y} r="3.2" fill={isSel ? '#2f7d3b' : 'white'} stroke={isSel ? '#14532d' : '#52525b'} strokeWidth={isSel ? 0.6 : 0.4} />
            <text x={c.x} y={c.y + 0.95} fontSize="2.5" fontWeight={800} fill={isSel ? 'white' : '#27272a'} textAnchor="middle">
              {c.id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
