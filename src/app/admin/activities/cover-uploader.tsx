'use client'

import * as React from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DefaultCover } from '@/components/activities/activity-cover'

/**
 * 封面上傳：選檔 → 瀏覽器先縮圖（過大時）→ 上傳 /api/admin/media（伺服器再壓縮成 WebP 與縮圖）。
 * 點預覽圖設定裁切焦點；卡片 16:9 與詳情頁都以這個焦點裁切。
 */

const MAX_BYTES = 3.5 * 1024 * 1024
const MAX_EDGE = 2400

export async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size <= MAX_BYTES) return file
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('縮圖失敗'))), 'image/jpeg', 0.88),
  )
}

type MediaResponse = { success?: boolean; data: { id: string; warning: string | null }; error?: { message?: string } | string }

/** 以 XHR 上傳，才能回報實際進度（fetch 無上傳進度） */
function postMedia(form: FormData, onProgress: (pct: number) => void): Promise<{ status: number; json: MediaResponse | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/media')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let json: MediaResponse | null = null
      try {
        json = JSON.parse(xhr.responseText)
      } catch {}
      resolve({ status: xhr.status, json })
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(form)
  })
}

export function CoverUploader({
  assetId,
  focusX,
  focusY,
  typeLabel,
  onChange,
  disabled,
  emptyLabel = '尚未上傳，前台會顯示紫色品牌預設封面',
  variant = 'full',
}: {
  assetId: string | null
  focusX: number
  focusY: number
  typeLabel: string
  onChange: (v: { assetId: string | null; focusX: number; focusY: number }) => void
  disabled?: boolean
  emptyLabel?: string
  /** compact：單一 16:9 預覽（點圖設定焦點）＋「上傳封面／替換照片」按鈕，用於窄欄 */
  variant?: 'full' | 'compact'
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [warning, setWarning] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<number | null>(null)
  const [localPreview, setLocalPreview] = React.useState<string | null>(null)
  React.useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])

  const upload = async (file: File) => {
    setError(null)
    setWarning(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('只接受 JPG、PNG、WebP 圖片（iPhone 的 HEIC 請先轉成 JPG）')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('圖片超過 25 MB，請先縮小')
      return
    }
    setUploading(true)
    setProgress(0)
    // 選好就先顯示本機預覽；失敗時退回原本的圖，不動其他欄位
    setLocalPreview(URL.createObjectURL(file))
    try {
      const blob = await downscale(file)
      const form = new FormData()
      form.append('file', new File([blob], file.name.replace(/\.\w+$/, '') + (blob.type === 'image/jpeg' ? '.jpg' : ''), { type: blob.type || file.type }))
      const { status, json } = await postMedia(form, setProgress)
      if (status < 200 || status >= 300 || !json?.success) {
        setLocalPreview(null)
        setError(status === 401 ? '登入逾時或沒有上傳權限，請重新登入' : ((typeof json?.error === 'string' ? json.error : json?.error?.message) ?? '上傳失敗，請稍後再試'))
        return
      }
      setWarning(json.data.warning)
      onChange({ assetId: json.data.id, focusX: 50, focusY: 50 })
    } catch {
      setLocalPreview(null)
      setError('上傳失敗，請檢查網路後再試；原本的封面已保留')
    } finally {
      setUploading(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const setFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!assetId || disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    onChange({ assetId, focusX: Math.max(0, Math.min(100, x)), focusY: Math.max(0, Math.min(100, y)) })
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) void upload(f)
      }}
    />
  )

  if (variant === 'compact') {
    const shown = localPreview ?? (assetId ? `/media/${assetId}` : null)
    return (
      <div className="space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-zinc-100">
          {shown ? (
            <button type="button" onClick={setFocus} disabled={disabled || uploading || !assetId} className="block h-full w-full" aria-label="點擊設定裁切焦點">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shown} alt="活動封面預覽" className="h-full w-full object-cover" style={{ objectPosition: `${focusX}% ${focusY}%` }} />
              {assetId && !uploading && (
                <span
                  className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow"
                  style={{ left: `${focusX}%`, top: `${focusY}%` }}
                />
              )}
            </button>
          ) : (
            <DefaultCover typeLabel={typeLabel} />
          )}
          {uploading && (
            <div className="absolute inset-x-0 bottom-0 bg-black/55 px-3 py-2 text-xs text-white">
              <div className="mb-1 flex justify-between">
                <span>上傳中…</span>
                <span className="tabular-nums">{progress ?? 0}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${progress ?? 0}%` }} />
              </div>
            </div>
          )}
        </div>
        {fileInput}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            {assetId ? '替換照片' : '上傳封面'}
          </Button>
          {assetId && (
            <Button type="button" variant="ghost" disabled={disabled || uploading} onClick={() => onChange({ assetId: null, focusX: 50, focusY: 50 })} aria-label="移除封面">
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted">
          {assetId ? '點圖片可調整裁切焦點；前台卡片與活動詳情都用這張圖。' : emptyLabel}JPG／PNG／WebP，原圖 25 MB 內，會自動壓縮。
        </p>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        {warning && <p className="text-xs text-amber-700">{warning}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        {/* 原圖（點擊設定焦點） */}
        <div>
          <p className="mb-1 text-xs text-muted">{assetId ? '點擊圖片設定裁切焦點（紫點）' : '封面預覽'}</p>
          {assetId ? (
            <button
              type="button"
              onClick={setFocus}
              disabled={disabled}
              className="relative block w-full overflow-hidden rounded-xl bg-zinc-100"
              aria-label="點擊設定裁切焦點"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/${assetId}`} alt="上傳的封面原圖" className="block max-h-72 w-full object-contain" />
              <span
                className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#713CDE] shadow"
                style={{ left: `${focusX}%`, top: `${focusY}%` }}
              />
            </button>
          ) : (
            <div className="aspect-video overflow-hidden rounded-xl">
              <DefaultCover typeLabel={typeLabel} />
            </div>
          )}
        </div>
        {/* 卡片實際裁切 */}
        <div>
          <p className="mb-1 text-xs text-muted">卡片 16:9 裁切</p>
          <div className="aspect-video overflow-hidden rounded-xl bg-zinc-100">
            {assetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/media/${assetId}?size=thumb`}
                alt="卡片裁切預覽"
                className="h-full w-full object-cover"
                style={{ objectPosition: `${focusX}% ${focusY}%` }}
              />
            ) : (
              <DefaultCover typeLabel={typeLabel} />
            )}
          </div>
          {!assetId && <p className="mt-1 text-[11px] text-muted">{emptyLabel}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        <Button type="button" size="sm" variant="secondary" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          {assetId ? '更換圖片' : '上傳圖片'}
        </Button>
        {assetId && (
          <Button type="button" size="sm" variant="ghost" disabled={disabled || uploading} onClick={() => onChange({ assetId: null, focusX: 50, focusY: 50 })}>
            <Trash2 className="h-4 w-4" aria-hidden />
            移除
          </Button>
        )}
        <span className="text-[11px] text-muted">JPG／PNG／WebP，建議 1600×900 以上；儲存後才會套用</span>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {warning && <p className="text-xs text-amber-700">{warning}</p>}
    </div>
  )
}
