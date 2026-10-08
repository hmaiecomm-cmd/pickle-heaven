import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AdminContext } from '@/lib/admin-auth'
import { can } from '@/lib/admin-permissions'
import { nextNumber } from '@/lib/admin-api'
import { taipeiDateString, taipeiToUtc } from '@/lib/time'

/**
 * 費用與收據（支出憑證登錄，不是對客戶開立銷售發票）。
 * - 附件存在私有資料表，讀取與下載都要驗證權限，沒有永久公開網址。
 * - 管理員與工作人員只能新增、查看本人的申請；擁有者看全部並審核。
 * - 建立費用與附件連結在同一交易內完成，不會存了費用卻遺失附件。
 * - 重複提交以 idempotencyKey 擋下；重複收據只提醒，不因金額相同就拒絕。
 * - 已核准資料的更正會留存歷史（ExpenseRevision），不無痕覆寫。
 * - OCR 尚未串接：不假裝辨識成功，欄位一律由人工填寫並確認。
 */

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024
export const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
const MAX_EDGE = 2000
const THUMB_WIDTH = 480
export const MAX_ATTACHMENTS = 6
export const EXPENSE_CATEGORIES = ['MAINTENANCE', 'SUPPLIES', 'UTILITIES', 'LABOR', 'OTHER'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export class ExpenseError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export const actorOf = (ctx: AdminContext) => `admin:${ctx.username}`
export const canReview = (ctx: AdminContext) => can(ctx.role, 'expenses.review')

/* ─────────────── 附件 ─────────────── */

export async function storeAttachment(file: File, ctx: AdminContext) {
  if (!ATTACHMENT_TYPES.includes(file.type as (typeof ATTACHMENT_TYPES)[number])) throw new ExpenseError('只接受 JPG、PNG、WebP 圖片或 PDF')
  if (file.size > MAX_ATTACHMENT_BYTES) throw new ExpenseError('檔案超過 8 MB，請先縮小再上傳')
  if (file.size < 256) throw new ExpenseError('檔案不完整，請重新上傳')
  const input = Buffer.from(await file.arrayBuffer())
  const sha256 = createHash('sha256').update(input).digest('hex')

  let bytes: Buffer = input
  let thumb: Buffer | null = null
  let width: number | null = null
  let height: number | null = null
  let mime = file.type
  if (file.type !== 'application/pdf') {
    try {
      const full = await sharp(input).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
      const t = await sharp(input).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer()
      bytes = full.data
      thumb = t
      width = full.info.width
      height = full.info.height
      mime = 'image/webp'
    } catch {
      throw new ExpenseError('無法讀取這張圖片，請確認檔案格式或重新拍攝')
    }
  } else if (!input.subarray(0, 5).toString('latin1').startsWith('%PDF-')) {
    throw new ExpenseError('PDF 檔案內容不正確')
  }
  const row = await prisma.expenseAttachment.create({
    data: { uploadedBy: actorOf(ctx), mime, sizeBytes: bytes.length, bytes: new Uint8Array(bytes), thumbBytes: thumb ? new Uint8Array(thumb) : null, width, height, originalName: file.name.slice(0, 120) || null, sha256 },
    select: { id: true, mime: true, sizeBytes: true, width: true, height: true, originalName: true, createdAt: true },
  })
  // 相同內容已上傳過（任何人）：提醒可能重複，但不拒絕
  const dupCount = await prisma.expenseAttachment.count({ where: { sha256, id: { not: row.id }, expenseId: { not: null } } })
  return { ...row, hasThumb: Boolean(thumb), duplicateOfExisting: dupCount > 0 }
}

/** 可讀取附件：擁有者（審核）或上傳者本人 */
export async function loadAttachment(id: string, ctx: AdminContext, variant: 'full' | 'thumb') {
  const a = await prisma.expenseAttachment.findUnique({ where: { id } })
  if (!a) throw new ExpenseError('找不到附件', 404)
  if (!canReview(ctx) && a.uploadedBy !== actorOf(ctx)) throw new ExpenseError('沒有權限查看這個附件', 403)
  const data = variant === 'thumb' && a.thumbBytes ? a.thumbBytes : a.bytes
  return { data: Buffer.from(data), mime: variant === 'thumb' && a.thumbBytes ? 'image/webp' : a.mime, name: a.originalName ?? `attachment-${a.id}` }
}

/** 旋轉 90 度（永久套用到檔案，供預覽後調整） */
export async function rotateAttachment(id: string, ctx: AdminContext, degrees: 90 | 180 | 270) {
  const a = await prisma.expenseAttachment.findUnique({ where: { id } })
  if (!a) throw new ExpenseError('找不到附件', 404)
  if (a.uploadedBy !== actorOf(ctx) && !canReview(ctx)) throw new ExpenseError('沒有權限修改這個附件', 403)
  if (a.expenseId) {
    const e = await prisma.expense.findUnique({ where: { id: a.expenseId }, select: { status: true } })
    if (e?.status === 'APPROVED' && !canReview(ctx)) throw new ExpenseError('已核准的費用附件不能修改', 403)
  }
  if (!a.mime.startsWith('image/')) throw new ExpenseError('PDF 不支援旋轉')
  const full = await sharp(Buffer.from(a.bytes)).rotate(degrees).webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
  const thumb = await sharp(full.data).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer()
  await prisma.expenseAttachment.update({ where: { id }, data: { bytes: new Uint8Array(full.data), thumbBytes: new Uint8Array(thumb), width: full.info.width, height: full.info.height, sizeBytes: full.data.length } })
  return { id, width: full.info.width, height: full.info.height }
}

/** 刪除尚未綁定費用的本人附件（放棄登錄時） */
export async function deleteLooseAttachment(id: string, ctx: AdminContext) {
  const a = await prisma.expenseAttachment.findUnique({ where: { id }, select: { uploadedBy: true, expenseId: true } })
  if (!a) return false
  if (a.expenseId) throw new ExpenseError('附件已綁定費用，請改由費用編輯移除')
  if (a.uploadedBy !== actorOf(ctx) && !canReview(ctx)) throw new ExpenseError('沒有權限', 403)
  await prisma.expenseAttachment.delete({ where: { id } })
  return true
}

/** 上傳後超過一天仍未綁定費用的附件清除 */
export async function pruneLooseAttachments() {
  const r = await prisma.expenseAttachment.deleteMany({ where: { expenseId: null, createdAt: { lt: new Date(Date.now() - 86_400_000) } } })
  return r.count
}

/* ─────────────── 重複提醒 ─────────────── */

export interface DuplicateHint { id: string; expenseNumber: string; amount: number; vendorName: string | null; expenseDate: string | null; docNumber: string | null; status: string; reason: string }

/** 重複收據提醒：同單據號碼、或同商家＋同日期＋同金額。只提醒，不拒絕。 */
export async function findDuplicateHints(input: { amount: number; vendorName?: string | null; expenseDate?: Date | null; docNumber?: string | null; excludeId?: string | null }, ctx: AdminContext): Promise<DuplicateHint[]> {
  const scope = canReview(ctx) ? {} : { submittedBy: actorOf(ctx) }
  const ors: Prisma.ExpenseWhereInput[] = []
  const doc = input.docNumber?.trim()
  if (doc) ors.push({ docNumber: doc })
  if (input.vendorName?.trim() && input.expenseDate) {
    // 以台北日期比對（支出日期可能是 UTC 午夜或任意時刻）
    const day = taipeiDateString(input.expenseDate)
    const d0 = taipeiToUtc(day, 0)
    const d1 = new Date(d0.getTime() + 86_400_000)
    ors.push({ vendorName: input.vendorName.trim(), amount: input.amount, expenseDate: { gte: d0, lt: d1 } })
  }
  if (ors.length === 0) return []
  const rows = await prisma.expense.findMany({ where: { ...scope, status: { not: 'REJECTED' }, OR: ors, ...(input.excludeId ? { id: { not: input.excludeId } } : {}) }, take: 5, orderBy: { createdAt: 'desc' } })
  return rows.map((r) => ({ id: r.id, expenseNumber: r.expenseNumber, amount: r.amount, vendorName: r.vendorName, expenseDate: r.expenseDate?.toISOString() ?? null, docNumber: r.docNumber, status: r.status, reason: doc && r.docNumber === doc ? '相同單據號碼' : '相同商家、日期與金額' }))
}

/* ─────────────── 建立與更新 ─────────────── */

export interface ExpenseInput {
  category: ExpenseCategory
  amount: number
  currency?: string
  description: string
  vendorName?: string | null
  expenseDate?: Date | null
  docNumber?: string | null
  attachmentIds?: string[]
  status?: 'DRAFT' | 'SUBMITTED'
  idempotencyKey?: string | null
}

function validate(input: ExpenseInput) {
  if (!EXPENSE_CATEGORIES.includes(input.category)) throw new ExpenseError('類別不正確')
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new ExpenseError('金額必須為大於 0 的整數')
  if (!input.description?.trim()) throw new ExpenseError('請填寫說明')
  if ((input.attachmentIds?.length ?? 0) > MAX_ATTACHMENTS) throw new ExpenseError(`附件最多 ${MAX_ATTACHMENTS} 張`)
  if (input.currency && !/^[A-Z]{3}$/.test(input.currency)) throw new ExpenseError('幣別格式不正確')
}

export const EXPENSE_INCLUDE = { attachments: { select: { id: true, mime: true, sizeBytes: true, width: true, height: true, originalName: true, createdAt: true } }, revisions: { orderBy: { createdAt: 'desc' as const }, take: 20 }, receipt: true } satisfies Prisma.ExpenseInclude

export async function createExpense(input: ExpenseInput, ctx: AdminContext) {
  validate(input)
  const actor = actorOf(ctx)
  if (input.idempotencyKey) {
    const existing = await prisma.expense.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: EXPENSE_INCLUDE })
    if (existing) return { expense: existing, duplicateSubmit: true }
  }
  const ids = [...new Set(input.attachmentIds ?? [])]
  if (ids.length > 0) {
    const atts = await prisma.expenseAttachment.findMany({ where: { id: { in: ids } }, select: { id: true, uploadedBy: true, expenseId: true } })
    if (atts.length !== ids.length) throw new ExpenseError('有附件上傳失敗或已被清除，請重新上傳')
    if (atts.some((a) => a.expenseId)) throw new ExpenseError('有附件已綁定其他費用')
    if (atts.some((a) => a.uploadedBy !== actor) && !canReview(ctx)) throw new ExpenseError('附件必須由申請人本人上傳', 403)
  }
  const status: ExpenseStatus = input.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT'
  const data = {
    category: input.category,
    amount: input.amount,
    currency: input.currency ?? 'TWD',
    status,
    description: input.description.trim(),
    vendorName: input.vendorName?.trim() || null,
    expenseDate: input.expenseDate ?? null,
    docNumber: input.docNumber?.trim() || null,
    submittedAt: new Date(),
    submittedBy: actor,
    idempotencyKey: input.idempotencyKey || null,
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // 費用與附件綁定在同一交易：任何一步失敗都不會留下沒有附件的費用
      const expense = await prisma.$transaction(async (tx) => {
        const number = await nextNumber('EXP', () => tx.expense.count({ where: { expenseNumber: { startsWith: `EXP-${new Date().getFullYear()}-` } } }))
        const row = await tx.expense.create({ data: { ...data, expenseNumber: number } })
        if (ids.length > 0) {
          const linked = await tx.expenseAttachment.updateMany({ where: { id: { in: ids }, expenseId: null }, data: { expenseId: row.id } })
          if (linked.count !== ids.length) throw new ExpenseError('附件綁定失敗，請重試')
        }
        return tx.expense.findUniqueOrThrow({ where: { id: row.id }, include: EXPENSE_INCLUDE })
      })
      await prisma.auditLog.create({ data: { actor, action: 'EXPENSE_CREATE', target: expense.id, detail: { expenseNumber: expense.expenseNumber, amount: expense.amount, status, attachments: ids.length } } })
      return { expense, duplicateSubmit: false }
    } catch (err) {
      if (err instanceof ExpenseError) throw err
      // 連點造成同一 idempotencyKey 同時寫入：第二筆撞唯一鍵，回傳第一筆
      if (input.idempotencyKey) {
        const existing = await prisma.expense.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: EXPENSE_INCLUDE })
        if (existing) return { expense: existing, duplicateSubmit: true }
      }
      if (attempt === 1) throw err // 流水號撞號重試一次後仍失敗
    }
  }
  throw new ExpenseError('建立費用失敗，請重試')
}

