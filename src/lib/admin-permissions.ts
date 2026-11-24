/**
 * 後台角色與權限（前後端共用的定義）。
 * 前端只用來隱藏不可用的選單；真正的檢查在後端（requirePermission / requireAdminApi / pagePermission）。
 *
 * 唯一來源是 ROLE_MATRIX（模組 × 動作）。各頁面與 API 使用的細項權限（Permission）
 * 全部由 PERMISSION_RULES 從矩陣推導，不會出現兩份互相矛盾的設定。
 *
 * 角色：高級管理者、一般管理者、工程管理者
 * - 高級管理者：完整功能，包含所有後台頁面與敏感操作
 * - 一般管理者：只能查看場地預約與訂單紀錄；門禁設備與授權僅能查看狀態摘要；不能訪問會員與教練、財務報表、AI 超級特助及系統設定
 * - 工程管理者：只能查看無人營運管理與 AI 即時監控；不能訪問場地預約、訂單紀錄、財務報表及系統設定
 */

export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'ENGINEER'

export type AdminModule = 'booking' | 'monitor' | 'device' | 'access' | 'finance' | 'reports' | 'settings'
export type AdminAction = 'view' | 'playback' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'remote' | 'door' | 'schedule'

export const MODULES: AdminModule[] = ['booking', 'monitor', 'device', 'access', 'finance', 'reports', 'settings']
export const ACTIONS: AdminAction[] = ['view', 'playback', 'create', 'edit', 'delete', 'approve', 'export', 'remote', 'door', 'schedule']

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
  playback: '歷史回放',
  create: '新增',
  edit: '編輯',
  delete: '刪除',
  approve: '審核',
  export: '匯出',
  remote: '遠端控制',
  door: '門禁授權',
  schedule: '常開排程',
}

/** 每個模組實際存在的動作（矩陣中其他格子不適用） */
export const MODULE_ACTIONS: Record<AdminModule, AdminAction[]> = {
  booking: ['view', 'create', 'edit', 'delete', 'approve'],
  monitor: ['view', 'playback', 'edit', 'approve', 'export'],
  device: ['view', 'edit', 'approve', 'remote'],
  access: ['view', 'door', 'remote', 'schedule', 'approve'],
  finance: ['view', 'create', 'edit', 'approve', 'export'],
  reports: ['view', 'export'],
  settings: ['view', 'edit', 'approve'],
}

/** 每個「模組＋動作」實際代表什麼，供權限頁說明 */
export const ACTION_MEANING: Partial<Record<`${AdminModule}.${AdminAction}`, string>> = {
  'booking.approve': '黑名單、會員角色與權益等級',
  'booking.delete': '取消客人的預約',
  'monitor.view': '即時影像、攝影機狀態、事件紀錄',
  'monitor.playback': '歷史回放',
  'monitor.edit': '攝影機管理（名稱、位置、串流來源、啟用）',
  'monitor.approve': '處理監控事件（確認、結案、備註）',
  'monitor.export': '影像下載與截圖',
  'device.edit': '設備與迴路設定',
  'device.approve': '自動化規則發布',
  'device.remote': '遠端開關設備',
  'access.door': '建立與撤銷門禁授權',
  'access.remote': '遠端開門',
  'access.schedule': '建立與管理常開排程',
  'access.approve': '處理門禁異常事件（Watchdog 檢測與告警）',
  'finance.approve': '退款核准、費用審核、點數調整',
  'settings.approve': '管理員邀請與角色變更',
}

type Matrix = Partial<Record<AdminModule, AdminAction[]>>

const ALL: Matrix = MODULE_ACTIONS

export const ROLE_MATRIX: Record<AdminRole, Matrix> = {
  SUPER_ADMIN: ALL,
  MANAGER: {
    booking: ['view', 'create', 'edit', 'delete', 'approve'],
    access: ['view'],
  },
  ENGINEER: {
    monitor: ['view', 'playback', 'edit', 'approve', 'export'],
    device: ['view', 'edit', 'approve', 'remote'],
    access: ['view', 'approve'],
  },
}

export function canDo(role: string, module: AdminModule, action: AdminAction): boolean {
  const r: AdminRole = role in ROLE_MATRIX ? (role as AdminRole) : 'MANAGER'
  return ROLE_MATRIX[r][module]?.includes(action) ?? false
}

export type Permission =
  | 'dashboard' // 首頁
  | 'ai' // 小P 對話
  | 'monitor' // 場地監測、設備狀態、異常事件
  | 'camera.playback' // 歷史回放
  | 'camera.export' // 影像下載與截圖
  | 'camera.manage' // 攝影機管理
  | 'monitor.events' // 處理監控事件
  | 'device' // 智慧設備管理（檢視配置與迴路）
  | 'device.control' // 遠端開關設備
  | 'device.automation' // 自動化規則發布
  | 'access' // 門禁權限（檢視）
  | 'access.grant' // 建立與撤銷門禁授權
  | 'access.remote' // 遠端開門
  | 'access.schedule' // 建立與管理常開排程
  | 'access.password' // 密碼控制（預約密碼設定）
  | 'access.alerts' // 門禁異常事件處理（Watchdog）
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
  | 'settings' // 球館、營業時間、價格、金流、發票、系統設定（限高級管理者）
  | 'staff' // 邀請管理員、建立帳號、指派角色（限高級管理者）
  | 'audit' // 後台操作紀錄（限高級管理者）

