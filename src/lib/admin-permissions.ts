/**
 * 後台角色與權限（前後端共用的定義）。
 * 前端只用來隱藏不可用的選單；真正的檢查在後端（requirePermission / requireAdminApi / pagePermission）。
 *
 * 角色：擁有者（OWNER）、管理員（MANAGER）、工作人員（STAFF）；展示帳號（DEMO）只在展示資料庫內體驗。
 * 原則：
 * - 帳務（金額、營收、支出總額、金流明細、退款、發票、點數調整）只有擁有者。
 * - 管理員負責場地預約、活動、商城行銷、會員服務與非財務營運資料。
 * - 工作人員只查詢、報到、服務紀錄與本人費用申請；不改客人預約。
 */

export type AdminRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'DEMO'

export type Permission =
  | 'dashboard' // 今日總覽（非財務）
  | 'ai' // 小P 對話
  | 'monitor' // 場地監測、設備狀態、異常事件（檢視與回報）
  | 'device.control' // 開門、燈控等設備控制（擁有者另行授予）
  | 'courts' // 預約行事曆、場地與時段（檢視）
  | 'courts.manage' // 封場、清潔維護排程、場地設定
  | 'bookings' // 訂單查詢（非財務：狀態、付款已確認／待處理）
  | 'bookings.manage' // 新增、改期、取消客人的預約
  | 'refund' // 執行退款、財務處理
  | 'invoice' // 發票開立、補寄、異動
  | 'activities' // 活動、球敘、課程、教練管理
  | 'activities.view' // 場次名單、報名狀況（檢視）
  | 'checkin' // 報到與未到場紀錄
  | 'members' // 會員查詢與服務紀錄
  | 'members.restrict' // 黑名單、會員角色與權益等級
  | 'marketing' // 商品、庫存、行銷內容、公開促銷價
  | 'reports' // 非財務營運報表（使用率、報到、名額）
  | 'finance' // 金額、營收、金流明細、財務報表、匯出
  | 'finance.adjust' // 點數調整、發放票券、財務調整
  | 'expenses.own' // 建立與查看本人的費用申請
  | 'expenses.review' // 查看全部費用、附件與總額，核准或退回
  | 'settings' // 球館、營業時間、價格、金流、發票、儲值方案、系統設定
  | 'staff' // 建立、停用、指派後台帳號與角色
  | 'audit' // 操作紀錄

const ALL: Permission[] = [
  'dashboard', 'ai', 'monitor', 'device.control', 'courts', 'courts.manage', 'bookings', 'bookings.manage', 'refund', 'invoice',
  'activities', 'activities.view', 'checkin', 'members', 'members.restrict', 'marketing', 'reports', 'finance', 'finance.adjust',
  'expenses.own', 'expenses.review', 'settings', 'staff', 'audit',
]

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  OWNER: ALL,
  MANAGER: ['dashboard', 'ai', 'monitor', 'courts', 'courts.manage', 'bookings', 'bookings.manage', 'activities', 'activities.view', 'checkin', 'members', 'marketing', 'reports', 'expenses.own'],
  STAFF: ['dashboard', 'ai', 'monitor', 'courts', 'bookings', 'activities.view', 'checkin', 'members', 'expenses.own'],
  // 展示帳號：可體驗全部功能，但只在展示資料庫內；不能管理真實員工帳號
  DEMO: ALL.filter((p) => p !== 'staff'),
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: '擁有者',
  MANAGER: '管理員',
  STAFF: '工作人員',
  DEMO: '展示帳號',
}

export const ROLE_SUMMARY: Record<AdminRole, string> = {
  OWNER: '完整功能：帳務、退款、點數、後台帳號、金流與系統設定。',
  MANAGER: '場地預約、活動與課程、商城行銷、會員服務、非財務營運資料；不含帳務、退款、點數調整、角色與金流設定。',
  STAFF: '今日值班、預約查詢、報到、服務紀錄、場地狀態、本人費用申請；不能新增、改期或取消客人的預約。',
  DEMO: '展示資料庫內的完整體驗，所有外部服務一律模擬。',
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  dashboard: '今日總覽',
  ai: '小P 對話',
  monitor: '場地監測與異常回報',
  'device.control': '設備控制（開門、燈控）',
  courts: '預約行事曆與場地',
  'courts.manage': '封場、清潔維護、場地設定',
  bookings: '訂單查詢（不含金額）',
  'bookings.manage': '修改／取消客人預約',
  refund: '退款與財務處理',
  invoice: '發票',
  activities: '活動、課程、教練管理',
  'activities.view': '場次名單檢視',
  checkin: '報到與未到場紀錄',
  members: '會員查詢與服務紀錄',
  'members.restrict': '黑名單、角色與權益等級',
  marketing: '商品、庫存、行銷內容',
  reports: '非財務營運報表',
  finance: '帳務、營收、金流明細、匯出',
  'finance.adjust': '點數調整、發放票券',
  'expenses.own': '本人費用申請',
  'expenses.review': '費用審核與總額',
  settings: '球館、價格、金流與系統設定',
  staff: '後台帳號與角色',
  audit: '操作紀錄',
}

export function permissionsOf(role: string): Permission[] {
  return ROLE_PERMISSIONS[(role as AdminRole) in ROLE_PERMISSIONS ? (role as AdminRole) : 'STAFF']
}

export function can(role: string, p: Permission): boolean {
  return permissionsOf(role).includes(p)
}

/** 可指派給員工的角色（擁有者只能由既有擁有者轉移） */
export const ASSIGNABLE_ROLES: AdminRole[] = ['MANAGER', 'STAFF']
