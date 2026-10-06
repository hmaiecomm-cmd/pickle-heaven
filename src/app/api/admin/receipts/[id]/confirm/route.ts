import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, requireAdminApi, unauthorized } from '@/lib/admin-api'
import { serializeReceipt } from '@/lib/admin-serializers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 人工確認 OCR 辨識結果。只標示 CONFIRMED，不建立任何費用或分錄。 */
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()
  const { id } = await params
  const current = await prisma.receipt.findUnique({ where: { id }, select: { ocrStatus: true, receiptNumber: true } })
  if (!current) return notFound('找不到收據')
  if (current.ocrStatus !== 'DRAFT') return badRequest('這張收據不是 OCR 草稿')
  const row = await prisma.receipt.update({ where: { id }, data: { ocrStatus: 'CONFIRMED' } })
  await audit(admin, 'RECEIPT_OCR_CONFIRM', id, { receiptNumber: current.receiptNumber })
  return NextResponse.json({ success: true, data: serializeReceipt(row) })
}
