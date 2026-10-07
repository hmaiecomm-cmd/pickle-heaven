'use client'

import * as React from 'react'

/**
 * 進場動畫：子孫元素加上 .hp-reveal 即可。
 * 載入當下已在畫面內的元素直接顯示，不會先消失再淡入；沒有 JS 時全部正常顯示。
 * 偏好減少動態的使用者由 CSS 直接關閉動畫。
 */
export function RevealRoot({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const root = ref.current
    if (!root || !('IntersectionObserver' in window)) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('.hp-reveal'))
    const vh = window.innerHeight
    for (const el of items) if (el.getBoundingClientRect().top < vh) el.classList.add('is-in')
    root.classList.add('hp-js')

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    for (const el of items) if (!el.classList.contains('is-in')) io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