/** 可見性：擁有者全部；其他人只看本人 */
export function visibleWhere(ctx: AdminContext): Prisma.ExpenseWhereInput {
  return canReview(ctx) ? {} : { submittedBy: actorOf(ctx) }
}

export async function getExpense(id: string, ctx: AdminContext) {
  const e = await prisma.expense.findFirst({ where: { id, ...visibleWhere(ctx) }, include: EXPENSE_INCLUDE })
  if (!e) throw new ExpenseError('找不到費用或沒有權限', 404)
  return e
}

/**
 * 修改欄位：申請人只能改本人的草稿／退回；擁有者可改任何狀態。
 * 每次修改都寫入更正歷史；已核准的更正會保留核准狀態但留下紀錄。
 */
export async function updateExpense(id: string, patch: Partial<ExpenseInput> & { note?: string | null }, ctx: AdminContext) {
  const e = await getExpense(id, ctx)
  const actor = actorOf(ctx)
  if (!canReview(ctx)) {
    if (e.submittedBy !== actor) throw new ExpenseError('只能修改本人的申請', 403)
    if (e.status !== 'DRAFT' && e.status !== 'REJECTED') throw new ExpenseError('送審中或已核准的申請不能修改；請聯絡擁有者')
  }
  const next: ExpenseInput = {
    category: patch.category ?? (e.category as ExpenseCategory),
    amount: patch.amount ?? e.amount,
    currency: patch.currency ?? e.currency,
    description: patch.description ?? e.description,
    vendorName: patch.vendorName === undefined ? e.vendorName : patch.vendorName,
    expenseDate: patch.expenseDate === undefined ? e.expenseDate : patch.expenseDate,
    docNumber: patch.docNumber === undefined ? e.docNumber : patch.docNumber,
    attachmentIds: patch.attachmentIds ?? e.attachments.map((a) => a.id),
  }
  validate(next)
  const ids = [...new Set(next.attachmentIds ?? [])]
  const before = { category: e.category, amount: e.amount, currency: e.currency, description: e.description, vendorName: e.vendorName, expenseDate: e.expenseDate?.toISOString() ?? null, docNumber: e.docNumber, attachmentIds: e.attachments.map((a) => a.id) }
  const after = { category: next.category, amount: next.amount, currency: next.currency, description: next.description.trim(), vendorName: next.vendorName?.trim() || null, expenseDate: next.expenseDate?.toISOString() ?? null, docNumber: next.docNumber?.trim() || null, attachmentIds: ids }
  if (JSON.stringify(before) === JSON.stringify(after)) return e
  const updated = await prisma.$transaction(async (tx) => {
    // 新增的附件必須未綁定；移除的附件解除綁定但不刪除（保留歷史）
    const toAdd = ids.filter((x) => !before.attachmentIds.includes(x))
    const toRemove = before.attachmentIds.filter((x) => !ids.includes(x))
    if (toAdd.length) {
      const atts = await tx.expenseAttachment.findMany({ where: { id: { in: toAdd } }, select: { id: true, uploadedBy: true, expenseId: true } })
      if (atts.length !== toAdd.length || atts.some((a) => a.expenseId)) throw new ExpenseError('有附件無法綁定，請重新上傳')
      if (atts.some((a) => a.uploadedBy !== actor) && !canReview(ctx)) throw new ExpenseError('附件必須由申請人本人上傳', 403)
      await tx.expenseAttachment.updateMany({ where: { id: { in: toAdd }, expenseId: null }, data: { expenseId: e.id } })
    }
    if (toRemove.length) await tx.expenseAttachment.updateMany({ where: { id: { in: toRemove }, expenseId: e.id }, data: { expenseId: null } })
    await tx.expenseRevision.create({ data: { expenseId: e.id, changedBy: actor, note: patch.note?.trim() || (e.status === 'APPROVED' ? '核准後更正' : null), before, after } })
    await tx.expense.update({ where: { id: e.id }, data: { category: after.category, amount: after.amount, currency: after.currency, description: after.description, vendorName: after.vendorName, expenseDate: after.expenseDate ? new Date(after.expenseDate) : null, docNumber: after.docNumber } })
    return tx.expense.findUniqueOrThrow({ where: { id: e.id }, include: EXPENSE_INCLUDE })
  })
  await prisma.auditLog.create({ data: { actor, action: e.status === 'APPROVED' ? 'EXPENSE_CORRECT_APPROVED' : 'EXPENSE_UPDATE', target: e.id, detail: { expenseNumber: e.expenseNumber, before, after, note: patch.note ?? null } } })
  return updated
}

