/**
 * 後台角色與權限（前後端共用的定義）。
 * 前端只用來隱藏不可用的選單；真正的檢查在後端（requirePermission / requireAdminApi / pagePermission）。
 *
 * 唯一來源是 ROLE_MATRIX（模組 × 動作）。各頁面與 API 使用的細項權限（Permission）
 * 全部由 PERMISSION_RULES 從矩陣推導，不會出現兩份互相矛盾的設定。
 *
 * 角色（依最終版設計）：擁有者、管理員、營運人員、櫃台人員、只讀人員；展示帳號（DEMO）只在展示資料庫內體驗。
 * 敏感操作（管理員邀請、角色變更、退款核准、影像匯出、門禁授權、遠端開門、設備控制、自動化規則發布）
 * 各自對應一個細項權限，在後端逐一檢查。
 */

export type AdminRole = 'OWNER' | 'MANAGER' | 'OPERATOR' | 'FRONTDESK' | 'VIEWER' | 'DEMO'

export type AdminModule = 'booking' | 'monitor' | 'device' | 'access' | 'finance' | 'reports' | 'settings'
export type AdminAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'remote' | 'door'

export const MODULES: AdminModule[] = ['booking', 'monitor', 'device', 'access', 'finance', 'reports', 'settings']
export const ACTIONS: AdminAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'remote', 'door']

export const MODULE_LABEL: Record<AdminModule, string> = {
  booking: '預約管理',
  monitor: '即時監控',
  device: '設備控制',
  access: '門禁權限',
  finance: '訂單財務',
  reports: '報表分析',
  settings: '系統設定',
}

export const ACTION_LABEL: Record<AdminAction, string> = {
  view: '查看',
  create: '新增',
  edit: '編輯',
  delete: '刪除',
  approve: '審核',
  export: '匯出',
  remote: '遠端控制',
  door: '門禁授權',
}

/** 每個模組實際存在的動作（矩陣中其他格子不適用） */
export const MODULE_ACTIONS: Record<AdminModule, AdminAction[]> = {
  booking: ['view', 'create', 'edit', 'delete', 'approve'],
  monitor: ['view', 'export'],
  device: ['view', 'edit', 'approve', 'remote'],
  access: ['view', 'door', 'remote'],
  finance: ['view', 'create', 'edit', 'approve', 'export'],
  reports: ['view', 'export'],
  settings: ['view', 'edit', 'approve'],
}

/** 每個「模組＋動作」實際代表什麼，供權限頁說明 */
export const ACTION_MEANING: Partial<Record<`${AdminModule}.${AdminAction}`, string>> = {
  'booking.approve': '黑名單、會員角色與權益等級',
  'booking.delete': '取消客人的預約',
  'monitor.export': '影像匯出',
  'device.edit': '設備與迴路設定',
  'device.approve': '自動化規則發布',
  'device.remote': '遠端開關設備',
  'access.door': '建立與撤銷門禁授權',
  'access.remote': '遠端開門',
  'finance.approve': '退款核准、費用審核、點數調整',
  'settings.approve': '管理員邀請與角色變更',
}

type Matrix = Partial<Record<AdminModule, AdminAction[]>>

const ALL: Matrix = MODULE_ACTIONS

export const ROLE_MATRIX: Record<AdminRole, Matrix> = {
  OWNER: ALL,
  MANAGER: {
    booking: ['view', 'create', 'edit', 'delete', 'approve'],
    monitor: ['view', 'export'],
    device: ['view', 'edit', 'approve', 'remote'],
    access: ['view', 'door', 'remote'],
    finance: ['view', 'create', 'edit', 'approve', 'export'],
    reports: ['view', 'export'],
    settings: ['view', 'edit'],
  },
  OPERATOR: {
    booking: ['view', 'create', 'edit'],
    monitor: ['view'],
    device: ['view', 'remote'],
    access: ['view'],
  },
  FRONTDESK: {
    booking: ['view', 'create', 'edit'],
  },
  VIEWER: {
    booking: ['view'],
    monitor: ['view'],
    device: ['view'],
    access: ['view'],
    finance: ['view'],
    reports: ['view'],
  },
  // 展示帳號：可體驗全部功能，但只在展示資料庫內；不能邀請管理員或變更角色
  DEMO: { ...ALL, settings: ['view', 'edit'] },
}

