/**
 * 無人化電力控制系統 — 類型定義與枚舉
 *
 * 18 路回路、MQTT 指令、排程、Watchdog、日誌的統一類型系統
 */

export type CircuitNumber = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18';

export const CIRCUIT_DEFINITIONS: Record<CircuitNumber, {
  name: string;
  category: 'RESERVATION_DYNAMIC' | 'OPERATING_HOURS' | 'NIGHT_AMBIENT' | 'ALWAYS_ON' | 'RESERVED';
  defaultEnabled: boolean;
  remoteControlEnabled: boolean;
  scheduleControlEnabled: boolean;
  description: string;
}> = {
  '01': {
    name: '球場 A 主燈',
    category: 'RESERVATION_DYNAMIC',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '球場 A 的主照明燈具',
  },
  '02': {
    name: '球場 A 涼風扇',
    category: 'RESERVATION_DYNAMIC',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '球場 A 的冷卻風扇',
  },
  '03': {
    name: '球場 B 主燈',
    category: 'RESERVATION_DYNAMIC',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '球場 B 的主照明燈具',
  },
  '04': {
    name: '球場 B 涼風扇',
    category: 'RESERVATION_DYNAMIC',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '球場 B 的冷卻風扇',
  },
  '05': {
    name: '大門及 Pro Shop 招牌',
    category: 'OPERATING_HOURS',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '入口大門與專業店面招牌照明',
  },
  '06': {
    name: 'Pro Shop 室內照明',
    category: 'OPERATING_HOURS',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '專業店面內部照明',
  },
  '07': {
    name: 'Pro Shop 室內插座',
    category: 'OPERATING_HOURS',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '專業店面內部電源插座',
  },
  '08': {
    name: '休息區壁挂扇',
    category: 'OPERATING_HOURS',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '休息區的壁掛式風扇',
  },
  '09': {
    name: '浴室熱水器',
    category: 'OPERATING_HOURS',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '浴室的熱水器加熱系統',
  },
  '10': {
    name: '環境氣氛燈／露營燈',
    category: 'NIGHT_AMBIENT',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '夜間環境氣氛營造用露營燈',
  },
  '11': {
    name: '環境氣氛燈／地燈',
    category: 'NIGHT_AMBIENT',
    defaultEnabled: true,
    remoteControlEnabled: true,
    scheduleControlEnabled: true,
    description: '夜間環境地面裝飾燈',
  },
  '12': {
    name: '大門監控及門鎖',
    category: 'ALWAYS_ON',
    defaultEnabled: true,
    remoteControlEnabled: false,
    scheduleControlEnabled: false,
    description: '入口門禁監控與磁力鎖 — 24 小時供電，不納入排程切換',
  },
  '13': {
    name: 'Pro Shop 冷氣（3 台）',
    category: 'ALWAYS_ON',
    defaultEnabled: true,
    remoteControlEnabled: false,
    scheduleControlEnabled: false,
    description: '專業店面冷氣系統 — 24 小時供電，不納入排程切換',
  },
  '14': {
    name: '辦公室弱電箱專用插座',
    category: 'ALWAYS_ON',
    defaultEnabled: true,
    remoteControlEnabled: false,
    scheduleControlEnabled: false,
    description: '辦公室控制設備電源 — 24 小時供電，不納入排程切換',
  },
  '15': {
    name: '辦公室電器',
    category: 'ALWAYS_ON',
    defaultEnabled: true,
    remoteControlEnabled: false,
    scheduleControlEnabled: false,
    description: '辦公室通用電源 — 24 小時供電，不納入排程切換',
  },
  '16': {
    name: '販賣機專用插座',
    category: 'ALWAYS_ON',
    defaultEnabled: true,
    remoteControlEnabled: false,
    scheduleControlEnabled: false,
    description: '自動販賣機電源 — 24 小時供電，不納入排程切換',
  },
  '17': {
    name: '預留迴路 1',
    category: 'RESERVED',
    defaultEnabled: false,
    remoteControlEnabled: false,
    scheduleControlEnabled: false,
    description: '預留未用，停用狀態',
  },
  '18': {
    name: '預留迴路 2',
    category: 'RESERVED',
    defaultEnabled: false,
    remoteControlEnabled: false,
    scheduleControlEnabled: false,
    description: '預留未用，停用狀態',
  },
};

