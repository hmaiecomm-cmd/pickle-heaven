import type { Permission } from '@/lib/admin-permissions'

/**
 * 後台側欄。每個既有功能只出現一次；尚未建置的項目標示 notOpen，點進去是說明頁，不是假功能。
 * permission 只用來隱藏選單，頁面與 API 另外在後端檢查。
 */

export interface AdminNavItem {
  label: string
  href: string
  permission: Permission
  /** 只在路徑完全相同時視為選中 */
  exact?: boolean
  /** 未開放／未串接 */
  notOpen?: boolean
  /** 建立中（開發進行中） */
  comingSoon?: boolean
  /** 導航分組（用於視覺分組） */
  group?: string
}

export type AdminNavIcon = 'home' | 'courts' | 'monitor' | 'devices' | 'access' | 'orders' | 'members' | 'reports' | 'settings'

export type AdminNavSection = 'plus' | 'pro' | 'settings'

export interface AdminNavGroup {
  key: string
  label: string
  icon: AdminNavIcon
  /** 沒有子項目時直接連結 */
  href?: string
  permission?: Permission
  /** 只在路徑完全相同時視為選中 */
  exact?: boolean
  /** 副標題（如「智慧營運與成長管理」） */
  subtitle?: string
  /** 頂級分組（PLUS｜基礎營運, PRO｜智慧無人營運, 系統設定） */
  section?: AdminNavSection
  /** 建立中（開發進行中） */
  comingSoon?: boolean
  items?: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { key: 'home', label: '首頁', icon: 'home', href: '/admin', permission: 'dashboard' },

  // 系統設定（放在首頁下方，作為第一個主要導覽區塊）
  {
    key: 'settings',
    label: '系統設定',
    icon: 'settings',
    section: 'settings',
    items: [
      { label: '管理者設定', href: '/admin/settings/staff', permission: 'staff', group: '管理' },
      { label: '球館基本資料', href: '/admin/settings', permission: 'settings', exact: true, group: '設定' },
      { label: '官網頁面管理', href: '/admin/home', permission: 'settings', group: '設定' },
      { label: '後台操作紀錄', href: '/admin/audit', permission: 'audit', group: '紀錄' },
      { label: '金流與發票設定', href: '/admin/settings/payments', permission: 'settings', group: '設定' },
    ],
  },

  {
    key: 'courts',
    label: '場地預約 Plus',
    icon: 'courts',
    section: 'plus',
    items: [
      { label: '預約行事曆', href: '/admin/schedule', permission: 'courts' },
      { label: '場地設定', href: '/admin/courts', permission: 'courts' },
      { label: '維護與封場', href: '/admin/maintenance', permission: 'courts' },
      { label: '訂單紀錄', href: '/admin/bookings', permission: 'bookings' },
    ],
  },
  {
    key: 'finance',
    label: '財務報表 Plus',
    icon: 'reports',
    section: 'plus',
    permission: 'finance',
    items: [
      { label: '實時報表', href: '/admin/finance', permission: 'finance', exact: true },
      { label: '營運報表下載列印', href: '/admin/finance/overview', permission: 'finance' },
    ],
  },
  {
    key: 'members',
    label: '會員與教練 Plus',
    icon: 'members',
    section: 'plus',
    items: [
      { label: '會員管理', href: '/admin/members', permission: 'members' },
      { label: '教練', href: '/admin/members?tab=coaches', permission: 'members' },
      { label: '黑名單', href: '/admin/members?tab=blacklist', permission: 'members' },
    ],
  },

  {
    key: 'operations',
    label: '無人營運管理 Pro',
    icon: 'devices',
    section: 'pro',
    items: [
      { label: '門禁設備與授權', href: '/admin/access', permission: 'access' },
      { label: '設備智慧排程', href: '/admin/devices', permission: 'device' },
      { label: '設備手動控制', href: '/admin/control', permission: 'device' },
      { label: '設備串接（工程測試）', href: '/admin/settings/devices', permission: 'device' },
      { label: '地端 IoT（工程測試）', href: '/admin/engineer_testmode', permission: 'device' },
    ],
  },
  {
    key: 'monitoring',
    label: 'AI 即時監控 Pro',
    icon: 'monitor',
    section: 'pro',
    items: [
      { label: '即時影像與攝影機管理', href: '/admin/monitor', permission: 'monitor' },
      { label: '歷史影像回放', href: '/admin/monitor?tab=playback', permission: 'camera.playback' },
      { label: '設備異常事件', href: '/admin/monitor?tab=events', permission: 'monitor' },
    ],
  },
  {
    key: 'assistant',
    label: 'AI 超級特助 Pro',
    icon: 'reports',
    section: 'pro',
    items: [
      { label: '營收與會員成長洞察', href: '/admin/reports', permission: 'finance', exact: true },
      { label: '會員經營與精準溝通', href: '/admin/reports/members', permission: 'finance' },
      { label: 'AI 行銷活動策劃', href: '/admin/marketing', permission: 'finance' },
      { label: '空場率與收益優化', href: '/admin/reports/utilization', permission: 'finance' },
      { label: '動態定價', href: '/admin/pricing', permission: 'settings' },
    ],
  },
  {
    key: 'ambience',
    label: 'AI 情境營造 Pro',
    icon: 'devices',
    section: 'pro',
    comingSoon: true,
    items: [
      { label: '語音廣播與音樂暖場', href: '/admin/ambience?tab=voice', permission: 'device', comingSoon: true },
      { label: '場景與燈光模式', href: '/admin/ambience?tab=lighting', permission: 'device', comingSoon: true },
      { label: 'LED 智慧訊息看板', href: '/admin/ambience?tab=led', permission: 'device', comingSoon: true },
    ],
  },
]

