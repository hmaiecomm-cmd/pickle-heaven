'use server'

import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { PermissionError, requirePermission, type AdminContext } from '@/lib/admin-auth'
import { can, type Permission } from '@/lib/admin-permissions'
import { getOrderDetail, listOrders, maskOrderDetailAmounts, maskOrderListAmounts, type OrderDetail, type OrderListResult } from './admin-orders'
import { executeRefund, getRefundOptions, markManualRefundDone, RefundError, type RefundOptions, type RefundResultView } from './refund-service'
import { InvoiceActionError, resendInvoice, voidAndReissue } from './invoice-service'
import {
  DeviceCommandError,
  detectIncidents,
  getMonitorSnapshot,
  listIncidents,
  previewDeviceCommand,
  refreshDeviceCommand,
  sendDeviceCommand,
  updateIncident,
  type MonitorSnapshot,
} from './monitor-service'

/** 後台營運操作。每個動作在伺服器端檢查權限；AI 助理呼叫的也是同一組動作。 */

type R<T> = ({ ok: true } & T) | { ok: false; error: string }

async function guard<T>(permission: Permission, fn: (actor: string, ctx: AdminContext) => Promise<T>): Promise<R<{ data: T }>> {
  try {
    const ctx = await requirePermission(permission)
    return { ok: true, data: await fn(`admin:${ctx.username}`, ctx) }
  } catch (err) {
    if (err instanceof PermissionError) return { ok: false, error: '目前帳號沒有這項操作的權限' }
    if (err instanceof RefundError || err instanceof InvoiceActionError || err instanceof DeviceCommandError) return { ok: false, error: err.message }
    if (err instanceof ZodError) return { ok: false, error: err.errors[0]?.message ?? '輸入資料有誤' }
    if (err && typeof err === 'object' && 'digest' in err) throw err // redirect 等 Next 控制流程
    console.error('[admin-ops]', err)
    return { ok: false, error: err instanceof Error ? err.message : '系統忙碌中，請稍後再試' }
  }
}

export async function searchOrdersAction(query: unknown): Promise<R<{ data: OrderListResult }>> {
  return guard('bookings', async (_a, ctx) => {
    const r = await listOrders(query)
    return can(ctx.role, 'finance') ? r : maskOrderListAmounts(r)
  })
}

export async function orderDetailAction(id: string): Promise<R<{ data: OrderDetail | null }>> {
  return guard('bookings', async (_a, ctx) => {
    const d = await getOrderDetail(id)
    return !d || can(ctx.role, 'finance') ? d : maskOrderDetailAmounts(d)
  })
}

export async function refundOptionsAction(bookingId: string): Promise<R<{ data: RefundOptions }>> {
  return guard('refund', () => getRefundOptions(bookingId))
}

const refundSchema = z.object({
  bookingId: z.string().min(1),
  itemIds: z.array(z.string()).min(1, '請選擇要退款的項目'),
  method: z.enum(['ORIGINAL', 'POINTS', 'MANUAL']),
  cancelItems: z.boolean(),
  reason: z.string().trim().min(1, '請填寫退款原因').max(300),
  idempotencyKey: z.string().min(8).max(80),
  expectedCash: z.number().int().min(0),
  expectedPoints: z.number().int().min(0),
})

export async function refundAction(input: z.infer<typeof refundSchema>): Promise<R<{ data: RefundResultView }>> {
  return guard('refund', async (actor) => {
    const res = await executeRefund({ ...refundSchema.parse(input), actor })
    revalidatePath('/admin/bookings')
    revalidatePath('/admin/refunds')
    return res
  })
}

export async function manualRefundDoneAction(refundId: string, note: string): Promise<R<{ data: true }>> {
  return guard('refund', async (actor) => {
    await markManualRefundDone(refundId, note, actor)
    revalidatePath('/admin/refunds')
    return true as const
  })
}

export async function invoiceResendAction(invoiceId: string, idempotencyKey: string) {
  return guard('invoice', async (actor) => {
    const r = await resendInvoice({ invoiceId, idempotencyKey, actor })
    return { status: r.event.status, simulated: r.event.simulated, duplicate: r.duplicate }
  })
}

export async function invoiceVoidReissueAction(params: { invoiceId: string; reason: string; recipientEmail?: string | null; idempotencyKey: string }) {
  return guard('invoice', async (actor) => {
    const r = await voidAndReissue({ ...params, actor })
    return { status: r.event.status, simulated: r.event.simulated, duplicate: r.duplicate }
  })
}

export async function monitorAction(): Promise<R<{ data: MonitorSnapshot | null }>> {
  return guard('monitor', () => getMonitorSnapshot())
}

export async function devicePreviewAction(deviceId: string, action: string) {
  return guard('device.control', () => previewDeviceCommand(deviceId, action))
}

export async function deviceSendAction(params: { deviceId: string; action: string; idempotencyKey: string; reason: string }) {
  return guard('device.control', async (actor) => {
    const c = await sendDeviceCommand({ ...params, actor })
    return { id: c.id, status: c.status, simulated: c.simulated }
  })
}

export async function deviceCommandStatusAction(id: string) {
  return guard('monitor', async () => {
    const c = await refreshDeviceCommand(id)
    return { id: c.id, status: c.status, error: c.error, simulated: c.simulated }
  })
}

export async function incidentsAction(status: 'OPEN' | 'ALL') {
  return guard('monitor', async () => {
    await detectIncidents()
    const rows = await listIncidents(status)
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), resolvedAt: r.resolvedAt?.toISOString() ?? null }))
  })
}

export async function incidentUpdateAction(id: string, status: 'ACKED' | 'RESOLVED', note: string) {
  return guard('monitor', async (actor) => {
    await updateIncident(id, status, note, actor)
    revalidatePath('/admin/incidents')
    revalidatePath('/admin')
    return true as const
  })
}