/** 狀態轉換：申請人 草稿→送審、退回→草稿；擁有者 送審→核准／退回（退回需說明） */
export async function setExpenseStatus(id: string, next: ExpenseStatus, ctx: AdminContext, note?: string | null) {
  const e = await getExpense(id, ctx)
  const actor = actorOf(ctx)
  const reviewer = canReview(ctx)
  const own = e.submittedBy === actor
  const allowed: Record<string, ExpenseStatus[]> = { DRAFT: ['SUBMITTED'], SUBMITTED: ['APPROVED', 'REJECTED', 'DRAFT'], REJECTED: ['DRAFT', 'SUBMITTED'], APPROVED: [] }
  if (!allowed[e.status]?.includes(next)) throw new ExpenseError(`無法從「${e.status}」變更為「${next}」`)
  if ((next === 'APPROVED' || next === 'REJECTED') && !reviewer) throw new ExpenseError('只有擁有者可以核准或退回', 403)
  if ((next === 'SUBMITTED' || next === 'DRAFT') && !own && !reviewer) throw new ExpenseError('只能操作本人的申請', 403)
  if (next === 'REJECTED' && !note?.trim()) throw new ExpenseError('退回時請填寫原因')
  if (next === 'APPROVED' && e.attachments.length === 0 && !note?.trim()) throw new ExpenseError('沒有附件的費用，核准時請填寫說明（例如：已核對紙本）')
  const row = await prisma.expense.update({
    where: { id },
    data: {
      status: next,
      approvedAt: next === 'APPROVED' ? new Date() : next === 'DRAFT' ? null : undefined,
      approvedBy: next === 'APPROVED' ? actor : next === 'DRAFT' ? null : undefined,
      reviewedAt: next === 'APPROVED' || next === 'REJECTED' ? new Date() : undefined,
      reviewNote: next === 'REJECTED' || next === 'APPROVED' ? note?.trim() || null : undefined,
      submittedAt: next === 'SUBMITTED' ? new Date() : undefined,
    },
    include: EXPENSE_INCLUDE,
  })
  await prisma.auditLog.create({ data: { actor, action: 'EXPENSE_STATUS', target: id, detail: { expenseNumber: e.expenseNumber, from: e.status, to: next, note: note ?? null } } })
  return row
}

export type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>

export function serializeExpenseRow(e: ExpenseRow) {
  return {
    id: e.id,
    expenseNumber: e.expenseNumber,
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    status: e.status,
    description: e.description,
    vendorName: e.vendorName,
    expenseDate: e.expenseDate?.toISOString() ?? null,
    docNumber: e.docNumber,
    submittedAt: e.submittedAt.toISOString(),
    submittedBy: e.submittedBy,
    approvedAt: e.approvedAt?.toISOString() ?? null,
    approvedBy: e.approvedBy,
    reviewedAt: e.reviewedAt?.toISOString() ?? null,
    reviewNote: e.reviewNote,
    attachments: e.attachments.map((a) => ({ id: a.id, mime: a.mime, sizeBytes: a.sizeBytes, width: a.width, height: a.height, originalName: a.originalName, isPdf: a.mime === 'application/pdf', createdAt: a.createdAt.toISOString() })),
    revisions: e.revisions.map((r) => ({ id: r.id, changedBy: r.changedBy, note: r.note, before: r.before, after: r.after, createdAt: r.createdAt.toISOString() })),
    legacyReceiptNumber: e.receipt?.receiptNumber ?? null,
  }
}
export type ExpenseDTO = ReturnType<typeof serializeExpenseRow>
