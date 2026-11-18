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
  /** 導航分組（用於視覺分組） */
  group?: string
}

export type AdminNavIcon = 'home' | 'courts' | 'monitor' | 'devices' | 'access' | 'orders' | 'members' | 'reports' | 'settings'

export interface AdminNavGroup {
  key: string
  label: string
  icon: AdminNavIcon
  /** 沒有子項目時直接連結 */
  href?: string
  permission?: Permission
  items?: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { key: 'home', label: '首頁', icon: 'home', href: '/admin', permission: 'dashboard' },
  {
    key: 'courts',
    label: '場地與預約',
    icon: 'courts',
    items: [
      { label: '智慧排程', href: '/admin/schedule', permission: 'courts' },
      { label: '場地設定', href: '/admin/courts', permission: 'courts' },
      { label: '維護與封場', href: '/admin/maintenance', permission: 'courts' },
    ],
  },
  {
    key: 'monitor',
    label: '即時監控',
    icon: 'monitor',
    items: [
      { label: '即時影像', href: '/admin/monitor', permission: 'monitor' },
      { label: '歷史回放', href: '/admin/monitor?tab=playback', permission: 'camera.playback' },
      { label: '事件紀錄', href: '/admin/monitor?tab=events', permission: 'monitor' },
      { label: '攝影機管理', href: '/admin/monitor?tab=cameras', permission: 'camera.manage' },
    ],
  },
  {
    key: 'devices',
    label: '智慧設備管理（不含門禁）',
    icon: 'devices',
    items: [
      { label: '設備總覽與智慧排程', href: '/admin/devices', permission: 'device' },
      { label: '手動控制中心', href: '/admin/control', permission: 'device' },
    ],
  },
  {
    key: 'access',
    label: '門禁權限管理',
    icon: 'access',
    items: [{ label: '門禁設備與授權', href: '/admin/access', permission: 'access' }],
  },
  {
    key: 'orders',
    label: '訂單記錄',
    icon: 'orders',
    items: [
      { label: '訂場訂單', href: '/admin/bookings?tab=venue', permission: 'bookings' },
      { label: '活動訂單', href: '/admin/bookings?tab=activity', permission: 'bookings' },
      { label: '商品訂單', href: '/admin/bookings?tab=products', permission: 'marketing', notOpen: true },
      { label: '點數與票券', href: '/admin/bookings?tab=points', permission: 'members' },
    ],
  },
  {
    key: 'members',
    label: '會員與教練',
    icon: 'members',
    items: [
      { label: '會員管理', href: '/admin/members', permission: 'members' },
      { label: '教練', href: '/admin/members?tab=coaches', permission: 'members' },
      { label: '黑名單', href: '/admin/members?tab=blacklist', permission: 'members' },
    ],
  },
  {
    key: 'reports',
    label: '營運與行銷',
    icon: 'reports',
    items: [
      { label: '營運總覽', href: '/admin/reports', permission: 'finance', exact: true },
      { label: '財務報表', href: '/admin/finance', permission: 'finance', exact: true },
      { label: '活動與行銷設計', href: '/admin/marketing', permission: 'activities' },
      { label: '商品與商城', href: '/admin/marketing/products', permission: 'marketing', notOpen: true },
      { label: '價格與會員方案', href: '/admin/pricing', permission: 'settings' },
    ],
  },
  {
    key: 'settings',
    label: '系統設定',
    icon: 'settings',
    items: [
      { label: '球館基本資料', href: '/admin/settings', permission: 'settings', exact: true, group: '場館與品牌設定' },
      { label: '官網頁面管理', href: '/admin/settings/site', permission: 'settings', notOpen: true, group: '場館與品牌設定' },
      { label: '後台帳號與權限', href: '/admin/settings/staff', permission: 'staff', group: '主管與權限設定' },
      { label: '操作紀錄', href: '/admin/audit', permission: 'audit', group: '主管與權限設定' },
      { label: '儲值方案', href: '/admin/settings/topup', permission: 'settings', group: '通知與串接設定' },
      { label: '金流與發票設定', href: '/admin/settings/payments', permission: 'settings', group: '通知與串接設定' },
      { label: '設備串接', href: '/admin/settings/devices', permission: 'settings', group: '通知與串接設定' },
      { label: '定價與會員折扣', href: '/admin/pricing', permission: 'settings', group: '價格與會員方案' },
    ],
  },
]

/** 相關但不在側欄的頁面，歸屬到哪個選單項目（用來標示選中） */
export const ALIAS_PATHS: Record<string, string> = {
  '/admin/receipts': '/admin/expenses',
  '/admin/ai-courts': '/admin/control',
  '/admin/ai-assistant': '/admin',
  '/admin/templates': '/admin/activities',
  '/admin/incidents': '/admin/monitor?tab=events',
  '/admin/automation': '/admin/devices', // V8.1 排程功能暫時整合到設備總覽
  // 訂單記錄標籤式導航別名
  '/admin/finance/payments': '/admin/finance?tab=payments',
  '/admin/refunds': '/admin/finance?tab=refunds',
  '/admin/topup': '/admin/finance?tab=topup',
  '/admin/members/points': '/admin/finance?tab=points',
  '/admin/invoices': '/admin/finance?tab=invoices',
  '/admin/expenses': '/admin/finance?tab=expenses',
  '/admin/finance/daily': '/admin/finance?tab=daily',
  '/admin/bookings/products': '/admin/finance?tab=products',
  // 會員與教練導航別名
  '/admin/members/history': '/admin/members',
  // 舊活動相關頁面重定向到會員管理
  '/admin/activities': '/admin/members',
  '/admin/sessions': '/admin/members',
  '/admin/registrations': '/admin/members',
  '/admin/events': '/admin/members',
  '/admin/marketing/vouchers': '/admin/members',
  '/admin/marketing/products': '/admin/members',
  '/admin/marketing/campaigns': '/admin/members',
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
    const hrefs = g.href ? [g.href] : (g.items ?? []).map((i) => i.href)
    for (const h of hrefs) {
      const [hPath, hQuery] = h.split('?')
      const pathMatch = hPath === '/admin' ? path === hPath : path === hPath || path.startsWith(hPath + '/')
      const queryMatch = [...new URLSearchParams(hQuery ?? '')].every(([k, v]) => params.get(k) === v)
      if (pathMatch && queryMatch && (!best || h.length > best.length)) best = h
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
