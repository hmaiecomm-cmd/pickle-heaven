/**
 * 門禁控制系統類型定義
 *
 * 包含：
 * - 密碼配置與策略
 * - 命令狀態機
 * - AR-721 控制器規格
 * - RS-485 通信參數
 * - 12 步交易流程狀態
 * - 14 層模擬場景
 */

// ─────── 密碼配置 ───────

export interface CredentialConfig {
  /** PIN 長度（4-6，取決於硬體） */
  pinLength: number
  /** PIN 格式（純數字或英數混合） */
  pinFormat: 'numeric' | 'alphanumeric'
  /** 每日可新增憑證配額 */
  dailyQuota: number
  /** 過期後行為（撤銷或禁用） */
  expirationBehavior: 'revoke' | 'disable'
  /** 是否支援精確時段（秒級 vs 日級） */
  supportsExactTimeRange: boolean
  /** 硬體支援的最大使用者位置數 */
  totalUserSlots: number
  /** 已佔用的位置數 */
  occupiedSlots: number
  /** 已過期但尚未清理的位置數 */
  expiredSlots: number
}

export interface CredentialPolicy {
  /** 控制器 MAC ID */
  controllerMacId: string
  /** 控制器型號 */
  controllerModel: string
  /** Firmware 版本 */
  firmwareVersion: string
  /** 支援的密碼類型 */
  supportedTypes: ('PIN' | 'CARD' | 'BIOMETRIC')[]
  /** PIN 最小長度 */
  pinMinLength: number
  /** PIN 最大長度 */
  pinMaxLength: number
  /** 每日可新增數量 */
  dailyAddLimit: number
  /** 刪除後位置回收時間（秒） */
  slotRecycleDelaySeconds: number
}

// ─────── 門禁命令狀態機 ───────

export enum CommandState {
  /** 等待發送 */
  PENDING = 'PENDING',
  /** 已發送給 MQTT */
  SENT = 'SENT',
  /** 設備已確認 */
  ACKED = 'ACKED',
  /** 設備執行失敗 */
  FAILED = 'FAILED',
  /** 等待確認逾時 */
  TIMEOUT = 'TIMEOUT',
  /** 命令已過期（取消預約） */
  EXPIRED = 'EXPIRED',
}

export const COMMAND_STATE_TRANSITIONS: Record<CommandState, CommandState[]> = {
  [CommandState.PENDING]: [
    CommandState.SENT,
    CommandState.EXPIRED, // 取消預約時
  ],
  [CommandState.SENT]: [
    CommandState.ACKED,
    CommandState.FAILED,
    CommandState.TIMEOUT,
  ],
  [CommandState.ACKED]: [],
  [CommandState.FAILED]: [],
  [CommandState.TIMEOUT]: [CommandState.SENT], // 重試
  [CommandState.EXPIRED]: [],
}

export function isValidStateTransition(
  from: CommandState,
  to: CommandState
): boolean {
  return COMMAND_STATE_TRANSITIONS[from]?.includes(to) ?? false
}

// ─────── 12 步交易流程 ───────

export enum AccessSessionStep {
  STEP_1_BOOKING_CONFIRMED = 1,
  STEP_2_ELIGIBILITY_VERIFIED = 2,
  STEP_3_SESSION_CREATED = 3,
  STEP_4_QUOTA_CHECKED = 4,
  STEP_5_OUTBOX_RECORDED = 5,
  STEP_6_MQTT_SENT = 6,
  STEP_7_PI_VERIFIED = 7,
  STEP_8_RS485_CONFIGURED = 8,
  STEP_9_CONTROLLER_RESPONSE = 9,
  STEP_10_USER_NOTIFIED = 10,
  STEP_11_FOLLOW_UP = 11,
  STEP_12_EVENT_TIMELINE = 12,
}