export type CommandStatus = 'PENDING' | 'SENT' | 'ACKED' | 'FAILED' | 'TIMEOUT' | 'EXPIRED';
export type CircuitState = 'ON' | 'OFF';
export type ControlEventType =
  | 'RESERVATION_CREATED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_MODIFIED'
  | 'SCHEDULE_RECALCULATED'
  | 'SCHEDULE_EXECUTED'
  | 'COMMAND_SENT'
  | 'COMMAND_ACKED'
  | 'COMMAND_FAILED'
  | 'OPERATING_HOURS_CHANGED'
  | 'NIGHT_SCHEDULE_CHANGED'
  | 'MANUAL_OVERRIDE'
  | 'OVERRIDE_EXPIRED'
  | 'DEVICE_ONLINE'
  | 'DEVICE_OFFLINE'
  | 'STATUS_MISMATCH'
  | 'MQTT_CONNECTED'
  | 'MQTT_DISCONNECTED'
  | 'WATCHDOG_ALERT'
  | 'SYSTEM_ERROR';

export type WatchdogAlertSeverity = 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'ERROR';
export type EventEnvironment = 'SIMULATION' | 'PRODUCTION';

export interface DeviceMapping {
  deviceMacId: string;
  channel: number;
  onValue: number;
  offValue: number;
}

export interface MqttConfig {
  brokerUrl: string;
  port: number;
  useTls: boolean;
  username?: string;
  password?: string;
  tlsCertPath?: string;
  tlsKeyPath?: string;
  tlsCaPath?: string;
}

export interface ControlCommand {
  id: string;
  commandId: string;
  circuitId: string;
  source: 'SCHEDULE' | 'MANUAL_OVERRIDE' | 'EMERGENCY';
  targetState: CircuitState;
  status: CommandStatus;
  scheduleId?: string;
  reservationId?: string;
  requestedBy?: string;
  mqttTopic?: string;
  mqttPayload?: Record<string, unknown>;
  sentAt?: Date;
  ackedAt?: Date;
  error?: string;
  expiresAt: Date;
  simulated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ControlEvent {
  id: string;
  eventId: string;
  venueId: string;
  circuitId?: string;
  commandId?: string;
  reservationId?: string;
  userId?: string;
  eventType: ControlEventType;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  environment: EventEnvironment;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
  correlationId?: string;
  syncedToNeon: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WatchdogAlert {
  id: string;
  venueId: string;
  alertType: string;
  severity: WatchdogAlertSeverity;
  component?: string;
  componentId?: string;
  title: string;
  description?: string;
  detectionSource?: string;
  detectionCount: number;
  expectedValue?: string;
  actualValue?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  acknowledgedNote?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolveNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 18 路預設配置（需依實際硬體設備調整）
 */
export const DEFAULT_CIRCUIT_CONFIG = {
  /** 預約控制迴路 */
  reservation: {
    advanceMinutes: 0, // 預約前多少分鐘提前開啟
    delayMinutes: 0,   // 預約後多少分鐘延遲關閉
  },
  /** 營業時間控制 */
  businessHours: {
    startMinute: 480,  // 08:00
    endMinute: 1320,   // 22:00
    weekdays: '0,1,2,3,4,5,6', // 每日適用
  },
  /** 夜間情境 */
  nightAmbience: {
    startMinute: 1080, // 18:00
    endMinute: 1320,   // 22:00
    weekdays: '0,1,2,3,4,5,6',
  },
};
