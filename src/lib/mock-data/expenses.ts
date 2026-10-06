import { Expense } from '../models'

export const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    expenseNumber: 'EXP-2024-001',
    category: 'MAINTENANCE',
    amount: 5000,
    status: 'APPROVED',
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    approvedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    description: '球場地板打蠟保養',
  },
  {
    id: 'exp-2',
    expenseNumber: 'EXP-2024-002',
    category: 'UTILITIES',
    amount: 8000,
    status: 'SUBMITTED',
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    description: '電費 - 10月',
  },
  {
    id: 'exp-3',
    expenseNumber: 'EXP-2024-003',
    category: 'SUPPLIES',
    amount: 2500,
    status: 'DRAFT',
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    description: '球拍、球等消耗品採購',
  },
]
