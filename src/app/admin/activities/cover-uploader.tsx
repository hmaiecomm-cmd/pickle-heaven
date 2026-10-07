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

async function downscale(file: File): Promise<Blob> {
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

export function CoverUploader({
  assetId,
  focusX,
  focusY,
  typeLabel,
  onChange,
  disabled,
  emptyLabel = '尚未上傳，前台會顯示紫色品牌預設封面',
}: {
  assetId: string | null
  focusX: number
  focusY: number
  typeLabel: string
  onChange: (v: { assetId: string | null; focusX: number; focusY: number }) => void
  disabled?: boolean
  emptyLabel?: string
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [warning, setWarning] = React.useState<string | null>(null)

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
    try {
      const blob = await downscale(file)
      const form = new FormData()
      form.append('file', new File([blob], file.name.replace(/\.\w+$/, '') + (blob.type === 'image/jpeg' ? '.jpg' : ''), { type: blob.type || file.type }))
      const res = await fetch('/api/admin/media', { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? json?.error ?? '上傳失敗，請稍後再試')
        return
      }
      setWarning(json.data.warning)
      onChange({ assetId: json.data.id, focusX: 50, focusY: 50 })
    } catch {
      setError('上傳失敗，請檢查網路後再試')
    } finally {
      setUploading(false)
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
