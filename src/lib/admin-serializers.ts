/** 後台 API 的輸出序列化：把 Prisma 列轉成前端 models.ts 的形狀（日期為 ISO 字串）。 */

export function serializeExpense(e: {
  id: string
  expenseNumber: string
  category: string
  amount: number
  status: string
  description: string
  submittedAt: Date
  approvedAt: Date | null
  approvedBy: string | null
  receipt?: { id: string; receiptNumber: string; amount: number; issueDate: Date; paymentMethod: string; vendorName: string; ocrStatus: string | null; ocrFields: unknown; ocrConfidence: number | null } | null
}) {
  return {
    id: e.id,
    expenseNumber: e.expenseNumber,
    category: e.category,
    amount: e.amount,
    status: e.status,
    description: e.description,
    submittedAt: e.submittedAt.toISOString(),
    approvedAt: e.approvedAt?.toISOString(),
    approvedBy: e.approvedBy ?? undefined,
    receipt: e.receipt
      ? {
          id: e.receipt.id,
          receiptNumber: e.receipt.receiptNumber,
          paymentId: '',
          amount: e.receipt.amount,
          issueDate: e.receipt.issueDate.toISOString(),
          paymentMethod: e.receipt.paymentMethod,
          vendorName: e.receipt.vendorName,
          ocrData: e.receipt.ocrStatus
            ? { status: e.receipt.ocrStatus, fields: (e.receipt.ocrFields as Record<string, string>) ?? {}, confidence: e.receipt.ocrConfidence ?? 0 }
            : undefined,
        }
      : undefined,
  }
}

export function serializeReceipt(r: {
  id: string
  receiptNumber: string
  paymentId: string | null
  amount: number
  issueDate: Date
  paymentMethod: string
  vendorName: string
  ocrStatus: string | null
  ocrFields: unknown
  ocrConfidence: number | null
}) {
  return {
    id: r.id,
    receiptNumber: r.receiptNumber,
    paymentId: r.paymentId ?? '',
    amount: r.amount,
    issueDate: r.issueDate.toISOString(),
    paymentMethod: r.paymentMethod,
    vendorName: r.vendorName,
    ocrData: r.ocrStatus ? { status: r.ocrStatus, fields: (r.ocrFields as Record<string, string>) ?? {}, confidence: r.ocrConfidence ?? 0 } : undefined,
  }
}

export function serializeInvoice(i: {
  id: string
  invoiceNumber: string
  userId: string | null
  bookingId: string | null
  issueDate: Date
  dueDate: Date
  amount: number
  status: string
  items: unknown
  user?: { displayName: string } | null
  booking?: { code: string } | null
}) {
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    memberId: i.userId ?? '',
    memberName: i.user?.displayName,
    reservationId: i.booking?.code ?? i.bookingId ?? '',
    bookingCode: i.booking?.code,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    amount: i.amount,
    status: i.status,
    items: Array.isArray(i.items) ? i.items : [],
  }
}
