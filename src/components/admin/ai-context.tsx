'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { sectionLabel } from '@/app/admin/admin-nav'

/**
 * AI 助理的頁面脈絡。
 * 只傳送使用者看得到、且有權限的資訊：目前場館、所在功能、篩選條件、使用者主動選取的訂單或活動。
 * 場館或資料範圍（正式／展示）改變時清空選取，避免沿用上一筆。
 */

export interface AiSelection {
  type: 'booking' | 'session' | 'activity' | 'member'
  id: string
  label: string
}

export interface AiPageContext {
  path: string
  section: string
  venueId: string
  venueName: string
  tenant: 'main' | 'demo'
  selection: AiSelection | null
  filters: string | null
}

interface Ctx {
  open: boolean
  setOpen: (v: boolean) => void
  context: AiPageContext
  setSelection: (s: AiSelection | null) => void
  setFilters: (f: string | null) => void
  /** 使用者從對話中移除脈絡標籤 */
  dismissed: { section: boolean; selection: boolean; filters: boolean }
  dismiss: (k: 'section' | 'selection' | 'filters') => void
  /** 預先填入的問題（例如從訂單明細按「問小匹」） */
  pendingPrompt: string | null
  ask: (prompt?: string) => void
  consumePrompt: () => string | null
}

const AiCtx = React.createContext<Ctx | null>(null)

export function useAi() {
  const c = React.useContext(AiCtx)
  if (!c) throw new Error('useAi 必須在 AiProvider 內使用')
  return c
}

/** 頁面登記使用者目前選取的項目；元件卸載時自動清除 */
export function useAiSelection(selection: AiSelection | null) {
  const { setSelection } = useAi()
  const key = selection ? `${selection.type}:${selection.id}:${selection.label}` : ''
  React.useEffect(() => {
    setSelection(selection)
    return () => setSelection(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

export function useAiFilters(filters: string | null) {
  const { setFilters } = useAi()
  React.useEffect(() => {
    setFilters(filters)
    return () => setFilters(null)
  }, [filters, setFilters])
}

export function AiProvider({
  venue,
  tenant,
  children,
}: {
  venue: { id: string; name: string }
  tenant: 'main' | 'demo'
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [selection, setSelectionState] = React.useState<AiSelection | null>(null)
  const [filters, setFiltersState] = React.useState<string | null>(null)
  const [dismissed, setDismissed] = React.useState({ section: false, selection: false, filters: false })
  const [pendingPrompt, setPendingPrompt] = React.useState<string | null>(null)
  // 代問內容只能被取用一次（開發模式下 effect 會重複執行）
  const pendingRef = React.useRef<string | null>(null)

  // 桌機面板寬度給其他固定定位的元件（例如訂單明細）讓位
  React.useEffect(() => {
    const apply = () => document.documentElement.style.setProperty('--ai-panel-w', open && window.matchMedia('(min-width: 768px)').matches ? '380px' : '0px')
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [open])

  // 換頁：功能標籤恢復顯示
  React.useEffect(() => setDismissed((d) => ({ ...d, section: false, filters: false })), [pathname])
  // 換場館或資料範圍：清空選取
  React.useEffect(() => {
    setSelectionState(null)
    setFiltersState(null)
  }, [venue.id, tenant])

  const setSelection = React.useCallback((s: AiSelection | null) => {
    setSelectionState(s)
    setDismissed((d) => ({ ...d, selection: false }))
  }, [])
  const setFilters = React.useCallback((f: string | null) => setFiltersState(f), [])

  const value = React.useMemo<Ctx>(
    () => ({
      open,
      setOpen,
      context: {
        path: pathname,
        section: sectionLabel(pathname),
        venueId: venue.id,
        venueName: venue.name,
        tenant,
        selection,
        filters,
      },
      setSelection,
      setFilters,
      dismissed,
      dismiss: (k) => setDismissed((d) => ({ ...d, [k]: true })),
      pendingPrompt,
      ask: (prompt) => {
        if (prompt) {
          pendingRef.current = prompt
          setPendingPrompt(prompt)
        }
        setOpen(true)
      },
      consumePrompt: () => {
        const p = pendingRef.current
        pendingRef.current = null
        setPendingPrompt(null)
        return p
      },
    }),
    [open, pathname, venue.id, venue.name, tenant, selection, filters, setSelection, setFilters, dismissed, pendingPrompt],
  )
  return <AiCtx.Provider value={value}>{children}</AiCtx.Provider>
}
