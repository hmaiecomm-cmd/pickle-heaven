import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { audit, badRequest, notFound, readJson, requireAdminApi, toInt, unauthorized } from '@/lib/admin-api'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = Partial<{
  name: string
  address: string
  phone: string
  description: string
  notice: string
  policy: string
  openMinute: unknown
  closeMinute: unknown
  bookAheadDays: unknown
  holdMinutes: unknown
}>

const LABEL: Record<string, string> = {
  name: '場館名稱',
  address: '地址',
  phone: '電話',
  description: '簡介',
  notice: '公告',
  policy: '取消政策說明',
  openMinute: '營業開始',
  closeMinute: '營業結束',
  bookAheadDays: '可預約天數',
  holdMinutes: '購物車保留時間',
}

/**
 * 更新場館設定（部分欄位）。時段長度與時區不開放修改，避免打亂既有預約。
 * 營業時間必須是時段長度的整數倍；修改後前台與後台排程頁立即生效。
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApi()
  if (!admin) return unauthorized()
  const { id } = await params
  const body = await readJson<Body>(req)
  if (!body) return badRequest('缺少內容')

  const venue = await prisma.venue.findUnique({ where: { id } })
  if (!venue) return notFound('找不到場館')

  const data: Record<string, string | number | null> = {}

  const text = (key: 'name' | 'address' | 'phone', max: number, required: boolean) => {
    if (body[key] === undefined) return null
    const v = String(body[key]).trim()
    if (required && !v) return `${LABEL[key]}不可空白`
    if (v.length > max) return `${LABEL[key]}最多 ${max} 字`
    data[key] = v
    return null
  }
  const longText = (key: 'description' | 'notice' | 'policy') => {
    if (body[key] === undefined) return null
    const v = String(body[key]).trim()
    if (v.length > 2000) return `${LABEL[key]}最多 2000 字`
    data[key] = v || null
    return null
  }
  const int = (key: 'openMinute' | 'closeMinute' | 'bookAheadDays' | 'holdMinutes', min: number, max: number) => {
    if (body[key] === undefined) return null
    const n = toInt(body[key])
    if (n === null || n < min || n > max) return `${LABEL[key]}需介於 ${min} 到 ${max}`
    data[key] = n
    return null
  }

  const err =
    text('name', 60, true) ??
    text('address', 200, false) ??
    text('phone', 40, false) ??
    longText('description') ??
    longText('notice') ??
    longText('policy') ??
    int('openMinute', 0, 1439) ??
    int('closeMinute', 1, 2880) ??
    int('bookAheadDays', 1, 90) ??
    int('holdMinutes', 3, 60)
  if (err) return badRequest(err)

  const open = (data.openMinute as number | undefined) ?? venue.openMinute
  const close = (data.closeMinute as number | undefined) ?? venue.closeMinute
  if (close <= open) return badRequest('營業結束必須晚於營業開始')
  if ((close - open) % venue.slotMinutes !== 0) return badRequest(`營業時間長度必須是 ${venue.slotMinutes} 分鐘的整數倍`)

  const changed = Object.keys(data).filter((k) => (venue as Record<string, unknown>)[k] !== data[k])
  if (changed.length === 0) return NextResponse.json({ success: true, data: { id, changed: [] } })

  await prisma.venue.update({ where: { id }, data })
  await audit(admin, 'VENUE_UPDATE', id, {
    name: venue.name,
    fields: changed.map((k) => LABEL[k] ?? k),
    from: Object.fromEntries(changed.map((k) => [k, (venue as Record<string, unknown>)[k]])),
    to: Object.fromEntries(changed.map((k) => [k, data[k]])),
  })

  revalidatePath('/booking')
  revalidatePath('/admin')
  revalidatePath('/admin/schedule')
  return NextResponse.json({ success: true, data: { id, changed } })
}
