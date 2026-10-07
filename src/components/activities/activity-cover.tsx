import { CalendarClock, Ban, CircleCheck, Flag, Lock, PlayCircle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityCover as Cover, SignupState } from '@/lib/activity-shared'

/**
 * 活動封面。有上傳圖片時依焦點裁切；沒有時顯示品牌預設封面（插畫，不是現場照片）。
 * 外層需自行決定比例，例如 aspect-video。
 */
export function ActivityCover({
  cover,
  title,
  typeLabel,
  thumb = false,
  className,
  priority = false,
}: {
  cover: Cover
  title: string
  typeLabel: string
  thumb?: boolean
  className?: string
  priority?: boolean
}) {
  const src = thumb ? (cover.thumb ?? cover.src) : cover.src
  if (src) {
    return (
      // 圖片來自站內 /media，已壓縮成 WebP，直接以 img 呈現
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${title} 活動封面`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
        style={{ objectPosition: `${cover.focusX}% ${cover.focusY}%` }}
      />
    )
  }
  return <DefaultCover typeLabel={typeLabel} className={className} />
}

/** 紫色品牌預設封面：球拍、球、球場線條與活動類型 */
export function DefaultCover({ typeLabel, className }: { typeLabel: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 320 180"
      role="img"
      aria-label={`${typeLabel}（品牌預設封面，非活動照片）`}
      preserveAspectRatio="xMidYMid slice"
      className={cn('h-full w-full', className)}
    >
      <defs>
        <linearGradient id="hp-cover-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#30223D" />
          <stop offset="1" stopColor="#6941A5" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#hp-cover-bg)" />
      {/* 球場線（俯視、斜放） */}
      <g transform="translate(178 -22) rotate(24)" stroke="#EEE6FA" strokeOpacity=".28" strokeWidth="1.4" fill="none">
        <rect x="0" y="0" width="110" height="242" />
        <line x1="0" y1="121" x2="110" y2="121" />
        <line x1="0" y1="83" x2="110" y2="83" />
        <line x1="0" y1="159" x2="110" y2="159" />
        <line x1="55" y1="0" x2="55" y2="83" />
        <line x1="55" y1="159" x2="55" y2="242" />
      </g>
      {/* 球拍與球 */}
      <g transform="translate(228 70) rotate(-28)">
        <rect x="-24" y="-34" width="48" height="58" rx="18" fill="#EEE6FA" fillOpacity=".92" />
        <rect x="-6" y="22" width="12" height="34" rx="5" fill="#EEE6FA" fillOpacity=".92" />
      </g>
      <circle cx="270" cy="128" r="12" fill="#F5F1E8" />
      <g fill="#6941A5" fillOpacity=".55">
        <circle cx="266" cy="124" r="2" />
        <circle cx="274" cy="125" r="2" />
        <circle cx="269" cy="132" r="2" />
      </g>
      <text x="20" y="150" fill="#F5F1E8" fontSize="26" fontWeight="800" fontFamily="var(--font-app), sans-serif">
        {typeLabel}
      </text>
      <text x="20" y="34" fill="#EEE6FA" fillOpacity=".8" fontSize="10" letterSpacing="2" fontFamily="sans-serif">
        DAXINDIAN PICKLEBALL CLUB
      </text>
    </svg>
  )
}

const STATE_STYLE: Record<SignupState, { cls: string; Icon: typeof CircleCheck }> = {
  OPEN: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CircleCheck },
  FULL: { cls: 'bg-rose-50 text-rose-800 ring-rose-200', Icon: Users },
  NOT_OPEN: { cls: 'bg-amber-50 text-amber-900 ring-amber-200', Icon: CalendarClock },
  CLOSED: { cls: 'bg-zinc-100 text-zinc-700 ring-zinc-200', Icon: Lock },
  IN_PROGRESS: { cls: 'bg-sky-50 text-sky-800 ring-sky-200', Icon: PlayCircle },
  ENDED: { cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', Icon: Flag },
  CANCELLED: { cls: 'bg-zinc-100 text-zinc-600 ring-zinc-200', Icon: Ban },
}

/** 報名狀態標籤：顏色之外一定附圖示與文字 */
export function SignupBadge({ state, label, className }: { state: SignupState; label: string; className?: string }) {
  const { cls, Icon } = STATE_STYLE[state]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1', cls, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}

/** 價格文字：NT$500／人 */
export function priceText(price: number, unitLabel: string) {
  return price === 0 ? '免費' : `NT$${price.toLocaleString('zh-TW')}／${unitLabel}`
}
