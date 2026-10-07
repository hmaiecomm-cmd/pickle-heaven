import 'server-only'
import { isDemoTenant, prisma } from '@/lib/db'
import { now } from '@/lib/time'

/**
 * 發票補寄與作廢重開。
 *
 * 正式環境目前沒有串接電子發票服務商與寄送服務：兩項操作都會被擋下並明確說明，不會假裝完成。
 * 展示環境使用隔離的模擬服務，結果一律標示「模擬」。
 *
 * - 補寄只寄送既有發票，不會重新開立。
 * - 作廢重開：原發票處理中（異動中）時不能再送；保存原單據與新單據的關聯（replacedById）。
 * - idempotencyKey 防止連點或重送造成重複寄送或重複開立。
 * - 退款與發票異動各自追蹤，退款完成不代表發票已處理。
 */

export class InvoiceActionError extends Error {}

const TX = { maxWait: 15_000, timeout: 30_000 }

export async function invoiceIntegration(): Promise<{ connected: boolean; simulated: boolean; label: string; reason: string | null }> {
  if (await isDemoTenant()) return { connected: true, simulated: true, label: '模擬發票服務（展示環境）', reason: null }
  if (process.env.EINVOICE_PROVIDER) {
    // 尚未實作任何服務商轉接；即使設定了也不假裝可用
    return { connected: false, simulated: false, label: process.env.EINVOICE_PROVIDER, reason: `已設定 ${process.env.EINVOICE_PROVIDER}，但系統尚未實作該服務商的串接` }
  }
  return { connected: false, simulated: false, label: '未串接', reason: '尚未串接電子發票服務商與寄送服務，無法補寄或作廢重開' }
}

export async function resendInvoice(params: { invoiceId: string; idempotencyKey: string; actor: string }) {
  const integ = await invoiceIntegration()
  const inv = await prisma.invoice.findUnique({ where: { id: params.invoiceId }, include: { user: { select: { email: true } } } })
  if (!inv) throw new InvoiceActionError('找不到發票')
  const existing = await prisma.invoiceEvent.findUnique({ where: { idempotencyKey: params.idempotencyKey } })
  if (existing) return { event: existing, duplicate: true }
  if (!integ.connected) throw new InvoiceActionError(integ.reason ?? '發票服務未串接')
  if (inv.providerStatus === 'VOIDED') throw new InvoiceActionError('這張發票已作廢，請補寄新開立的發票')
  const email = inv.recipientEmail ?? inv.user?.email
  if (!email) throw new InvoiceActionError('沒有收件 Email，無法補寄')

  const event = await prisma.invoiceEvent.create({
    data: {
      invoiceId: inv.id,
      type: 'RESEND',
      idempotencyKey: params.idempotencyKey,
      status: integ.simulated ? 'SUCCEEDED' : 'PROCESSING',
      simulated: integ.simulated,
      detail: { email, number: inv.invoiceNumber },
      createdBy: params.actor,
      completedAt: integ.simulated ? now() : null,
    },
  })
  await prisma.auditLog.create({ data: { actor: params.actor, action: 'INVOICE_RESEND', target: inv.invoiceNumber, detail: { email, simulated: integ.simulated } } })
  return { event, duplicate: false }
}

export async function voidAndReissue(params: {
  invoiceId: string
  reason: string
  recipientEmail?: string | null
  idempotencyKey: string
  actor: string
}) {
  if (!params.reason.trim()) throw new InvoiceActionError('請填寫異動原因')
  const integ = await invoiceIntegration()
  const existing = await prisma.invoiceEvent.findUnique({ where: { idempotencyKey: params.idempotencyKey } })
  if (existing) return { event: existing, duplicate: true }
  if (!integ.connected) throw new InvoiceActionError(integ.reason ?? '發票服務未串接')

  return prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: params.invoiceId }, data: { updatedAt: now() } }) // 寫入鎖
    const inv = await tx.invoice.findUnique({ where: { id: params.invoiceId }, include: { events: true } })
    if (!inv) throw new InvoiceActionError('找不到發票')
    if (inv.providerStatus === 'VOIDED' || inv.replacedById) throw new InvoiceActionError('這張發票已作廢並重開過')
    if (inv.providerStatus === 'MODIFYING' || inv.events.some((e) => e.status === 'PROCESSING')) {
      throw new InvoiceActionError('這張發票正在異動中，請等處理結果後再操作')
    }
    const event = await tx.invoiceEvent.create({
      data: {
        invoiceId: inv.id,
        type: 'VOID_REISSUE',
        idempotencyKey: params.idempotencyKey,
        status: 'PROCESSING',
        reason: params.reason.trim().slice(0, 300),
        simulated: integ.simulated,
        detail: { originalNumber: inv.invoiceNumber, recipientEmail: params.recipientEmail ?? inv.recipientEmail },
        createdBy: params.actor,
      },
    })
    // 模擬服務：作廢原發票，開立新發票並建立關聯
    const count = await tx.invoice.count({ where: { invoiceNumber: { startsWith: inv.invoiceNumber + '-R' } } })
    const reissued = await tx.invoice.create({
      data: {
        invoiceNumber: `${inv.invoiceNumber}-R${count + 1}`,
        userId: inv.userId,
        bookingId: inv.bookingId,
        dueDate: inv.dueDate,
        amount: inv.amount,
        status: inv.status,
        items: inv.items ?? [],
        provider: inv.provider ?? 'demo-simulator',
        providerStatus: 'ISSUED',
        recipientEmail: params.recipientEmail ?? inv.recipientEmail,
      },
    })
    await tx.invoice.update({ where: { id: inv.id }, data: { providerStatus: 'VOIDED', replacedById: reissued.id } })
    const done = await tx.invoiceEvent.update({ where: { id: event.id }, data: { status: 'SUCCEEDED', newInvoiceId: reissued.id, completedAt: now() } })
    await tx.auditLog.create({
      data: { actor: params.actor, action: 'INVOICE_VOID_REISSUE', target: inv.invoiceNumber, detail: { newNumber: reissued.invoiceNumber, reason: params.reason, simulated: integ.simulated } },
    })
    return { event: done, duplicate: false }
  }, TX)
}
