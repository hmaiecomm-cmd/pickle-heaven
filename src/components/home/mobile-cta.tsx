'use client'

import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * 手機版底部「預約場地」列。
 * 離開首屏後才出現；捲到底部預約邀請或頁尾時收起，避免蓋住內容與頁尾連結。
 */
export function MobileBookingBar() {
  const [heroGone, setHeroGone] = React.useState(false)
  const [nearEnd, setNearEnd] = React.useState(false)

  React.useEffect(() => {
    const hero = document.getElementById('top')
    const ends = ['invite', 'site-footer']
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (!hero || !('IntersectionObserver' in window)) return
    const visibleEnds = new Set<Element>()

    const heroIo = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting))
    const endIo = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visibleEnds.add(e.target)
        else visibleEnds.delete(e.target)
      }
      setNearEnd(visibleEnds.size > 0)
    })
    heroIo.observe(hero)
    ends.forEach((el) => endIo.observe(el))
    return () => {
      heroIo.disconnect()
      endIo.disconnect()
    }
  }, [])

  const show = heroGone && !nearEnd

  return (
    <div
      className={cn(
        'hp-mobile-cta fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:hidden',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0',
      )}
      aria-hidden={!show}
    >
      <Link
        href="/booking"
        tabIndex={show ? 0 : -1}
        className="hp-btn hp-btn-primary w-full shadow-[0_14px_30px_-12px_rgb(40_19_67/.8)]"
      >
        預約場地
      </Link>
    </div>
  )
}
