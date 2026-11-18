/**
 * 前台行銷內容（橫幅、宣傳卡片、公告）的欄位定義與驗證，後台表單與 API 共用同一套規則。
 * 草稿 = active false，前台只讀取 active true 且在顯示期間內的資料。
 */

export type MarketingKind = 'banners' | 'cards' | 'announcements'

export const KIND_LABEL: Record<MarketingKind, string> = {
  banners: '首頁橫幅',
  cards: '宣傳卡片',
  announcements: '網站公告',
}

export interface MarketingDraft {
  title: string
  /** 橫幅副標題、卡片說明 */
  description: string
  /** 公告內文 */
  content: string
  imageAssetId: string | null
  buttonText: string
  buttonUrl: string
  /** 顯示期間 YYYY-MM-DD（台北時間），空字串 = 不限；結束日當天整天都會顯示 */
  startAt: string
  endAt: string
}

export const EMPTY_DRAFT: MarketingDraft = {
  title: '',
  description: '',
  content: '',
  imageAssetId: null,
  buttonText: '',
  buttonUrl: '',
  startAt: '',
  endAt: '',
}

export const LIMITS = { title: 40, description: 120, content: 1000, buttonText: 12, buttonUrl: 500 }

export type FieldErrors = Partial<Record<keyof MarketingDraft, string>>

/** 站內路徑（/booking）或 https 網址；禁止 javascript: 等協定 */
export function isSafeUrl(url: string): boolean {
  if (/^\/(?!\/)[^\s]*$/.test(url)) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && Boolean(u.hostname)
  } catch {
    return false
  }
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 開始日 00:00（台北時間） */
export function parseStartDate(v: string): Date | null {
  if (!DATE_RE.test(v)) return null
  const d = new Date(`${v}T00:00:00+08:00`)
  return isNaN(d.getTime()) ? null : d
}

/** 結束日 23:59:59（台北時間），結束日當天仍會顯示 */
export function parseEndDate(v: string): Date | null {
  if (!DATE_RE.test(v)) return null
  const d = new Date(`${v}T23:59:59.999+08:00`)
  return isNaN(d.getTime()) ? null : d
}

export function toLocalDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(new Date(d).getTime() + 8 * 3600_000).toISOString().slice(0, 10)
}

export function validateDraft(kind: MarketingKind, d: MarketingDraft): FieldErrors {
  const e: FieldErrors = {}
  const title = d.title.trim()
  if (!title) e.title = kind === 'announcements' ? '請輸入公告標題' : kind === 'cards' ? '請輸入卡片名稱' : '請輸入橫幅標題'
  else if (title.length > LIMITS.title) e.title = `最多 ${LIMITS.title} 個字`

  if (kind === 'announcements') {
    const content = d.content.trim()
    if (!content) e.content = '請輸入公告內容'
    else if (content.length > LIMITS.content) e.content = `最多 ${LIMITS.content} 個字`
  } else {
    if (d.description.trim().length > LIMITS.description) e.description = `最多 ${LIMITS.description} 個字`
    const text = d.buttonText.trim()
    const url = d.buttonUrl.trim()
    if (text && !url) e.buttonUrl = '有按鈕文字時，請填寫按鈕連結'
    if (url && !text) e.buttonText = '有按鈕連結時，請填寫按鈕文字'
    if (text.length > LIMITS.buttonText) e.buttonText = `最多 ${LIMITS.buttonText} 個字`
    if (url && (url.length > LIMITS.buttonUrl || !isSafeUrl(url))) e.buttonUrl = '請輸入站內路徑（例如 /booking）或 https:// 開頭的網址'
  }

  const start = d.startAt ? parseStartDate(d.startAt) : null
  const end = d.endAt ? parseEndDate(d.endAt) : null
  if (d.startAt && !start) e.startAt = '開始日期格式錯誤'
  if (d.endAt && !end) e.endAt = '結束日期格式錯誤'
  if (start && end && end < start) e.endAt = '結束日期不能早於開始日期'
  return e
}

export type PublishState = 'draft' | 'scheduled' | 'live' | 'ended'

export function publishState(item: { active: boolean; startAt?: Date | string | null; endAt?: Date | string | null }, now = new Date()): PublishState {
  if (!item.active) return 'draft'
  if (item.endAt && new Date(item.endAt) < now) return 'ended'
  if (item.startAt && new Date(item.startAt) > now) return 'scheduled'
  return 'live'
}

export const PUBLISH_LABEL: Record<PublishState, { text: string; className: string }> = {
  draft: { text: '草稿', className: 'bg-amber-100 text-amber-800' },
  scheduled: { text: '已排程', className: 'bg-sky-100 text-sky-800' },
  live: { text: '上架中', className: 'bg-emerald-100 text-emerald-800' },
  ended: { text: '已結束', className: 'bg-zinc-100 text-zinc-600' },
}

/** 後台列表與編輯面板共用的資料形狀（日期為 ISO 字串，可直接傳給 client 元件） */
export interface MarketingItem {
  id: string
  title: string
  /** 橫幅副標題或卡片簡述 */
  description: string | null
  /** 公告內文 */
  content: string | null
  imageAssetId: string | null
  buttonText: string | null
  buttonUrl: string | null
  startAt: string | null
  endAt: string | null
  active: boolean
  updatedAt: string
}

export function itemToDraft(item: MarketingItem): MarketingDraft {
  return {
    title: item.title,
    description: item.description ?? '',
    content: item.content ?? '',
    imageAssetId: item.imageAssetId,
    buttonText: item.buttonText ?? '',
    buttonUrl: item.buttonUrl ?? '',
    startAt: toLocalDate(item.startAt),
    endAt: toLocalDate(item.endAt),
  }
}
