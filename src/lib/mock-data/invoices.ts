import { Invoice } from '../models'

export const mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2024-001',
    memberId: 'member-1',
    reservationId: 'res-1',
    issueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
    amount: 1000,
    status: 'PAID',
    items: [
      { description: 'Court 1 - 2小時', quantity: 1, unitPrice: 1000, amount: 1000 },
    ],
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-2024-002',
    memberId: 'member-2',
    reservationId: 'res-2',
    issueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    dueDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
    amount: 1500,
    status: 'ISSUED',
    items: [
      { description: 'Court 2 - 3小時', quantity: 1, unitPrice: 1500, amount: 1500 },
    ],
  },
]
