/**
 * 前台品牌與內容的集中設定。
 *
 * 名稱分兩組管理，不要混用：
 *   - brand.*        對外的場館名稱，用在首頁、預約頁、會員頁、LINE 通知、付款品名、SEO。
 *   - SYSTEM_NAME    後台系統名稱，只出現在後台。
 *
 * 聯絡、交通、社群、法務連結：只填已確認的資料。留 null 時，
 * 預覽環境會顯示「待補」，正式環境則整項隱藏，不會出現假連結。
 */

export const SYSTEM_NAME = '匹克精靈'

export const brand = {
  name: '大新店森林匹克球',
  englishName: 'DAXINDIAN PICKLEBALL CLUB',
  /** 首頁標語與 SEO 描述 */
  tagline: '在森林裡，打出你的節奏。',
  description: '來大新店森林匹克球，享受揮拍的暢快，也享受相聚的時光。線上預約場地、報名球友集合場次。',
} as const

/** 正式網址：社群分享與結構化資料用。Vercel 上可用 NEXT_PUBLIC_SITE_URL 覆寫。 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pickle-heaven.vercel.app'

/** 預覽與本機顯示「待補」；正式環境隱藏缺漏欄位。 */
export const SHOW_PENDING = process.env.VERCEL_ENV !== 'production'

/** 圖片狀態：concept＝情境示意圖，real＝已確認的場館實拍。未確認一律標 concept。 */
export type ImageStatus = 'concept' | 'real'

export interface SiteImage {
  src: string
  width: number
  height: number
  alt: string
  caption?: string
  status: ImageStatus
  /** 圖中出現與官方 logo 不同的標誌或名稱，需要場館確認 */
  brandingNote?: string
  /** 原始素材檔名，方便對照 */
  source: string
}

export const images = {
  logo: {
    src: '/images/home/logo-official.jpg',
    width: 1536,
    height: 1024,
    alt: '大新店森林匹克球 DAXINDIAN PICKLEBALL CLUB 官方標誌',
    status: 'real',
    source: '19611.jpg',
  },
  hero: {
    src: '/images/home/court-evening.jpg',
    width: 1448,
    height: 1086,
    alt: '傍晚燈光下的雨棚匹克球場，球友正在對打，周圍是綠樹與休憩座位',
    status: 'concept',
    brandingNote: '左側招牌與地墊是棕櫚樹版「D·D」標誌，地墊文字為「大新店匹克球俱樂部」，與官方 logo 不同',
    source: '19615.jpg',
  },
  forestCourt: {
    src: '/images/home/forest-court.jpg',
    width: 1536,
    height: 1024,
    alt: '被綠樹與植栽圍繞的匹克球場，午後光影落在場地上',
    caption: '場館一隅',
    status: 'concept',
    source: 'S__1608204291.jpg',
  },
  lounge: {
    src: '/images/home/lounge.jpg',
    width: 1448,
    height: 1086,
    alt: '明亮的休憩區，擺著圓桌、綠色座椅與飲料櫃',
    caption: '休憩空間',
    status: 'concept',
    source: '19609.jpg',
  },
  entrance: {
    src: '/images/home/entrance-gate.jpg',
    width: 1086,
    height: 1448,
    alt: '綠樹旁的球場入口，黑色鐵門敞開，通往後方球場',
    caption: '入口印象',
    status: 'concept',
    brandingNote: '入口招牌是「DXD PICKLEBALL COURT」字樣，與官方 logo 不同',
    source: '19608.png',
  },
  exterior: {
    src: '/images/home/building-exterior.jpg',
    width: 1448,
    height: 1086,
    alt: '場館外觀，招牌寫著大新店森林匹克球，牆面有綠色植生牆與大型匹克球裝置',
    caption: '場館外觀',
    status: 'concept',
    source: '19610.jpg',
  },
} satisfies Record<string, SiteImage>

/**
 * 聯絡與交通。全部尚未確認，先留 null。
 * 補上資料後首頁的交通區、頁尾、按鈕會自動出現。
 *
 * 地址與電話不在這裡：統一由後台「設定 → 場館」維護（與預約頁、訂單明細共用同一份資料）。
 */
export const contact = {
  /** Google 地圖分享連結，例：https://maps.app.goo.gl/xxxx */
  mapUrl: null as string | null,
  /** 地圖嵌入網址（Google 地圖「嵌入地圖」的 src） */
  mapEmbedUrl: null as string | null,
  lineUrl: null as string | null,
  email: null as string | null,
  transport: null as string | null,
  parking: null as string | null,
}

export const social: { label: string; href: string }[] = []

export const legal = {
  /** 營運公司名稱（不可填系統名稱） */
  company: null as string | null,
  termsUrl: null as string | null,
  privacyUrl: null as string | null,
}

/** 首頁使用的圖片中，只要有示意圖就在頁尾加註 */
export const HOME_IMAGES_HAVE_CONCEPT = Object.entries(images).some(([key, img]) => key !== 'logo' && img.status === 'concept')
