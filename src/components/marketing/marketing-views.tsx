/**
 * 前台行銷內容的呈現元件（純顯示，不讀資料）。
 * 後台即時預覽與前台上架共用，確保預覽與實際效果一致。
 */
import { ArrowRight, Megaphone } from 'lucide-react'
import { cn } from '@/lib/utils'

export const mediaSrc = (assetId: string | null | undefined, size?: 'thumb') =>
  assetId ? `/media/${assetId}${size ? `?size=${size}` : ''}` : null

interface CtaProps {
  text?: string | null
  url?: string | null
  /** 預覽時不可點擊，避免離開後台 */
  inert?: boolean
  className?: string
}

function Cta({ text, url, inert, className }: CtaProps) {
  if (!text) return null
  const cls = cn('inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors', className)
  if (inert || !url) {
    return (
      <span className={cls}>
        {text}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    )
  }
  const external = /^https:\/\//.test(url)
  return (
    <a href={url} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {text}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </a>
  )
}

export interface BannerViewProps {
  title: string
  subtitle?: string | null
  imageSrc?: string | null
  buttonText?: string | null
  buttonUrl?: string | null
  inert?: boolean
}

/** 首頁橫幅：深紫底、圖片滿版、標題與行動按鈕 */
export function BannerView({ title, subtitle, imageSrc, buttonText, buttonUrl, inert }: BannerViewProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-[20px] bg-hp-deep text-white">
      {imageSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-hp-deep/90 via-hp-deep/60 to-hp-deep/10" />
      <div className="flex min-h-[11rem] flex-col justify-center gap-3 p-6 sm:min-h-[13rem] sm:p-8">
        <h2 className="max-w-[24rem] break-words text-3xl font-black leading-tight tracking-wide">{title || '橫幅標題'}</h2>
        {subtitle && <p className="max-w-[24rem] break-words text-sm text-white/85 sm:text-base">{subtitle}</p>}
        <div>
          <Cta text={buttonText} url={buttonUrl} inert={inert} className="border-2 border-white/85 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20" />
        </div>
      </div>
    </section>
  )
}

export interface PromoCardViewProps {
  title: string
  description?: string | null
  imageSrc?: string | null
  buttonText?: string | null
  buttonUrl?: string | null
  inert?: boolean
}

/** 宣傳卡片：左圖右文、名稱、簡述與按鈕 */
export function PromoCardView({ title, description, imageSrc, buttonText, buttonUrl, inert }: PromoCardViewProps) {
  return (
    <article className="flex items-center gap-4 overflow-hidden rounded-[20px] bg-hp-lilac/60 p-4 text-hp-ink sm:gap-5 sm:p-5">
      <div className="aspect-square w-[38%] max-w-[10rem] flex-shrink-0 overflow-hidden rounded-2xl bg-white/70">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs font-semibold text-hp-purple/60">卡片圖片</div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="break-words text-xl font-black leading-snug text-hp-purple sm:text-2xl">{title || '卡片名稱'}</h3>
        {description && <p className="break-words text-sm leading-relaxed text-hp-ink/75">{description}</p>}
        {buttonText && (
          <div className="pt-1">
            <Cta text={buttonText} url={buttonUrl} inert={inert} className="bg-hp-purple text-white hover:bg-hp-deep" />
          </div>
        )}
      </div>
    </article>
  )
}

export interface AnnouncementViewProps {
  title: string
  content: string
}

/** 網站公告：圖示與標題同一行，內文保留換行 */
export function AnnouncementView({ title, content }: AnnouncementViewProps) {
  return (
    <aside className="rounded-[20px] border border-hp-purple/15 bg-hp-lilac/40 p-5 text-hp-ink">
      <h3 className="flex items-start gap-2.5 break-words text-lg font-black leading-snug text-hp-purple">
        <Megaphone className="mt-0.5 h-6 w-6 flex-shrink-0" aria-hidden />
        <span className="min-w-0">{title || '公告標題'}</span>
      </h3>
      <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-hp-ink/80">{content || '公告內容會顯示在這裡'}</p>
    </aside>
  )
}