const has = (m: Matrix, mod: AdminModule, act: AdminAction) => m[mod]?.includes(act) ?? false
const anyCreate = (m: Matrix) => MODULES.some((mod) => has(m, mod, 'create'))
const isSuperAdmin = (m: Matrix) => m === ROLE_MATRIX['SUPER_ADMIN']

/** 細項權限 ← 矩陣（唯一推導規則） */
const PERMISSION_RULES: Record<Permission, (m: Matrix, role?: AdminRole) => boolean> = {
  dashboard: () => true,
  ai: (m) => anyCreate(m),
  monitor: (m) => has(m, 'monitor', 'view'),
  'camera.playback': (m) => has(m, 'monitor', 'playback'),
  'camera.export': (m) => has(m, 'monitor', 'export'),
  'camera.manage': (m) => has(m, 'monitor', 'edit'),
  'monitor.events': (m) => has(m, 'monitor', 'approve'),
  device: (m) => has(m, 'device', 'view'),
  'device.control': (m) => has(m, 'device', 'remote'),
  'device.automation': (m) => has(m, 'device', 'approve'),
  access: (m) => has(m, 'access', 'view'),
  'access.grant': (m) => has(m, 'access', 'door'),
  'access.remote': (m) => has(m, 'access', 'remote'),
  'access.schedule': (m) => has(m, 'access', 'schedule'),
  'access.password': (m, role?: AdminRole) => role === 'SUPER_ADMIN',
  'access.alerts': (m) => has(m, 'access', 'approve'),
  courts: (m) => has(m, 'booking', 'view'),
  'courts.manage': (m) => has(m, 'booking', 'edit'),
  bookings: (m) => has(m, 'booking', 'view'),
  'bookings.manage': (m) => has(m, 'booking', 'edit') && has(m, 'booking', 'create'),
  activities: (m) => has(m, 'booking', 'edit'),
  'activities.view': (m) => has(m, 'booking', 'view'),
  checkin: (m) => has(m, 'booking', 'edit'),
  members: (m, role?: AdminRole) => role === 'SUPER_ADMIN',
  'members.note': (m, role?: AdminRole) => role === 'SUPER_ADMIN',
  'members.restrict': (m, role?: AdminRole) => role === 'SUPER_ADMIN',
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
  settings: (m, role?: AdminRole) => role === 'SUPER_ADMIN' && has(m, 'settings', 'edit'),
  staff: (m, role?: AdminRole) => role === 'SUPER_ADMIN' && has(m, 'settings', 'approve'),
  audit: (m, role?: AdminRole) => role === 'SUPER_ADMIN' && has(m, 'settings', 'view'),
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_RULES) as Permission[]

export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = Object.fromEntries(
  (Object.keys(ROLE_MATRIX) as AdminRole[]).map((r) => [r, ALL_PERMISSIONS.filter((p) => PERMISSION_RULES[p](ROLE_MATRIX[r], r))]),
) as Record<AdminRole, Permission[]>

export const ROLE_LABEL: Record<AdminRole, string> = {
  SUPER_ADMIN: '高級管理者',
  MANAGER: '一般管理者',
  ENGINEER: '工程管理者',
}

export const ROLE_SUMMARY: Record<AdminRole, string> = {
  SUPER_ADMIN: '完整功能，包含所有後台頁面與敏感操作。',
  MANAGER: '可查看與管理場地預約與訂單紀錄；門禁設備與授權僅能查看狀態摘要，無法建立授權、遠端開門或設定密碼；不能訪問會員與教練、財務報表、AI 超級特助及系統設定。',
  ENGINEER: '可查看與管理無人營運設備及 AI 即時監控，並可處理門禁異常事件；不能建立門禁授權、遠端開門或設定密碼；不能訪問場地預約、訂單紀錄、財務報表及系統設定。',
}

export const PERMISSION_LABEL: Record<Permission, string> = {
  dashboard: '首頁',
  ai: '小P 對話',
  monitor: '場地監測與異常回報',
  'camera.playback': '歷史回放',
  'camera.export': '影像下載與截圖',
  'camera.manage': '攝影機管理',
  'monitor.events': '處理監控事件',
  device: '智慧設備管理（檢視）',
  'device.control': '設備遠端控制',
  'device.automation': '自動化規則發布',
  access: '門禁權限（檢視）',
  'access.grant': '門禁授權',
  'access.remote': '遠端開門',
  'access.schedule': '常開排程管理',
  'access.password': '密碼控制（預約密碼設定）',
  'access.alerts': '門禁異常事件處理（Watchdog）',
  courts: '智慧排程與場地設定',
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

export function permissionsOf(role: string, roleObj?: AdminRole): Permission[] {
  const r = roleObj || (role in ROLE_PERMISSIONS ? (role as AdminRole) : 'MANAGER')
  return ROLE_PERMISSIONS[r]
}

export function can(role: string, p: Permission): boolean {
  return permissionsOf(role).includes(p)
}

/** 可由高級管理者指派給其他人的角色 */
export const ASSIGNABLE_ROLES: AdminRole[] = ['MANAGER', 'ENGINEER']

/** 權限頁顯示的角色順序 */
export const MATRIX_ROLES: AdminRole[] = ['SUPER_ADMIN', 'MANAGER', 'ENGINEER']
