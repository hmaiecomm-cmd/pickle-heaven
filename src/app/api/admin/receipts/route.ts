import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { audit, badRequest, nextNumber, readJson, requireAdminApi, toDateOrNull, toInt, unauthorized } from '@/lib/admin-api'
import { serializeReceipt } from '@/lib/admin-serializers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  if (!(await requireAdminApi())) return unauthorized()
  const rows = await prisma.receipt.findMany({ orderBy: { issueDate: 'desc' }, take: 500 })
  return NextResponse.json({ success: true, data: rows.map(serializeReceipt), meta: { total: rows.length } })
}

/**
 * 建立 OCR 草稿收據。body: { amount, issueDate, vendorName, paymentMethod?, fields?, confidence? }
 * 一律以 ocrStatus = DRAFT 建立，絕不自動建立費用或會計分錄。
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()
  const body = await readJson<{ amount?: unknown; issueDate?: string; vendorName?: string; paymentMethod?: string; fields?: Record<string, string>; confidence?: number }>(req)
  if (!body) return badRequest('缺少內容')
  const amount = toInt(body.amount)
  if (amount === null || amount <= 0) return badRequest('金額必須大於 0')
  const issueDate = toDateOrNull(body.issueDate) ?? new Date()
  const vendorName = body.vendorName?.trim() || '未填寫'

  const create = async () =>
    prisma.receipt.create({
      data: {
        receiptNumber: await nextNumber('RCP', () => prisma.receipt.count({ where: { receiptNumber: { startsWith: `RCP-${new Date().getFullYear()}-` } } })),
        amount,
        issueDate,
        vendorName,
        paymentMethod: body.paymentMethod?.trim() || 'CASH',
        ocrStatus: 'DRAFT',
        ocrFields: body.fields ?? {},
        ocrConfidence: typeof body.confidence === 'number' ? body.confidence : 0.8,
      },
    })
  let row
  try {
    row = await create()
  } catch {
    row = await create()
  }
  await audit(admin, 'RECEIPT_OCR_DRAFT', row.id, { receiptNumber: row.receiptNumber, amount, vendorName })
  return NextResponse.json({ success: true, data: serializeReceipt(row) }, { status: 201 })
}