export const STEP_DESCRIPTIONS: Record<AccessSessionStep, string> = {
  [AccessSessionStep.STEP_1_BOOKING_CONFIRMED]: '預約已成立',
  [AccessSessionStep.STEP_2_ELIGIBILITY_VERIFIED]: '門禁資格驗證',
  [AccessSessionStep.STEP_3_SESSION_CREATED]: '建立門禁會話',
  [AccessSessionStep.STEP_4_QUOTA_CHECKED]: '檢查配額與容量',
  [AccessSessionStep.STEP_5_OUTBOX_RECORDED]: '記錄命令至 Outbox',
  [AccessSessionStep.STEP_6_MQTT_SENT]: 'MQTT 發送命令',
  [AccessSessionStep.STEP_7_PI_VERIFIED]: 'Raspberry Pi 驗證',
  [AccessSessionStep.STEP_8_RS485_CONFIGURED]: 'RS-485 設備配置',
  [AccessSessionStep.STEP_9_CONTROLLER_RESPONSE]: '控制器回應',
  [AccessSessionStep.STEP_10_USER_NOTIFIED]: '通知使用者',
  [AccessSessionStep.STEP_11_FOLLOW_UP]: '系統後續追蹤',
  [AccessSessionStep.STEP_12_EVENT_TIMELINE]: '保留完整時間軸',
}

// ─────── RS-485 通信配置 ───────

export interface RS485Config {
  /** 串列埠名稱 */
  portName: string
  /** 鮑率 */
  baudRate: 9600 | 19200 | 38400
  /** 資料位元 */
  dataBits: 8 | 7
  /** 停止位元 */
  stopBits: 1 | 2
  /** 同位元 */
  parity: 'none' | 'odd' | 'even'
  /** 控制器站號 */
  stationId: number
  /** SOYAL 協定版本 */
  protocolVersion: string
  /** 命令超時（毫秒） */
  timeout: number
  /** 失敗重試次數 */
  retries: number
  /** 校驗方式 */
  checksumType: 'CRC' | 'checksum'
  /** RS-485 極性檢查 */
  polarityCheck: boolean
  /** 終端電阻阻值（Ω） */
  terminationResistor: 120
  /** 偏壓電阻阻值（Ω） */
  biasingResistor?: 510
}

// ─────── 控制器配置 ───────

export interface ControllerConfig {
  /** 設備型號（例如 AR-721H） */
  model: string
  /** MAC ID */
  macId: string
  /** Firmware 版本 */
  firmwareVersion: string
  /** 操作模式 */
  operationMode: 'MASTER' | 'READER' | 'SLAVE'
  /** 密碼管理能力 */
  credentialCapability: CredentialPolicy
  /** RS-485 通信參數 */
  rs485Config: RS485Config
  /** NTP 伺服器（校時用） */
  ntpServer: string
  /** 時鐘漂移容許值（秒） */
  clockDriftThreshold: number
  /** 門磁訊號反轉（某些型號） */
  doorSignalInverted: boolean
  /** 備援電池容量 */
  batteryCapacity: 'HIGH' | 'MEDIUM' | 'LOW'
}

// ─────── 控制器回應 ───────

export interface ControllerResponse {
  /** 操作是否成功 */
  success: boolean
  /** 使用者位置編號 */
  userSlotNumber?: number
  /** 結果代碼（廠商定義） */
  resultCode?: string
  /** 結果說明 */
  resultMessage?: string
  /** 控制器時間戳（用於時鐘漂移偵測） */
  timestamp?: Date
  /** 控制器報告的詳細資訊 */
  details?: Record<string, unknown>
}

export interface ControllerStatus {
  /** 連接狀態 */
  online: boolean
  /** 已佔用使用者位置數 */
  usedSlots: number
  /** 可用位置數 */
  availableSlots: number
  /** 控制器時間 */
  controllerTime: Date
  /** 電源狀態 */
  powerStatus: 'AC' | 'BATTERY' | 'BATTERY_LOW' | 'UNKNOWN'
  /** 電池電量百分比 */
  batteryPercent?: number
  /** 最後一次通訊 */
  lastHeartbeat: Date
  /** 交易紀錄數量 */
  accessLogCount: number
  /** 最後一次存取 */
  lastAccessTime?: Date
}

