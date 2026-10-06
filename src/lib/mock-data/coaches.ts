import { Coach } from '../models'

export const mockCoaches: Coach[] = [
  {
    id: 'coach-1',
    name: '王教練',
    email: 'coach.wang@example.com',
    phone: '0912-111-111',
    status: 'ACTIVE',
    specialties: ['基礎教學', '進階技巧', '比賽策略'],
    hourlyRate: 1000,
    availability: [
      { dayOfWeek: 1, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
      { dayOfWeek: 5, startTime: '10:00', endTime: '18:00' },
    ],
  },
  {
    id: 'coach-2',
    name: '李教練',
    email: 'coach.li@example.com',
    phone: '0912-111-112',
    status: 'ACTIVE',
    specialties: ['兒童教學', '親子課程'],
    hourlyRate: 800,
    availability: [
      { dayOfWeek: 2, startTime: '14:00', endTime: '20:00' },
      { dayOfWeek: 4, startTime: '14:00', endTime: '20:00' },
      { dayOfWeek: 6, startTime: '10:00', endTime: '18:00' },
    ],
  },
]
