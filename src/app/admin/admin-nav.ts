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

export interface AdminNavGroup {
  key: string
  label: string
  /** 沒有子項目時直接連結 */
  href?: string
  permission?: Permission
  items?: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { key: 'home', label: '今日總覽', href: '/admin', permission: 'dashboard' },
  {
    key: 'ai',
    label: 'AI 營運中心',
    items: [
      { label: 'AI 助理對話', href: '/admin/ai-assistant', permission: 'ai' },
      { label: '場地即時監測', href: '/admin/monitor', permission: 'monitor' },
      { label: '無人化控制', href: '/admin/control', permission: 'monitor' },
      { label: '異常警示與處理紀錄', href: '/admin/incidents', permission: 'monitor' },
      { label: '自動化規則', href: '/admin/automation', permission: 'monitor', notOpen: true },
    ],
  },
  {
    key: 'courts',
    label: '場地管理',
    items: [
      { label: '預約行事曆', href: '/admin/schedule', permission: 'courts' },
      { label: '場地與時段', href: '/admin/courts', permission: 'courts' },
      { label: '封場與維護', href: '/admin/maintenance', permission: 'courts.manage' },
    ],
  },
  {
    key: 'orders',
    label: '交易管理',
    items: [
      { label: '訂場與活動訂單', href: '/admin/bookings', permission: 'bookings', exact: true },
      { label: '商品訂單', href: '/admin/bookings/products', permission: 'bookings', notOpen: true },
      { label: '退款紀錄', href: '/admin/refunds', permission: 'bookings' },
      { label: '發票管理', href: '/admin/invoices', permission: 'invoice' },
    ],
  },
  {
    key: 'activities',
    label: '活動管理',
    items: [
      { label: '活動列表', href: '/admin/activities', permission: 'activities' },
      { label: '場次與週期安排', href: '/admin/sessions', permission: 'activities' },
      { label: '報名與候補／通知名單', href: '/admin/registrations', permission: 'activities' },
      { label: '教練', href: '/admin/events', permission: 'activities' },
    ],
  },
  {
    key: 'members',
    label: '會員管理',
    items: [
      { label: '會員列表', href: '/admin/members', permission: 'members', exact: true },
      { label: '會員預約與消費紀錄', href: '/admin/members/history', permission: 'members' },
      { label: '點數與票券', href: '/admin/members/points', permission: 'members' },
      { label: '會員限制與黑名單', href: '/admin/members/restrictions', permission: 'members.restrict' },
    ],
  },
  {
    key: 'marketing',
    label: '商城與行銷',
    items: [
      { label: '商品與庫存', href: '/admin/marketing/products', permission: 'marketing', notOpen: true },
      { label: '優惠與票券方案', href: '/admin/marketing/vouchers', permission: 'marketing' },
      { label: '行銷活動與通知', href: '/admin/marketing/campaigns', permission: 'marketing', notOpen: true },
    ],
  },
  {
    key: 'reports',
    label: '營運報表',
    items: [
      { label: '營運概況', href: '/admin/reports', permission: 'finance', exact: true },
      { label: '收入與退款', href: '/admin/finance', permission: 'finance' },
      { label: '場地使用率', href: '/admin/reports/utilization', permission: 'finance' },
      { label: '活動參與', href: '/admin/reports/activities', permission: 'finance' },
      { label: '會員分析', href: '/admin/reports/members', permission: 'finance' },
      { label: '支出與收據', href: '/admin/expenses', permission: 'finance' },
    ],
  },
  {
    key: 'settings',
    label: '設定管理',
    items: [
      { label: '球館基本資料', href: '/admin/settings', permission: 'settings', exact: true },
      { label: '營業時間與預約規則', href: '/admin/pricing', permission: 'settings' },
      { label: '官網頁面管理', href: '/admin/settings/site', permission: 'settings', notOpen: true },
      { label: '金流與發票設定', href: '/admin/settings/payments', permission: 'settings' },
      { label: '設備串接', href: '/admin/settings/devices', permission: 'settings' },
      { label: '員工帳號與權限', href: '/admin/settings/staff', permission: 'staff' },
      { label: '操作紀錄', href: '/admin/audit', permission: 'audit' },
    ],
  },
]

/** 相關但不在側欄的頁面，歸屬到哪個選單項目（用來標示選中） */
export const ALIAS_PATHS: Record<string, string> = {
  '/admin/receipts': '/admin/expenses',
  '/admin/finance/payments': '/admin/finance',
  '/admin/ai-courts': '/admin/control',
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
  const href = activeHref(pathname)
  for (const g of ADMIN_NAV) {
    if (g.href && g.href === href) return g.label
    const item = g.items?.find((i) => i.href === href)
    if (item) return `${g.label}／${item.label}`
  }
  return '後台'
}
