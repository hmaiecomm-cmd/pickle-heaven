import 'server-only'
import { prisma } from '@/lib/db'
import {
  EMPTY_DRAFT,
  parseEndDate,
  parseStartDate,
  validateDraft,
  type FieldErrors,
  type MarketingDraft,
  type MarketingKind,
} from '@/lib/marketing-content'

export const KINDS: MarketingKind[] = ['banners', 'cards', 'announcements']
export const isKind = (v: string): v is MarketingKind => (KINDS as string[]).includes(v)

/** 只取表單欄位，其餘一律忽略 */
export function readDraft(input: unknown): MarketingDraft {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const str = (k: keyof MarketingDraft) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  return {
    ...EMPTY_DRAFT,
    title: str('title'),
    description: str('description'),
    content: str('content'),
    imageAssetId: typeof o.imageAssetId === 'string' && o.imageAssetId ? o.imageAssetId : null,
    buttonText: str('buttonText'),
    buttonUrl: str('buttonUrl'),
    startAt: str('startAt'),
    endAt: str('endAt'),
  }
}

export async function checkDraft(kind: MarketingKind, d: MarketingDraft): Promise<FieldErrors> {
  const errors = validateDraft(kind, d)
  if (kind !== 'announcements' && d.imageAssetId) {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: d.imageAssetId }, select: { id: true } })
    if (!asset) errors.imageAssetId = '圖片不存在或上傳未完成，請重新上傳'
  }
  return errors
}

function bannerCols(d: MarketingDraft) {
  return {
    title: d.title.trim(),
    subtitle: d.description.trim() || null,
    imageAssetId: d.imageAssetId,
    buttonText: d.buttonText.trim() || null,
    buttonUrl: d.buttonUrl.trim() || null,
    startAt: parseStartDate(d.startAt),
    endAt: parseEndDate(d.endAt),
  }
}

function cardCols(d: MarketingDraft) {
  const { subtitle, ...rest } = bannerCols(d)
  return { ...rest, description: subtitle }
}

function annCols(d: MarketingDraft) {
  return { title: d.title.trim(), content: d.content.trim(), startAt: parseStartDate(d.startAt), endAt: parseEndDate(d.endAt) }
}

/** 寫入的場館：帳號綁定場館時只能寫該場館，否則用第一個啟用中的場館 */
export async function resolveVenue(scopeVenueId: string | null) {
  return prisma.venue.findFirst({
    where: scopeVenueId ? { id: scopeVenueId } : { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, organizationId: true },
  })
}

const scope = (id: string, venueId: string | null) => ({ id, deletedAt: null, ...(venueId ? { venueId } : {}) })

/** 新建一律是草稿（active false），發布是獨立操作 */
export async function createItem(kind: MarketingKind, d: MarketingDraft, venue: { id: string; organizationId: string }) {
  const base = { organizationId: venue.organizationId, venueId: venue.id, active: false }
  if (kind === 'banners') return prisma.marketingBanner.create({ data: { ...base, ...bannerCols(d) }, select: { id: true } })
  if (kind === 'cards') return prisma.promotionCard.create({ data: { ...base, ...cardCols(d) }, select: { id: true } })
  return prisma.announcement.create({ data: { ...base, ...annCols(d) }, select: { id: true } })
}

export async function findItem(kind: MarketingKind, id: string, venueId: string | null) {
  const where = scope(id, venueId)
  const select = { id: true, active: true, title: true }
  if (kind === 'banners') return prisma.marketingBanner.findFirst({ where, select })
  if (kind === 'cards') return prisma.promotionCard.findFirst({ where, select })
  return prisma.announcement.findFirst({ where, select })
}

/** 內容更新、發布狀態、刪除共用；呼叫前須先以 findItem 確認在權限範圍內 */
export async function updateItem(kind: MarketingKind, id: string, data: Record<string, unknown>) {
  if (kind === 'banners') return prisma.marketingBanner.update({ where: { id }, data, select: { id: true } })
  if (kind === 'cards') return prisma.promotionCard.update({ where: { id }, data, select: { id: true } })
  return prisma.announcement.update({ where: { id }, data, select: { id: true } })
}

export function contentColumns(kind: MarketingKind, d: MarketingDraft) {
  if (kind === 'banners') return bannerCols(d)
  if (kind === 'cards') return cardCols(d)
  return annCols(d)
}

/** 資料庫寫入失敗時回給後台的具體訊息（不外洩內部細節） */
export function writeFailureMessage(err: unknown): string {
  const msg = err instanceof Error ? `${err.message} ${String((err as { cause?: unknown }).cause ?? '')}` : String(err)
  if (/timeout|fetch failed|ECONN|ENOTFOUND|network/i.test(msg)) return '資料庫連線逾時，內容尚未儲存，請稍後再按一次儲存'
  if (/no such table/i.test(msg)) return '資料庫尚未建立行銷資料表，請聯絡系統管理員套用遷移'
  if (/FOREIGN KEY/i.test(msg)) return '關聯資料不存在（場館或圖片可能已被刪除），請重新整理後再試'
  return '資料庫寫入失敗，內容尚未儲存，請稍後再試'
}
