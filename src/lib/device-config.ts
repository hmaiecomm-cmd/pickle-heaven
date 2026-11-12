/**
 * 裝置適配器組態
 *
 * 定義研華 Relay 及其他控制設備的連接、MQTT topic、通道映射等資訊。
 * 此文件不含真實密鑰／凭證；凭証由環境變量 MQTT_PASSWORD、TLS 路徑等提供。
 */

export interface DeviceAdapterConfig {
  /** 設備唯一識別 */
  id: string;
  /** 設備名稱，例如 "Relay-001" */
  name: string;
  /** 設備型號，例如 "ADVANTECH_ADAM_4019" */
  deviceType: string;
  /** MAC ID 或設備編號 */
  macId: string;
  /** MQTT Broker 連接 */
  mqtt: {
    brokerUrl: string;
    port: number;
    useTls: boolean;
    username?: string;
    password?: string;
    tlsCertPath?: string;
    tlsKeyPath?: string;
    tlsCaPath?: string;
  };
  /** MQTT Topic 前綴，例如 "Advantech/{MAC_ID}" */
  mqttTopicPrefix: string;
  /** 設備輸出通道數 */
  totalChannels: number;
  /** 控制 Topic 模板，例如 "{prefix}/ctl/do{channel}" */
  controlTopicTemplate: string;
  /** 狀態 Topic，例如 "{prefix}/data" */
  statusTopic: string;
  /** 設備回報狀態的解析規則 */
  stateMapping: {
    /** 數值欄位名稱，例如 "v" */
    valueField: string;
    /** ON 值映射，例如 1 或 "ON" */
    onValue: number | string;
    /** OFF 值映射，例如 0 或 "OFF" */
    offValue: number | string;
  };
  /** 是否啟用 */
  enabled: boolean;
  /** 最後心跳時間 */
  lastHeartbeat?: Date;
  /** 連接狀態 */
  connectionStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}

/**
 * 預設模擬裝置配置（用於 simulation 環境）
 *
 * 該配置模擬一台研華 ADAM-4019 Relay 模組，但不實際連接。
 * 實機型號、firmware、MAC ID 等需由現場確認並寫入環境變量或數據庫。
 */
export const SIMULATION_DEVICE_CONFIG: DeviceAdapterConfig = {
  id: 'sim-relay-001',
  name: 'Simulation Relay (Mock ADAM-4019)',
  deviceType: 'ADVANTECH_ADAM_4019_MOCK',
  macId: '00:01:02:03:04:05', // Mock MAC ID
  mqtt: {
    brokerUrl: 'localhost',
    port: 1883,
    useTls: false,
    username: undefined,
    password: undefined,
  },
  mqttTopicPrefix: 'Advantech/sim-relay-001',
  totalChannels: 18,
  controlTopicTemplate: '{prefix}/ctl/do{channel}',
  statusTopic: '{prefix}/data',
  stateMapping: {
    valueField: 'v',
    onValue: 1,
    offValue: 0,
  },
  enabled: true,
  connectionStatus: 'UNKNOWN',
};

/**
 * 模擬環境的 18 路回路到 Relay 通道的映射
 *
 * 在 Simulation 環境中，所有 18 路都映射到同一台 mock relay。
 * 實機環境下，根據實際硬體配置調整此映射。
 */
export const SIMULATION_CIRCUIT_TO_RELAY_MAPPING: Record<string, {
  deviceId: string;
  macId: string;
  channel: number;
  onValue: number;
  offValue: number;
}> = {
  '01': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 1, onValue: 1, offValue: 0 },
  '02': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 2, onValue: 1, offValue: 0 },
  '03': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 3, onValue: 1, offValue: 0 },
  '04': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 4, onValue: 1, offValue: 0 },
  '05': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 5, onValue: 1, offValue: 0 },
  '06': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 6, onValue: 1, offValue: 0 },
  '07': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 7, onValue: 1, offValue: 0 },
  '08': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 8, onValue: 1, offValue: 0 },
  '09': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 9, onValue: 1, offValue: 0 },
  '10': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 10, onValue: 1, offValue: 0 },
  '11': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 11, onValue: 1, offValue: 0 },
  '12': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 12, onValue: 1, offValue: 0 },
  '13': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 13, onValue: 1, offValue: 0 },
  '14': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 14, onValue: 1, offValue: 0 },
  '15': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 15, onValue: 1, offValue: 0 },
  '16': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 16, onValue: 1, offValue: 0 },
  '17': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 17, onValue: 1, offValue: 0 },
  '18': { deviceId: 'sim-relay-001', macId: '00:01:02:03:04:05', channel: 18, onValue: 1, offValue: 0 },
};

/**
 * 建立 MQTT Topic 字符串
 *
 * @param template 模板字符串，例如 "{prefix}/ctl/do{channel}"
 * @param prefix MQTT Topic 前綴，例如 "Advantech/00-01-02-03-04-05"
 * @param channel 通道編號，例如 1
 * @returns 完整 topic，例如 "Advantech/00-01-02-03-04-05/ctl/do1"
 */
export function buildMqttTopic(template: string, prefix: string, channel?: number): string {
  let result = template.replace('{prefix}', prefix);
  if (channel !== undefined) {
    result = result.replace('{channel}', String(channel));
  }
  return result;
}

/**
 * 驗證裝置配置的完整性
 *
 * 檢查必要欄位是否完整；不驗證實際連線能力。
 */
export function validateDeviceConfig(config: DeviceAdapterConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.id) errors.push('設備 ID 必填');
  if (!config.name) errors.push('設備名稱必填');
  if (!config.deviceType) errors.push('設備型號必填');
  if (!config.macId) errors.push('MAC ID 必填');
  if (!config.mqtt.brokerUrl) errors.push('MQTT Broker URL 必填');
  if (!config.mqttTopicPrefix) errors.push('MQTT Topic 前綴必填');
  if (config.totalChannels <= 0) errors.push('通道數必須 > 0');
  if (!config.controlTopicTemplate) errors.push('控制 Topic 模板必填');
  if (!config.statusTopic) errors.push('狀態 Topic 必填');
  if (!config.stateMapping.valueField) errors.push('狀態值欄位名稱必填');
  if (config.stateMapping.onValue === undefined) errors.push('ON 值必填');
  if (config.stateMapping.offValue === undefined) errors.push('OFF 值必填');

  return { valid: errors.length === 0, errors };
}
