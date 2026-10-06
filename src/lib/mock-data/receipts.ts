import { Receipt } from '../models'

export const mockReceipts: Receipt[] = [
  {
    id: 'receipt-1',
    receiptNumber: 'RCP-2024-001',
    paymentId: 'pay-1',
    amount: 1000,
    issueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    paymentMethod: 'CREDIT_CARD',
    vendorName: 'Pickleball Paradise',
  },
  {
    id: 'receipt-2',
    receiptNumber: 'RCP-2024-002',
    paymentId: 'pay-3',
    amount: 300,
    issueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    paymentMethod: 'CREDIT_CARD',
    vendorName: 'Pickleball Paradise',
  },
]