// ─────── 門禁命令詳情 ───────

export interface ProvisionCredentialPayload {
  /** 命令 ID */
  commandId: string
  /** 預約版本 */
  bookingVersion: number
  /** 憑證 ID */
  credentialId: string
  /** 憑證類型 */
  credentialType: 'PIN' | 'CARD' | 'BIOMETRIC'
  /** 密碼值（PIN 為 hash） */
  credentialValue: string
  /** 有效起始時間（ISO 8601） */
  validFrom: string
  /** 有效終止時間（ISO 8601） */
  validUntil: string
  /** 發行時間 */
  issuedAt: string
  /** 失效時間（命令本身） */
  expiresAt: string
}

export interface RevokeCredentialPayload {
  /** 命令 ID */
  commandId: string
  /** 預約版本 */
  bookingVersion: number
  /** 憑證 ID */
  credentialId: string
  /** 使用者位置編號 */
  userSlotNumber: number
  /** 撤銷原因 */
  reason: 'CANCELLED' | 'MODIFIED' | 'EXPIRED' | 'MANUAL'
}

// ─────── 通行結果 ───────

export enum AccessResult {
  /** 通行已授予 */
  GRANTED = 'GRANTED',
  /** 拒絕通行 */
  DENIED = 'DENIED',
  /** 結果未知（離線） */
  UNKNOWN = 'UNKNOWN',
  /** 憑證未使用 */
  NOT_USED = 'NOT_USED',
}

export interface AccessAttempt {
  /** 使用者位置編號 */
  userSlotNumber: number
  /** 通行嘗試時間 */
  attemptAt: Date
  /** 使用方式 */
  method: 'PIN_ENTRY' | 'CARD_SCAN' | 'BIOMETRIC'
  /** 嘗試值（已脫敏） */
  attemptValue?: string
  /** 結果 */
  result: AccessResult
  /** 控制器結果代碼 */
  resultCode?: string
  /** 門磁狀態 */
  doorState: 'OPENED' | 'CLOSED'
  /** 門開啟時間 */
  doorOpenAt?: Date
  /** 門關閉時間 */
  doorClosedAt?: Date
}

// ─────── 時間相關常數 ───────

export const TIME_CONSTANTS = {
  /** MQTT 命令超時（秒） */
  MQTT_COMMAND_TIMEOUT_SECONDS: 30,
  /** RS-485 命令超時（秒） */
  RS485_COMMAND_TIMEOUT_SECONDS: 5,
  /** 命令有效期限（分鐘）：發行後多久失效 */
  COMMAND_VALIDITY_MINUTES: 24 * 60, // 24 小時
  /** 憑證過期後清理延遲（秒）：已過期憑證多久後清理 */
  CREDENTIAL_CLEANUP_DELAY_SECONDS: 3600, // 1 小時
  /** 位置回收延遲（秒）：刪除後多久可重用 */
  SLOT_RECYCLE_DELAY_SECONDS: 300, // 5 分鐘
  /** 時鐘漂移告警閾值（秒） */
  CLOCK_DRIFT_THRESHOLD_SECONDS: 60,
  /** 門未關警報時間（秒） */
  DOOR_HELD_OPEN_TIMEOUT_SECONDS: 120, // 2 分鐘
  /** Watchdog 檢測間隔（秒） */
  WATCHDOG_CHECK_INTERVAL_SECONDS: 10,
  /** Watchdog 告警閾值：連續失敗次數 */
  WATCHDOG_FAILURE_THRESHOLD: 3,
} as const

// ─────── PIN 生成規則 ───────

