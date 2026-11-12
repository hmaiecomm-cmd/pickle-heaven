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
      { label: '預約行事曆', href: '/admin/schedule', permission: 'courts' },
      { label: '場地與時段', href: '/admin/courts', permission: 'courts' },
      { label: '封場與維護', href: '/admin/maintenance?tab=manual', permission: 'courts.manage' },
      { label: '清潔／維護排程', href: '/admin/maintenance', permission: 'courts.manage' },
    ],
  },
  {
    key: 'monitor',
    label: '即時監控',
    icon: 'monitor',
    items: [
      { label: '場地即時監測', href: '/admin/monitor', permission: 'monitor' },
      { label: '異常警示與處理紀錄', href: '/admin/incidents', permission: 'monitor' },
    ],
  },
  {
    key: 'devices',
    label: '智慧設備管理',
    icon: 'devices',
    items: [
      { label: '設備配置與電力迴路', href: '/admin/devices', permission: 'device' },
      { label: '無人化控制', href: '/admin/control', permission: 'monitor' },
      { label: '自動化規則', href: '/admin/automation', permission: 'device.automation', notOpen: true },
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
    label: '訂單與財務',
    icon: 'orders',
    items: [
      { label: '訂場與活動訂單', href: '/admin/bookings', permission: 'bookings', exact: true },
      { label: '收款紀錄', href: '/admin/finance/payments', permission: 'finance' },
      { label: '退款紀錄', href: '/admin/refunds', permission: 'finance' },
      { label: '儲值交易', href: '/admin/topup', permission: 'finance' },
      { label: '點數與票券交易', href: '/admin/members/points', permission: 'members' },
      { label: '發票管理', href: '/admin/invoices', permission: 'invoice' },
      { label: '費用與收據審核', href: '/admin/expenses', permission: 'expenses.own' },
      { label: '日結與對帳', href: '/admin/finance/daily', permission: 'finance' },
      { label: '商品訂單', href: '/admin/bookings/products', permission: 'marketing', notOpen: true },
    ],
  },
  {
    key: 'members',
    label: '會員與活動',
    icon: 'members',
    items: [
      { label: '人員列表', href: '/admin/members', permission: 'members', exact: true },
      { label: '會員預約與消費紀錄', href: '/admin/members/history', permission: 'finance' },
      { label: '黑名單', href: '/admin/members?tab=blacklist', permission: 'members.restrict' },
      { label: '活動列表', href: '/admin/activities', permission: 'activities' },
      { label: '場次與週期安排', href: '/admin/sessions', permission: 'activities.view' },
      { label: '報名與候補／通知名單', href: '/admin/registrations', permission: 'activities.view' },
      { label: '教練', href: '/admin/events', permission: 'activities' },
      { label: '優惠與票券方案', href: '/admin/marketing/vouchers', permission: 'marketing' },
      { label: '商品與庫存', href: '/admin/marketing/products', permission: 'marketing', notOpen: true },
      { label: '行銷活動與通知', href: '/admin/marketing/campaigns', permission: 'marketing', notOpen: true },
    ],
  },
  {
    key: 'reports',
    label: '營運總覽',
    icon: 'reports',
    items: [
      { label: '營運總覽', href: '/admin/reports', permission: 'finance', exact: true },
      { label: '收入與退款分析', href: '/admin/finance', permission: 'finance', exact: true },
      { label: '場地使用率', href: '/admin/reports/utilization', permission: 'reports' },
      { label: '活動參與', href: '/admin/reports/activities', permission: 'reports' },
      { label: '會員分析', href: '/admin/reports/members', permission: 'reports' },
    ],
  },
  {
    key: 'settings',
    label: '系統設定',
    icon: 'settings',
    items: [
      { label: '球館基本資料', href: '/admin/settings', permission: 'settings', exact: true },
      { label: '營業時間與預約規則', href: '/admin/pricing', permission: 'settings' },
      { label: '官網頁面管理', href: '/admin/settings/site', permission: 'settings', notOpen: true },
      { label: '儲值方案', href: '/admin/settings/topup', permission: 'settings' },
      { label: '金流與發票設定', href: '/admin/settings/payments', permission: 'settings' },
      { label: '設備串接', href: '/admin/settings/devices', permission: 'settings' },
      { label: '後台帳號與權限', href: '/admin/settings/staff', permission: 'staff' },
      { label: 'LINE 登入與邀請', href: '/admin/settings/line', permission: 'dashboard' },
      { label: '操作紀錄', href: '/admin/audit', permission: 'audit' },
    ],
  },
]

/** 相關但不在側欄的頁面，歸屬到哪個選單項目（用來標示選中） */
export const ALIAS_PATHS: Record<string, string> = {
  '/admin/receipts': '/admin/expenses',
  '/admin/ai-courts': '/admin/control',
  '/admin/ai-assistant': '/admin',
  '/admin/templates': '/admin/activities',
}

/** 目前路徑對應的選單項目：取路徑前綴最長的那一個（例如 /admin/members/points 不會同時選中會員列表） */
export function activeHref(pathname: string): string | null {
  const alias = Object.entries(ALIAS_PATHS).find(([p]) => pathname === p || pathname.startsWith(p + '/'))?.[1]
  const path = alias ?? pathname
  let best: string | null = null
  for (const g of ADMIN_NAV) {
    const hrefs = g.href ? [g.href] : (g.items ?? []).map((i) => i.href)
    for (const h of hrefs) {
      const match = h === '/admin' ? path === h : path === h || path.startsWith(h + '/')
      if (match && (!best || h.length > best.length)) best = h
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
