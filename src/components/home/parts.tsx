import Image from 'next/image'
import { SHOW_PENDING, type SiteImage } from '@/config/site'
import { cn } from '@/lib/utils'

/** 匹克球場線（20×44 呎比例）：外框、球網、廚房線、中線。顏色跟隨 currentColor。 */
export function CourtLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 440" fill="none" aria-hidden className={cn('pointer-events-none', className)}>
      <g stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
        <rect x="1" y="1" width="198" height="438" vectorEffect="non-scaling-stroke" />
        <line x1="1" y1="220" x2="199" y2="220" vectorEffect="non-scaling-stroke" />
        <line x1="1" y1="150" x2="199" y2="150" vectorEffect="non-scaling-stroke" />
        <line x1="1" y1="290" x2="199" y2="290" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="1" x2="100" y2="150" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="290" x2="100" y2="439" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  )
}

/** 區塊標頭的小標：序號＋英文，前面一段短線 */
export function Eyebrow({ index, children, className }: { index?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('hp-eyebrow flex items-center gap-3', className)}>
      <span aria-hidden className="h-px w-8 bg-current opacity-60" />
      {index && <span className="tabular">{index}</span>}
      <span>{children}</span>
    </p>
  )
}

/** 待補標記：只在預覽環境顯示，正式環境回傳 null */
export function Pending({ children = '待補' }: { children?: React.ReactNode }) {
  if (!SHOW_PENDING) return null
  return <span className="hp-pending">{children}</span>
}

/** 帶圖說的照片。圖說為空時不輸出 figcaption。 */
export function Photo({
  image,
  className,
  frameClassName,
  imgClassName,
  sizes,
  priority,
  showCaption = true,
}: {
  image: SiteImage
  className?: string
  /** 照片框的比例或高度，例：aspect-[4/5] */
  frameClassName?: string
  imgClassName?: string
  sizes: string
  priority?: boolean
  showCaption?: boolean
}) {
  return (
    <figure className={cn('relative', className)}>
      <div className={cn('relative w-full overflow-hidden rounded-[var(--hp-radius-md)] bg-hp-lilac', frameClassName)}>
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn('object-cover', imgClassName)}
        />
      </div>
      {showCaption && image.caption && (
        <figcaption className="mt-3 flex items-center gap-2 text-sm font-semibold text-hp-ink/70">
          <span aria-hidden className="h-px w-5 bg-hp-purple" />
          {image.caption}
        </figcaption>
      )}
    </figure>
  )
}
