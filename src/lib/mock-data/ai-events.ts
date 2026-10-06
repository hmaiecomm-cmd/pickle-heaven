import { AIEvent } from '../models'

export const mockAIEvents: AIEvent[] = [
  {
    id: 'ai-event-1',
    type: 'UNAUTHORIZED_USAGE',
    severity: 'HIGH',
    courtId: 'court-2',
    description: '未預約時段偵測到3名人員使用 Court 2',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    resolved: false,
    detailedAnalysis: '根據多台攝像頭的人員追蹤，確認在 18:30-19:15 有3名人員在 Court 2 進行匹克球活動，但該時段無有效預約。',
  },
  {
    id: 'ai-event-2',
    type: 'CAMERA_OFFLINE',
    severity: 'MEDIUM',
    courtId: 'court-1',
    description: '攝像頭 CAM-1-NW 已離線超過 15 分鐘',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    resolved: false,
  },
  {
    id: 'ai-event-3',
    type: 'DEVICE_OFFLINE',
    severity: 'MEDIUM',
    description: 'Court 4 的門禁系統已離線',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    resolved: true,
  },
]
