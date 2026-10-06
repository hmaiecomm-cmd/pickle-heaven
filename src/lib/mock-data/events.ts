import { Event } from '../models'

export const mockEvents: Event[] = [
  {
    id: 'event-1',
    name: '周六友誼賽',
    description: '每週六的標準友誼賽',
    venueId: 'venue-1',
    type: 'SOCIAL',
    status: 'PUBLISHED',
    startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    capacity: 16,
    enrolled: 12,
    price: 300,
  },
  {
    id: 'event-2',
    name: 'LEVEL 3+ 訓練課程',
    description: '針對進階選手的訓練課程',
    venueId: 'venue-1',
    type: 'TRAINING',
    status: 'PUBLISHED',
    startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    capacity: 8,
    enrolled: 6,
    price: 600,
  },
]
