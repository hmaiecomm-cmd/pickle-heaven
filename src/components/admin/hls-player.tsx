'use client'

import { useEffect, useRef, useState } from 'react'

/** 播放場館上傳到 IoT Gateway 的 HLS（即時或錄影）。src 指向平台的代理 /api/admin/engineer/media/... */
export function HlsPlayer({ src, live = true, className, onError }: { src: string | null; live?: boolean; className?: string; onError?: (msg: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const video = ref.current
    if (!video || !src) return
    let hls: import('hls.js').default | null = null
    let cancelled = false
    setMsg('連線中…')
    ;(async () => {
      const { default: Hls } = await import('hls.js')
      if (cancelled) return
      if (Hls.isSupported()) {
        hls = new Hls(live ? { liveSyncDurationCount: 2, manifestLoadingMaxRetry: 30, manifestLoadingRetryDelay: 1000, levelLoadingMaxRetry: 30 } : {})
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setMsg(null)
          void video.play().catch(() => {})
        })
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (d.fatal) {
            const m = `播放錯誤：${d.details}`
            setMsg(m)
            onError?.(m)
          }
        })
        hls.loadSource(src)
        hls.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        setMsg(null)
      } else setMsg('這個瀏覽器不支援 HLS')
    })()
    return () => {
      cancelled = true
      hls?.destroy()
    }
  }, [src, live, onError])

  return (
    <div className={`relative bg-black ${className ?? ''}`}>
      <video ref={ref} className="h-full w-full object-contain" muted playsInline controls={!live} autoPlay />
      {msg && <div className="absolute inset-0 flex items-center justify-center text-xs text-white/80">{msg}</div>}
    </div>
  )
}
