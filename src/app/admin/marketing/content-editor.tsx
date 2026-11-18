'use client'

import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, ImagePlus, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { downscale } from '@/app/admin/activities/cover-uploader'
import { AnnouncementView, BannerView, PromoCardView, mediaSrc } from '@/components/marketing/marketing-views'
import {
  EMPTY_DRAFT,
  LIMITS,
  itemToDraft,
  validateDraft,
  type FieldErrors,
  type MarketingDraft,
  type MarketingItem,
  type MarketingKind,
} from '@/lib/marketing-content'

const TITLE: Record<MarketingKind, { create: string; edit: string; titleLabel: string }> = {
  banners: { create: '新增橫幅', edit: '編輯橫幅', titleLabel: '橫幅標題' },
  cards: { create: '新增卡片', edit: '編輯卡片', titleLabel: '卡片名稱' },
  announcements: { create: '新增公告', edit: '編輯公告', titleLabel: '公告標題' },
}

/** iOS／Android 鍵盤彈出時縮短面板高度，讓底部按鈕保持在鍵盤上方 */
function useKeyboardInset(active: boolean) {
  const [inset, setInset] = React.useState(0)
  React.useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!active || !vv) return
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [active])
  return inset
}

export interface EditorTarget {
  kind: MarketingKind
  item: MarketingItem | null
}