export const PIN_GENERATION_RULES = {
  /** 預設 PIN 長度 */
  DEFAULT_LENGTH: 6,
  /** 最小長度 */
  MIN_LENGTH: 4,
  /** 最大長度 */
  MAX_LENGTH: 8,
  /** 避免的模式（易於猜測） */
  FORBIDDEN_PATTERNS: [
    /^0000/, // 全 0
    /^1111/, // 全 1
    /^1234/, // 遞增
    /^4321/, // 遞減
    /^1212/, // 重複
    /^9999/, // 全 9
  ],
  /** 檢查重複密碼（同日內相同 PIN 的間隔） */
  DUPLICATE_PIN_WINDOW_MINUTES: 60,
} as const

// ─────── 14 層模擬場景 ───────

export enum SimulationLayer {
  /** 層 1: API 收到預約確認 */
  LAYER_1_API_RECEIVED = 1,
  /** 層 2: 排程及憑證參照建立 */
  LAYER_2_SESSION_CREATED = 2,
  /** 層 3: 密碼配額與控制器容量檢查 */
  LAYER_3_QUOTA_CHECKED = 3,
  /** 層 4: MQTT broker 收到訊息 */
  LAYER_4_MQTT_RECEIVED = 4,
  /** 層 5: Raspberry Pi 接收及驗證 */
  LAYER_5_PI_VERIFIED = 5,
  /** 層 6: RS-485 Adapter 寫入控制器 */
  LAYER_6_RS485_SENT = 6,
  /** 層 7: 控制器接受、拒絕或回應未知 */
  LAYER_7_CONTROLLER_RESPONDED = 7,
  /** 層 8: 使用者通知成功或失敗 */
  LAYER_8_USER_NOTIFIED = 8,
  /** 層 9: 使用者輸入正確或錯誤密碼 */
  LAYER_9_USER_INPUT = 9,
  /** 層 10: 控制器通行紀錄與門磁開關狀態 */
  LAYER_10_ACCESS_LOG = 10,
  /** 層 11: 門未關、強行開門、電源斷電、網路中斷、控制器重啟及校時錯誤 */
  LAYER_11_ERROR_CONDITIONS = 11,
  /** 層 12: 取消／改期與命令同時發生 */
  LAYER_12_CONCURRENCY = 12,
  /** 層 13: 舊命令、重複命令、命令過期及撤銷未確認 */
  LAYER_13_COMMAND_VALIDITY = 13,
  /** 層 14: 控制器容量滿、密碼配額滿、PIN 衝突等邊界情況 */
  LAYER_14_BOUNDARY_CONDITIONS = 14,
}

export interface SimulationScenario {
  /** 場景名稱 */
  name: string
  /** 描述 */
  description: string
  /** 涉及的層級 */
  layers: SimulationLayer[]
  /** 預期結果 */
  expectedOutcome: string
  /** 錯誤場景或成功場景 */
  type: 'success' | 'failure' | 'edge_case'
}

