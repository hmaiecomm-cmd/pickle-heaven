import { Payment } from '../models'

export const mockPayments: Payment[] = [
  {
    id: 'pay-1',
    reservationId: 'res-1',
    amount: 1000,
    status: 'PAID',
    method: 'CREDIT_CARD',
    transactionId: 'TXN-2024-001',
    paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'pay-2',
    reservationId: 'res-2',
    amount: 1000,
    status: 'PENDING',
    method: 'LINE_PAY',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: 'pay-3',
    reservationId: 'res-3',
    amount: 300,
    status: 'PAID',
    method: 'CREDIT_CARD',
    transactionId: 'TXN-2024-002',
    paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
]
