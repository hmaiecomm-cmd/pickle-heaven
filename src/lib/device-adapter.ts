export type DeviceType = 'door' | 'lights' | 'fans' | 'camera' | 'speaker' | 'occupancy'

export type DeviceStatus = 'online' | 'offline'

export type CourtState = 'available' | 'reserved' | 'occupied' | 'unauthorized'

export interface Device {
  id: string
  type: DeviceType
  courtId: string
  status: DeviceStatus
  lastSeen: Date
}

export interface CourtDevice {
  door: Device
  lights: Device
  fans: Device
  cameras: Device[]
  speaker: Device
}

export interface CourtInfo {
  id: string
  name: string
  state: CourtState
  currentBooking?: {
    id: string
    startTime: string
    endTime: string
    players: string[]
  }
  devices: CourtDevice
  peopleDetected: number
  lastEvent?: {
    type: string
    time: Date
    description: string
  }
}

export interface SystemMode {
  mode: 'MOCK' | 'LIVE'
}

export const SYSTEM_MODE: SystemMode = {
  mode: process.env.SYSTEM_MODE === 'LIVE' ? 'LIVE' : 'MOCK',
}

export async function getDeviceStatus(deviceId: string): Promise<Device> {
  if (SYSTEM_MODE.mode === 'MOCK') {
    return getMockDeviceStatus(deviceId)
  }
  throw new Error('LIVE mode not implemented')
}

export async function controlDevice(
  deviceId: string,
  action: 'on' | 'off' | 'unlock' | 'lock',
): Promise<boolean> {
  if (SYSTEM_MODE.mode === 'MOCK') {
    console.log(`[MOCK] Device ${deviceId}: ${action}`)
    return true
  }
  throw new Error('LIVE mode not implemented')
}

function getMockDeviceStatus(deviceId: string): Device {
  const onlineChance = 0.95
  return {
    id: deviceId,
    type: 'door',
    courtId: 'court-1',
    status: Math.random() < onlineChance ? 'online' : 'offline',
    lastSeen: new Date(),
  }
}

export function getMockCourtInfo(courtId: string): CourtInfo {
  const courts: Record<string, CourtInfo> = {
    'court-1': {
      id: 'court-1',
      name: 'Court 1',
      state: 'occupied',
      currentBooking: {
        id: 'booking-1',
        startTime: '18:00',
        endTime: '20:00',
        players: ['Alice', 'Bob', 'Charlie', 'David'],
      },
      devices: {
        door: { id: 'door-1', type: 'door', courtId: 'court-1', status: 'online', lastSeen: new Date() },
        lights: { id: 'lights-1', type: 'lights', courtId: 'court-1', status: 'online', lastSeen: new Date() },
        fans: { id: 'fans-1', type: 'fans', courtId: 'court-1', status: 'online', lastSeen: new Date() },
        cameras: [
          { id: 'cam-1-nw', type: 'camera', courtId: 'court-1', status: 'online', lastSeen: new Date() },
          { id: 'cam-1-ne', type: 'camera', courtId: 'court-1', status: 'online', lastSeen: new Date() },
          { id: 'cam-1-sw', type: 'camera', courtId: 'court-1', status: 'online', lastSeen: new Date() },
          { id: 'cam-1-se', type: 'camera', courtId: 'court-1', status: 'online', lastSeen: new Date() },
        ],
        speaker: { id: 'speaker-1', type: 'speaker', courtId: 'court-1', status: 'online', lastSeen: new Date() },
      },
      peopleDetected: 4,
      lastEvent: {
        type: 'entry',
        time: new Date(Date.now() - 5 * 60_000),
        description: 'Players entered via QR code',
      },
    },
    'court-2': {
      id: 'court-2',
      name: 'Court 2',
      state: 'available',
      devices: {
        door: { id: 'door-2', type: 'door', courtId: 'court-2', status: 'online', lastSeen: new Date() },
        lights: { id: 'lights-2', type: 'lights', courtId: 'court-2', status: 'online', lastSeen: new Date() },
        fans: { id: 'fans-2', type: 'fans', courtId: 'court-2', status: 'online', lastSeen: new Date() },
        cameras: [
          { id: 'cam-2-nw', type: 'camera', courtId: 'court-2', status: 'online', lastSeen: new Date() },
          { id: 'cam-2-ne', type: 'camera', courtId: 'court-2', status: 'online', lastSeen: new Date() },
          { id: 'cam-2-sw', type: 'camera', courtId: 'court-2', status: 'online', lastSeen: new Date() },
          { id: 'cam-2-se', type: 'camera', courtId: 'court-2', status: 'online', lastSeen: new Date() },
        ],
        speaker: { id: 'speaker-2', type: 'speaker', courtId: 'court-2', status: 'online', lastSeen: new Date() },
      },
      peopleDetected: 0,
    },
  }

  return courts[courtId] || courts['court-1']
}

export interface AIEvent {
  id: string
  type:
    | 'unauthorized_entry'
    | 'unauthorized_usage'
    | 'night_intrusion'
    | 'door_forced'
    | 'invalid_qr'
    | 'camera_offline'
    | 'device_offline'
    | 'people_count_mismatch'
  courtId?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  description: string
  resolved: boolean
  snapshot?: string
}

export function getMockAIEvents(): AIEvent[] {
  return [
    {
      id: 'event-1',
      type: 'unauthorized_usage',
      courtId: 'court-2',
      severity: 'high',
      timestamp: new Date(Date.now() - 2 * 60_000),
      description: '未預約時段偵測到3名人員使用場地',
      resolved: false,
    },
    {
      id: 'event-2',
      type: 'camera_offline',
      courtId: 'court-1',
      severity: 'medium',
      timestamp: new Date(Date.now() - 15 * 60_000),
      description: '攝像頭 CAM-1-NW 離線',
      resolved: false,
    },
  ]
}