export const SIMULATION_SCENARIOS: Record<string, SimulationScenario> = {
  /** 正常流程：預約 → 密碼設定 → 通行 */
  NORMAL_FLOW: {
    name: '正常流程',
    description: '預約建立 → 密碼設定完成 → 使用者成功通行',
    layers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    expectedOutcome: '使用者獲得通行權，交易記錄完整',
    type: 'success',
  },

  /** 取消預約：密碼已設定但預約被取消 */
  CANCEL_FLOW: {
    name: '取消預約',
    description: '密碼已設定 → 預約被取消 → 撤銷命令下發',
    layers: [2, 5, 6, 7, 12, 13],
    expectedOutcome: '控制器已刪除該憑證，位置回收',
    type: 'success',
  },

  /** 容量滿額：密碼配額已滿 */
  CAPACITY_FULL: {
    name: '容量滿額',
    description: '控制器使用者位置已滿',
    layers: [3, 14],
    expectedOutcome: '拒絕新增憑證，建立告警',
    type: 'failure',
  },

  /** 網路中斷：發送命令時網路斷開 */
  NETWORK_FAILURE: {
    name: '網路中斷',
    description: 'MQTT 發送後網路斷開，命令未被 Pi 接收',
    layers: [4, 5, 11],
    expectedOutcome: '命令標記為 UNKNOWN，待網路恢復後重試',
    type: 'edge_case',
  },

  /** 門未關警報：使用者通行後門一直未關 */
  DOOR_HELD_OPEN: {
    name: '門未關警報',
    description: '使用者通行 → 門打開 → 超過閾值時間未關',
    layers: [10, 11],
    expectedOutcome: 'Watchdog 告警 DOOR_HELD_OPEN',
    type: 'failure',
  },

  /** 時鐘漂移：控制器時鐘與伺服器時間相差 > 60 秒 */
  CLOCK_DRIFT: {
    name: '時鐘漂移',
    description: '控制器時鐘未校準，漂移 > 60 秒',
    layers: [7, 11],
    expectedOutcome: 'Watchdog 告警 CONTROLLER_CLOCK_DRIFT',
    type: 'failure',
  },

  /** 電源斷電：Pi 或控制器電源斷開 */
  POWER_LOSS: {
    name: '電源斷電',
    description: '24V 電源斷開，磁力鎖自動釋放',
    layers: [11],
    expectedOutcome: '已設定憑證仍可在本機使用，緊急釋放獨立生效',
    type: 'edge_case',
  },

  /** PI 重啟後不執行舊命令 */
  PI_RESTART: {
    name: 'Pi 重啟',
    description: '命令已下發 → Pi 重啟 → 重連後不重複執行舊命令',
    layers: [5, 11, 13],
    expectedOutcome: '舊命令被識別為已執行，不再執行',
    type: 'edge_case',
  },

  /** 強行開門：未授權情況下門磁開啟 */
  FORCED_ACCESS: {
    name: '強行開門',
    description: '未授權狀態下門被強行打開',
    layers: [10, 11],
    expectedOutcome: 'Watchdog 告警 DOOR_FORCED_OPEN',
    type: 'failure',
  },

  /** 密碼衝突：新增密碼與已有密碼相同 */
  PIN_CONFLICT: {
    name: '密碼衝突',
    description: '新預約的 PIN 與現有憑證重複',
    layers: [3, 14],
    expectedOutcome: '拒絕新增，提示配額或衝突',
    type: 'failure',
  },

  /** 改期：預約被改為另一時段，憑證需更新 */
  RESCHEDULE: {
    name: '改期',
    description: '預約時間被改期，舊憑證撤銷，新憑證設定',
    layers: [2, 12, 13],
    expectedOutcome: '舊版本命令被拒絕，新版本命令執行',
    type: 'success',
  },
}

// ─────── 8 項實體驗收清單 ───────

export interface AcceptanceTest {
  /** 測試編號 */
  id: number
  /** 測試項目 */
  title: string
  /** 詳細說明 */
  description: string
  /** 驗收方法 */
  method: string
  /** 預期結果 */
  expectedResult: string
  /** 狀態 */
  status: 'PENDING' | 'PASSED' | 'FAILED'
  /** 備註 */
  notes?: string
}