export function ContentEditor({
  target,
  onClose,
  onSaved,
}: {
  target: EditorTarget | null
  onClose: () => void
  onSaved: (kind: MarketingKind, title: string, isNew: boolean) => void
}) {
  const open = target !== null
  const kind = target?.kind ?? 'banners'
  const isNew = !target?.item
  const [draft, setDraft] = React.useState<MarketingDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [localPreview, setLocalPreview] = React.useState<string | null>(null)
  const [uploadWarning, setUploadWarning] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const keyboard = useKeyboardInset(open)

  // 每次開啟都從目標資料重新初始化
  React.useEffect(() => {
    if (!target) return
    setDraft(target.item ? itemToDraft(target.item) : EMPTY_DRAFT)
    setErrors({})
    setFormError(null)
    setLocalPreview(null)
    setUploadWarning(null)
    setFileName(null)
  }, [target])

  React.useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview) }, [localPreview])

  const set = <K extends keyof MarketingDraft>(k: K, v: MarketingDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    if (errors[k]) {
      const rest = { ...errors, [k]: undefined }
      setErrors(rest)
      if (!Object.values(rest).some(Boolean)) setFormError(null)
    }
  }

  const pickImage = async (file: File) => {
    setUploadWarning(null)
    setErrors((e) => ({ ...e, imageAssetId: undefined }))
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((e) => ({ ...e, imageAssetId: '只接受 JPG、PNG、WebP 圖片（iPhone 的 HEIC 請先轉成 JPG）' }))
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrors((e) => ({ ...e, imageAssetId: '圖片超過 25 MB，請先縮小' }))
      return
    }
    // 選好就先用本機圖片預覽，上傳完成再換成伺服器版本
    setLocalPreview(URL.createObjectURL(file))
    setFileName(file.name)
    setUploading(true)
    try {
      const blob = await downscale(file)
      const form = new FormData()
      form.append('file', new File([blob], file.name.replace(/\.\w+$/, '') + (blob.type === 'image/jpeg' ? '.jpg' : ''), { type: blob.type || file.type }))
      const res = await fetch('/api/admin/media', { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        setLocalPreview(null)
        setFileName(null)
        setErrors((e) => ({ ...e, imageAssetId: json?.error?.message ?? json?.error ?? '圖片上傳失敗，請稍後再試' }))
        return
      }
      setUploadWarning(json.data.warning ?? null)
      setDraft((d) => ({ ...d, imageAssetId: json.data.id }))
    } catch {
      setLocalPreview(null)
      setFileName(null)
      setErrors((e) => ({ ...e, imageAssetId: '圖片上傳失敗，請檢查網路後再試' }))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const removeImage = () => {
    setLocalPreview(null)
    setFileName(null)
    set('imageAssetId', null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || uploading || !target) return
    setFormError(null)
    const local = validateDraft(kind, draft)
    if (Object.keys(local).length) {
      setErrors(local)
      setFormError('請修正標示的欄位')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(isNew ? `/api/admin/marketing/${kind}` : `/api/admin/marketing/${kind}/${target.item!.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        if (json?.error?.fields) setErrors(json.error.fields)
        setFormError(
          res.status === 401
            ? '目前帳號沒有編輯行銷內容的權限，或登入已逾時，請重新登入'
            : (json?.error?.message ?? `儲存失敗（${res.status}），請稍後再試`),
        )
        return
      }
      onSaved(kind, draft.title.trim(), isNew)
    } catch {
      setFormError('網路連線失敗，內容尚未儲存，請稍後再試')
    } finally {
      setSaving(false)
    }
  }

  const imageSrc = localPreview ?? mediaSrc(draft.imageAssetId)
  const busy = saving || uploading
  const t = TITLE[kind]
  const hasImage = kind !== 'announcements'
  const hasButton = kind !== 'announcements'

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o && !saving) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[1px] animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => { if (saving) e.preventDefault() }}
          style={{ height: keyboard ? `calc(100dvh - ${keyboard}px)` : undefined }}
          className={cn(
            'fixed right-0 top-0 z-50 flex h-dvh max-w-full flex-col bg-white shadow-pop outline-none',
            'w-full sm:w-[min(88vw,40rem)] md:w-[min(78vw,44rem)] lg:w-[44rem] sm:rounded-l-3xl',
          )}
        >
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
            {/* 標題列 */}
            <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-7">
              <div className="min-w-0">
                <Dialog.Title className="text-2xl font-bold tracking-wide text-brand-900">{isNew ? t.create : t.edit}</Dialog.Title>
                {!isNew && target?.item?.active && <p className="mt-1 text-xs text-amber-700">此內容已發布，儲存後前台會立即更新。</p>}
              </div>
              <Dialog.Close asChild>
                <button type="button" disabled={saving} className="-mr-2 rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40" aria-label="關閉">
                  <X className="h-6 w-6" />
                </button>
              </Dialog.Close>
            </header>

            {/* 表單與預覽（可捲動） */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3 sm:px-7">
              <fieldset disabled={saving} className="space-y-4">
                <Field label={t.titleLabel} required error={errors.title} count={`${draft.title.trim().length}/${LIMITS.title}`}>
                  <input
                    value={draft.title}
                    onChange={(e) => set('title', e.target.value)}
                    maxLength={LIMITS.title + 20}
                    placeholder={kind === 'announcements' ? '例如：春節營業時間調整' : kind === 'cards' ? '例如：平日早鳥 8 折' : '例如：週末團練開放報名'}
                    className={inputCls(errors.title)}
                  />
                </Field>

                {hasImage && (
                  <Field label={kind === 'banners' ? '上傳圖片' : '圖片'} error={errors.imageAssetId} hint={imageSrc ? undefined : 'JPG、PNG、WebP，建議 1600×900 以上'}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      tabIndex={-1}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void pickImage(f)
                      }}
                    />
                    {imageSrc ? (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={busy}
                          className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100"
                          aria-label="更換圖片"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                          {uploading && (
                            <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                            </span>
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-700">{fileName ?? '已上傳的圖片'}</p>
                          <p className="text-xs text-muted">{uploading ? '上傳中…' : '點圖片可更換'}</p>
                        </div>
                        {!uploading && (
                          <button type="button" onClick={removeImage} className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100" aria-label="移除圖片">
                            <X className="h-5 w-5" aria-hidden />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={busy}
                        className="flex h-16 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-700 hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50"
                      >
                        <ImagePlus className="h-5 w-5" aria-hidden />
                        選擇圖片
                      </button>
                    )}
                    {uploadWarning && <p className="mt-1 text-xs text-amber-700">{uploadWarning}</p>}
                  </Field>
                )}

                {kind === 'announcements' ? (
                  <Field label="公告內容" required error={errors.content} count={`${draft.content.trim().length}/${LIMITS.content}`}>
                    <textarea
                      value={draft.content}
                      onChange={(e) => set('content', e.target.value)}
                      rows={5}
                      placeholder="可換行，前台會保留段落"
                      className={inputCls(errors.content)}
                    />
                  </Field>
                ) : (
                  <Field
                    label={kind === 'banners' ? '副標題' : '簡短說明'}
                    error={errors.description}
                    count={`${draft.description.trim().length}/${LIMITS.description}`}
                  >
                    <textarea
                      value={draft.description}
                      onChange={(e) => set('description', e.target.value)}
                      rows={2}
                      placeholder={kind === 'banners' ? '選填，顯示在標題下方' : '一兩句話說明優惠或活動內容'}
                      className={inputCls(errors.description)}
                    />
                  </Field>
                )}

                {hasButton && (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
                    <Field label="按鈕文字" error={errors.buttonText}>
                      <input value={draft.buttonText} onChange={(e) => set('buttonText', e.target.value)} placeholder="立即預約" className={inputCls(errors.buttonText)} />
                    </Field>
                    <Field label={kind === 'cards' ? '優惠連結' : '按鈕連結'} error={errors.buttonUrl} hint="站內路徑如 /booking，或 https:// 網址">
                      <input
                        value={draft.buttonUrl}
                        onChange={(e) => set('buttonUrl', e.target.value)}
                        inputMode="url"
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="/booking"
                        className={inputCls(errors.buttonUrl)}
                      />
                    </Field>
                  </div>
                )}

                <div className="min-w-0">
                  <p className="mb-1.5 text-sm font-medium text-zinc-800">顯示期間</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      aria-label="開始日期"
                      value={draft.startAt}
                      max={draft.endAt || undefined}
                      onChange={(e) => set('startAt', e.target.value)}
                      className={cn(inputCls(errors.startAt), 'min-w-0 flex-1')}
                    />
                    <span className="flex-shrink-0 text-zinc-500" aria-hidden>
                      ～
                    </span>
                    <input
                      type="date"
                      aria-label="結束日期"
                      value={draft.endAt}
                      min={draft.startAt || undefined}
                      onChange={(e) => set('endAt', e.target.value)}
                      className={cn(inputCls(errors.endAt), 'min-w-0 flex-1')}
                    />
                  </div>
                  {errors.startAt || errors.endAt ? (
                    <p className="mt-1 text-xs text-red-700">{errors.startAt ?? errors.endAt}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted">留空表示不限；結束日當天整天都會顯示</p>
                  )}
                </div>
              </fieldset>

              {/* 網站即時預覽 */}
              <section className="mt-6 border-t border-zinc-200 pt-5" aria-label="網站即時預覽">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-zinc-900">網站即時預覽</h3>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">草稿・僅後台可見</span>
                </div>
                <div>
                  {kind === 'banners' && (
                    <BannerView inert title={draft.title} subtitle={draft.description} imageSrc={imageSrc} buttonText={draft.buttonText} buttonUrl={draft.buttonUrl} />
                  )}
                  {kind === 'cards' && (
                    <div>
                      <PromoCardView inert title={draft.title} description={draft.description} imageSrc={imageSrc} buttonText={draft.buttonText} buttonUrl={draft.buttonUrl} />
                    </div>
                  )}
                  {kind === 'announcements' && <AnnouncementView title={draft.title} content={draft.content} />}
                </div>
              </section>
            </div>

            {/* 底部操作 */}
            <footer className="bg-white px-5 pt-3 pb-safe sm:px-7">
              {formError && (
                <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                  {formError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="h-12 flex-[2] rounded-xl border-2 border-brand-800 bg-white text-base font-bold text-brand-900 hover:bg-brand-50 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-12 flex-[3] items-center justify-center gap-2 rounded-xl bg-brand-800 text-base font-bold text-white hover:bg-brand-900 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {saving ? '儲存中…' : uploading ? '圖片上傳中…' : isNew || !target?.item?.active ? '儲存草稿' : '儲存變更'}
                </button>
              </div>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const inputCls = (error?: string) =>
  cn(
    'block w-full rounded-xl border bg-white px-3 py-2.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 sm:text-sm',
    error ? 'border-red-400 focus:ring-red-200' : 'border-zinc-300 focus:border-brand-600 focus:ring-brand-100',
  )

function Field({
  label,
  required,
  error,
  hint,
  count,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  count?: string
  children: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-zinc-800">
          {label}
          {required && <span className="ml-0.5 text-red-600">*</span>}
        </label>
        {count && <span className="text-[11px] tabular-nums text-muted">{count}</span>}
      </div>
      {React.isValidElement<{ id?: string }>(children) && (children.type === 'input' || children.type === 'textarea')
        ? React.cloneElement(children, { id })
        : children}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}
