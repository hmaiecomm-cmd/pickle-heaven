/**
 * 後台角色與權限（前後端共用的定義）。
 * 前端只用來隱藏不可用的選單；真正的檢查在後端（requirePermission / requirePermissionApi）。
 */

export type AdminRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'DEMO'

export type Permission =
  | 'dashboard' // 今日總覽
  | 'ai' // AI 助理
  | 'monitor' // 場地監測、異常事件
  | 'device.control' // 開門、燈控等設備控制
  | 'courts' // 預約行事曆、場地與時段
  | 'courts.manage' // 封場、場地設定
  | 'bookings' // 交易查詢與明細
  | 'refund' // 執行退款
  | 'invoice' // 發票補寄、異動
  | 'activities' // 活動管理
  | 'members' // 會員資料
  | 'members.restrict' // 會員限制與黑名單
  | 'marketing' // 商城與行銷
  | 'finance' // 金額、營收、報表
  | 'settings' // 球館與系統設定
  | 'staff' // 員工帳號與權限
  | 'audit' // 操作紀錄

const ALL: Permission[] = [
  'dashboard', 'ai', 'monitor', 'device.control', 'courts', 'courts.manage', 'bookings', 'refund', 'invoice',
  'activities', 'members', 'members.restrict', 'marketing', 'finance', 'settings', 'staff', 'audit',
]

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== 'staff'),
  STAFF: ['dashboard', 'ai', 'monitor', 'courts', 'bookings', 'activities', 'members'],
  // 展示帳號：可體驗全部功能，但只在展示資料庫內；不能管理真實員工帳號
  DEMO: ALL.filter((p) => p !== 'staff'),
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: '擁有者',
  MANAGER: '管理員',
  STAFF: '櫃台人員',
  DEMO: '展示帳號',
}

export function permissionsOf(role: string): Permission[] {
  return ROLE_PERMISSIONS[(role as AdminRole) in ROLE_PERMISSIONS ? (role as AdminRole) : 'STAFF']
}

export function can(role: string, p: Permission): boolean {
  return permissionsOf(role).includes(p)
}