export function canDo(role: string, module: AdminModule, action: AdminAction): boolean {
  const r: AdminRole = role in ROLE_MATRIX ? (role as AdminRole) : 'VIEWER'
  return ROLE_MATRIX[r][module]?.includes(action) ?? false
}

export type Permission =
  | 'dashboard' // 首頁
  | 'ai' // 小P 對話
  | 'monitor' // 場地監測、設備狀態、異常事件
  | 'camera.export' // 影像匯出
  | 'device' // 智慧設備管理（檢視配置與迴路）
  | 'device.control' // 遠端開關設備
  | 'device.automation' // 自動化規則發布
  | 'access' // 門禁權限（檢視）
  | 'access.grant' // 建立與撤銷門禁授權
  | 'access.remote' // 遠端開門
  | 'courts' // 預約行事曆、場地與時段（檢視）
  | 'courts.manage' // 封場、清潔維護排程、場地設定
  | 'bookings' // 訂單查詢（非財務）
  | 'bookings.manage' // 新增、改期、取消客人的預約
  | 'activities' // 活動、球敘、課程、教練管理
  | 'activities.view' // 場次名單、報名狀況（檢視）
  | 'checkin' // 報到與未到場紀錄
  | 'members' // 會員查詢
  | 'members.note' // 撰寫會員內部備註（服務紀錄）
  | 'members.restrict' // 黑名單、會員角色與權益等級
  | 'marketing' // 商品、庫存、行銷內容、公開促銷價
  | 'refund' // 執行退款
  | 'invoice' // 發票開立、補寄、異動
  | 'finance' // 金額、營收、金流明細、財務報表
  | 'finance.adjust' // 點數調整、發放票券、財務調整
  | 'finance.export' // 帳務資料匯出
  | 'expenses.own' // 建立與查看本人的費用申請
  | 'expenses.review' // 查看全部費用並核准或退回
  | 'reports' // 非財務營運報表
  | 'reports.export' // 報表匯出
  | 'settings' // 球館、營業時間、價格、金流、發票、系統設定
  | 'staff' // 邀請管理員、建立帳號、指派角色
  | 'audit' // 操作紀錄

const has = (m: Matrix, mod: AdminModule, act: AdminAction) => m[mod]?.includes(act) ?? false
const anyCreate = (m: Matrix) => MODULES.some((mod) => has(m, mod, 'create'))

/** 細項權限 ← 矩陣（唯一推導規則） */
const PERMISSION_RULES: Record<Permission, (m: Matrix) => boolean> = {
  dashboard: () => true,
  ai: (m) => anyCreate(m),
  monitor: (m) => has(m, 'monitor', 'view'),
  'camera.export': (m) => has(m, 'monitor', 'export'),
  device: (m) => has(m, 'device', 'view'),
  'device.control': (m) => has(m, 'device', 'remote'),
  'device.automation': (m) => has(m, 'device', 'approve'),
  access: (m) => has(m, 'access', 'view'),
  'access.grant': (m) => has(m, 'access', 'door'),
  'access.remote': (m) => has(m, 'access', 'remote'),
  courts: (m) => has(m, 'booking', 'view'),
  'courts.manage': (m) => has(m, 'booking', 'edit'),
  bookings: (m) => has(m, 'booking', 'view'),
  'bookings.manage': (m) => has(m, 'booking', 'edit') && has(m, 'booking', 'create'),
  activities: (m) => has(m, 'booking', 'edit'),
  'activities.view': (m) => has(m, 'booking', 'view'),
  checkin: (m) => has(m, 'booking', 'edit'),
  members: (m) => has(m, 'booking', 'view'),
  'members.note': (m) => has(m, 'booking', 'edit'),
  'members.restrict': (m) => has(m, 'booking', 'approve'),
  marketing: (m) => has(m, 'finance', 'edit'),
  refund: (m) => has(m, 'finance', 'approve'),
  invoice: (m) => has(m, 'finance', 'edit'),
  finance: (m) => has(m, 'finance', 'view'),
  'finance.adjust': (m) => has(m, 'finance', 'approve'),
  'finance.export': (m) => has(m, 'finance', 'export'),
  'expenses.own': (m) => anyCreate(m),
  'expenses.review': (m) => has(m, 'finance', 'approve'),
  reports: (m) => has(m, 'reports', 'view'),
  'reports.export': (m) => has(m, 'reports', 'export'),
  settings: (m) => has(m, 'settings', 'edit'),
  staff: (m) => has(m, 'settings', 'approve'),
  audit: (m) => has(m, 'settings', 'view'),
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_RULES) as Permission[]

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = Object.fromEntries(
  (Object.keys(ROLE_MATRIX) as AdminRole[]).map((r) => [r, ALL_PERMISSIONS.filter((p) => PERMISSION_RULES[p](ROLE_MATRIX[r]))]),
) as Record<AdminRole, Permission[]>