export const ACCEPTANCE_TESTS: AcceptanceTest[] = [
  {
    id: 1,
    title: '斷網時已設定憑證仍可用',
    description: '網路斷開時，已設定在控制器的憑證應仍能使用',
    method: '關閉 Wi-Fi / 網線，使用者嘗試輸入 PIN',
    expectedResult: '控制器允許通行',
    status: 'PENDING',
  },
  {
    id: 2,
    title: '斷電時磁力鎖與出門按鈕',
    description: '24V 電源斷開時，磁力鎖應自動釋放，出門按鈕應獨立生效',
    method: '切斷 24V 電源，嘗試推開門或按出門按鈕',
    expectedResult: '門自動解鎖，出門按鈕獨立生效',
    status: 'PENDING',
  },
  {
    id: 3,
    title: 'Pi 重啟後不執行舊遠端命令',
    description: '發送舊的遠端開門命令後重啟 Pi，不應重新執行該舊命令',
    method: '發送命令 → 記錄時間戳 → 重啟 Pi → 檢查控制器交易記錄',
    expectedResult: '舊命令未被重新執行',
    status: 'PENDING',
  },
  {
    id: 4,
    title: '預約取消後憑證已撤銷',
    description: '預約取消後，確認現場控制器已移除或標記該憑證',
    method: '建立預約 → 設定密碼 → 取消預約 → 讀回控制器使用者清單',
    expectedResult: '控制器中該位置已清空或標記為過期',
    status: 'PENDING',
  },
  {
    id: 5,
    title: '有效時段邊界測試',
    description: '測試 PIN 有效期的起點、終點與時鐘偏差',
    method:
      '設定有效時間 [08:00, 09:00)，分別在 07:59、08:00、08:59、09:00 嘗試',
    expectedResult: '邊界檢查正確（07:59 拒絕，08:00-08:59 允許，09:00 拒絕）',
    status: 'PENDING',
  },
  {
    id: 6,
    title: '多筆預約與容量壓力測試',
    description: '同日建立多筆預約，測試取消、改期與密碼容量',
    method: '建立 10 筆預約 → 取消 5 筆 → 改期 3 筆 → 檢查狀態',
    expectedResult: '所有操作成功，狀態一致',
    status: 'PENDING',
  },
  {
    id: 7,
    title: '門磁超時與強行開門告警',
    description: '門開啟超時或未授權開門時是否觸發告警',
    method: '正常通行→超時不關 或 未授權強行打開 → 監測 Watchdog 告警',
    expectedResult: '告警正確觸發（DOOR_HELD_OPEN 或 DOOR_FORCED_OPEN）',
    status: 'PENDING',
  },
  {
    id: 8,
    title: '管理者手動操作與稽核紀錄',
    description: '遠端解鎖、緊急撤銷等操作是否完整記錄',
    method: '執行遠端解鎖 → 緊急撤銷 → 查詢審計日誌',
    expectedResult: '所有操作都有完整的操作者、時間、原因、結果記錄',
    status: 'PENDING',
  },
]

// ─────── 工具函數 ───────

/**
 * 驗證版本號是否相容
 * 規則：命令版本必須 ≥ 目前預約版本
 */
export function isVersionCompatible(
  commandVersion: number,
  currentVersion: number
): boolean {
  return commandVersion >= currentVersion
}

/**
 * 檢查 PIN 是否違反禁用模式
 */
export function validatePinPattern(pin: string): boolean {
  for (const pattern of PIN_GENERATION_RULES.FORBIDDEN_PATTERNS) {
    if (pattern.test(pin)) {
      return false
    }
  }
  return true
}

/**
 * 計算命令失效時間
 */
export function calculateCommandExpiry(issuedAt: Date): Date {
  const expiresAt = new Date(issuedAt)
  expiresAt.setMinutes(
    expiresAt.getMinutes() + TIME_CONSTANTS.COMMAND_VALIDITY_MINUTES
  )
  return expiresAt
}

/**
 * 計算時鐘漂移
 */
export function calculateClockDrift(
  serverTime: Date,
  controllerTime: Date
): number {
  return Math.abs(serverTime.getTime() - controllerTime.getTime()) / 1000
}

/**
 * 檢查是否超過時鐘漂移閾值
 */
export function isClockDriftCritical(driftSeconds: number): boolean {
  return driftSeconds > TIME_CONSTANTS.CLOCK_DRIFT_THRESHOLD_SECONDS
}

/**
 * 檢查門是否超過開啟時間閾值
 */
export function isDoorHeldOpenTooLong(
  doorOpenAt: Date,
  currentTime: Date
): boolean {
  const seconds = (currentTime.getTime() - doorOpenAt.getTime()) / 1000
  return seconds > TIME_CONSTANTS.DOOR_HELD_OPEN_TIMEOUT_SECONDS
}
