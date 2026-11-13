import { VideoOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cameraTitle } from '@/lib/camera-layout'
import type { CameraView } from '@/server/camera-service'

/**
 * 攝影機畫面。尚未串接時：有現場照片的顯示照片並標示「示範影像」，沒有照片的顯示未連線畫面。
 * 不顯示 LIVE、不顯示會走動的時間，避免被誤認為即時串流。
 */
export function CameraFrame({
  camera,
  variant,
  overlay,
  className,
}: {
  camera: CameraView
  variant: 'main' | 'thumb' | 'grid'
  overlay?: React.ReactNode
  className?: string
}) {
  const media = camera.demo
  const src = media ? (variant === 'main' ? media.main : media.thumb) : null
  const pos = media ? (variant === 'main' ? media.mainPosition : media.thumbPosition) : undefined
  const big = variant === 'main'
  return (
    <div
      className={cn('relative aspect-video w-full overflow-hidden bg-[#1d2620]', className)}
      role="img"
      aria-label={`${cameraTitle(camera.id, camera.name)}，${media ? '示範影像（非即時）' : '未連線'}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 本地靜態示範圖，不需最佳化
        <img src={src} alt="" className={cn('h-full w-full object-cover', !camera.enabled && 'grayscale opacity-50')} style={{ objectPosition: pos }} draggable={false} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/55">
          <VideoOff className={big ? 'h-10 w-10' : 'h-5 w-5'} aria-hidden />
          <span className={big ? 'text-sm' : 'text-[10px]'}>{camera.enabled ? '尚未連線・無示範影像' : '已停用'}</span>
        </div>
      )}

      <span
        className={cn(
          'absolute left-2 top-2 rounded-md bg-amber-400/95 font-bold text-amber-950 shadow-sm',
          big ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[9px]',
        )}
      >
        {src ? '示範影像' : 'Demo Mode'}
      </span>
      <span
        className={cn(
          'absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 font-medium text-white',
          big ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[9px]',
        )}
      >
        <span className={cn('rounded-full', camera.enabled ? 'bg-zinc-300' : 'bg-red-400', big ? 'h-1.5 w-1.5' : 'h-1 w-1')} />
        {camera.enabled ? '未連線' : '已停用'}
      </span>

      {big && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-white">
          <p className="text-sm font-semibold sm:text-base">{cameraTitle(camera.id, camera.name)}</p>
          <p className="text-[11px] text-white/75">{src ? '示範影像・Demo Mode・非即時串流' : 'Demo Mode・尚未串接攝影機'}</p>
        </div>
      )}
      {overlay}
    </div>
  )
}
