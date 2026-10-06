import { Revenue } from '../models'

const now = new Date()

export const mockRevenue: Revenue[] = [
  {
    id: 'rev-1',
    date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    courtId: 'court-1',
    type: 'COURT',
    reservationId: 'res-1',
    amount: 1000,
    paymentMethod: 'CREDIT_CARD',
  },
  {
    id: 'rev-2',
    date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    courtId: 'court-2',
    type: 'COURT',
    reservationId: 'res-3',
    amount: 1000,
    paymentMethod: 'CREDIT_CARD',
  },
  {
    id: 'rev-3',
    date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    type: 'EVENT',
    reservationId: 'res-2',
    amount: 300,
    paymentMethod: 'LINE_PAY',
  },
  {
    id: 'rev-4',
    date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
    courtId: 'court-1',
    type: 'COURT',
    reservationId: 'res-1',
    amount: 1500,
    paymentMethod: 'CREDIT_CARD',
  },
]