export const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: '擁有者',
  MANAGER: '管理員',
  OPERATOR: '營運人員',
  FRONTDESK: '櫃台人員',
  VIEWER: '只讀人員',
  DEMO: '展示帳號',
}

export const ROLE_SUMMARY: Record<AdminRole, string> = {
  OWNER: '完整功能，包含管理員邀請、角色變更與所有敏感操作。',
  MANAGER: '預約、監控、設備、門禁、訂單財務、報表與系統設定；不能邀請管理員或變更角色。',
  OPERATOR: '預約管理、即時監控、設備遠端控制；門禁只能查看，不碰財務與設定。',
  FRONTDESK: '預約與報到、會員服務、活動場次；不碰財務、設備、門禁與設定。',
  VIEWER: '各區只能查看，不能新增、修改、匯出或控制任何設備。',
  DEMO: '展示資料庫內的完整體驗，所有外部服務一律模擬。',
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  dashboard: '首頁',
  ai: '小P 對話',
  monitor: '場地監測與異常回報',
  'camera.export': '影像匯出',
  device: '智慧設備管理（檢視）',
  'device.control': '設備遠端控制',
  'device.automation': '自動化規則發布',
  access: '門禁權限（檢視）',
  'access.grant': '門禁授權',
  'access.remote': '遠端開門',
  courts: '預約行事曆與場地',
  'courts.manage': '封場、清潔維護、場地設定',
  bookings: '訂單查詢（不含金額）',
  'bookings.manage': '新增／改期／取消客人預約',
  activities: '活動、課程、教練管理',
  'activities.view': '場次名單檢視',
  checkin: '報到與未到場紀錄',
  members: '會員查詢',
  'members.note': '會員內部備註',
  'members.restrict': '黑名單、角色與權益等級',
  marketing: '商品、庫存、行銷內容',
  refund: '退款核准',
  invoice: '發票',
  finance: '帳務、營收、金流明細',
  'finance.adjust': '點數調整、發放票券',
  'finance.export': '帳務匯出',
  'expenses.own': '本人費用申請',
  'expenses.review': '費用審核與總額',
  reports: '營運報表',
  'reports.export': '報表匯出',
  settings: '球館、價格、金流與系統設定',
  staff: '管理員邀請與角色變更',
  audit: '操作紀錄',
}

export function permissionsOf(role: string): Permission[] {
  return ROLE_PERMISSIONS[role in ROLE_PERMISSIONS ? (role as AdminRole) : 'VIEWER']
}

export function can(role: string, p: Permission): boolean {
  return permissionsOf(role).includes(p)
}

/** 可由擁有者指派給其他人的角色（擁有者只能由既有擁有者轉移，展示帳號不可指派） */
export const ASSIGNABLE_ROLES: AdminRole[] = ['MANAGER', 'OPERATOR', 'FRONTDESK', 'VIEWER']

/** 權限頁顯示的角色順序 */
export const MATRIX_ROLES: AdminRole[] = ['OWNER', 'MANAGER', 'OPERATOR', 'FRONTDESK', 'VIEWER']