/** 相關但不在側欄的頁面，歸屬到哪個選單項目（用來標示選中） */
export const ALIAS_PATHS: Record<string, string> = {
  '/admin/receipts': '/admin/finance',
  '/admin/ai-courts': '/admin/control',
  '/admin/ai-assistant': '/admin',
  '/admin/templates': '/admin/marketing',
  '/admin/incidents': '/admin/monitor?tab=events',
  '/admin/automation': '/admin/devices', // 無人營運管理／設備智慧排程
  // 訂單紀錄相關別名 - 全部歸到 /admin/bookings（場地預約下的訂單紀錄）
  '/admin/bookings/products': '/admin/bookings',
  '/admin/product-orders': '/admin/bookings',
  // 財務相關別名 - 全部歸到 /admin/finance
  '/admin/finance/payments': '/admin/finance',
  '/admin/refunds': '/admin/finance',
  '/admin/topup': '/admin/finance',
  '/admin/members/points': '/admin/finance',
  '/admin/invoices': '/admin/finance',
  '/admin/expenses': '/admin/finance',
  '/admin/finance/daily': '/admin/finance',
  // 營運報表相容性：舊 operations-report 路由導向新 finance 實時報表
  '/admin/operations-report': '/admin/finance',
  // 會員與教練導航別名
  '/admin/members/history': '/admin/members',
  // 移除的系統設定頁面重定向到球館基本資料
  '/admin/settings/topup': '/admin/settings',
  // 設備相關頁面歸到無人營運管理
  '/admin/settings/devices': '/admin/devices',
  '/admin/engineer_testmode': '/admin/devices',
  // 舊活動相關頁面重定向到行銷
  '/admin/activities': '/admin/marketing',
  '/admin/sessions': '/admin/marketing',
  '/admin/registrations': '/admin/marketing',
  '/admin/events': '/admin/marketing',
  '/admin/marketing/vouchers': '/admin/marketing',
  '/admin/marketing/products': '/admin/marketing',
  '/admin/marketing/campaigns': '/admin/marketing',
}

/**
 * 目前網址對應的選單項目：取最長的相符者（例如 /admin/members/points 不會同時選中會員列表）。
 * 選單網址帶查詢參數（?tab=）時，目前網址必須有相同的參數才算相符。
 */
export function activeHref(pathname: string, search: string = ''): string | null {
  const alias = Object.entries(ALIAS_PATHS).find(([p]) => pathname === p || pathname.startsWith(p + '/'))?.[1]
  const [path, aliasQuery] = (alias ?? pathname).split('?')
  const params = new URLSearchParams(aliasQuery ?? search)
  let best: string | null = null
  for (const g of ADMIN_NAV) {
    // 檢查分組本身的 href（如財務報表）
    if (g.href) {
      const [hPath, hQuery] = g.href.split('?')
      const pathMatch = g.exact ? path === hPath : (hPath === '/admin' ? path === hPath : path === hPath || path.startsWith(hPath + '/'))
      const queryMatch = [...new URLSearchParams(hQuery ?? '')].every(([k, v]) => params.get(k) === v)
      if (pathMatch && queryMatch && (!best || g.href.length > best.length)) best = g.href
    }
    // 檢查子項目
    for (const i of g.items ?? []) {
      const [hPath, hQuery] = i.href.split('?')
      const pathMatch = i.exact ? path === hPath : (hPath === '/admin' ? path === hPath : path === hPath || path.startsWith(hPath + '/'))
      const queryMatch = [...new URLSearchParams(hQuery ?? '')].every(([k, v]) => params.get(k) === v)
      if (pathMatch && queryMatch && (!best || i.href.length > best.length)) best = i.href
    }
  }
  return best
}

/** 目前路徑對應的功能名稱（AI 對話的頁面脈絡用） */
export function sectionLabel(pathname: string): string {
  if (pathname === '/admin') return '首頁'
  const href = activeHref(pathname)
  for (const g of ADMIN_NAV) {
    if (g.href && g.href === href) return g.label
    const item = g.items?.find((i) => i.href === href)
    if (item) return `${g.label}／${item.label}`
  }
  return '後台'
}
