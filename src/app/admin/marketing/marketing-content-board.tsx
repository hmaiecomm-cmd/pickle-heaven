'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Edit, Eye, EyeOff, Loader2, Megaphone, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { mediaSrc } from '@/components/marketing/marketing-views'
import { KIND_LABEL, PUBLISH_LABEL, publishState, type MarketingItem, type MarketingKind } from '@/lib/marketing-content'
import { ContentEditor, type EditorTarget } from './content-editor'

const SECTION: Record<MarketingKind, { heading: string; desc: string; add: string; emptyTitle: string; emptyDesc: string }> = {
  banners: { heading: '首頁行銷橫幅', desc: '設定首頁主視覺和行動按鈕', add: '新增橫幅', emptyTitle: '尚未建立首頁橫幅', emptyDesc: '新增行銷橫幅可吸引訪客注意' },
  cards: { heading: '行銷宣傳卡片', desc: '展示優惠、推廣與特殊內容', add: '新增卡片', emptyTitle: '尚未建立宣傳卡片', emptyDesc: '用卡片介紹優惠方案或活動' },
  announcements: { heading: '網站公告', desc: '發佈重要資訊與通知', add: '新增公告', emptyTitle: '尚未建立網站公告', emptyDesc: '營業時間異動、臨時封場等消息可在這裡公告' },
}

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }) : null

function period(item: MarketingItem) {
  const s = fmtDate(item.startAt)
  const e = fmtDate(item.endAt)
  if (!s && !e) return '不限期間'
  return `${s ?? '發布起'} ～ ${e ?? '不限'}`
}

export function MarketingContentBoard({
  banners,
  cards,
  announcements,
  canWrite,
}: {
  banners: MarketingItem[]
  cards: MarketingItem[]
  announcements: MarketingItem[]
  canWrite: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [target, setTarget] = React.useState<EditorTarget | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<string | null>(null)

  const openEditor = (kind: MarketingKind, item: MarketingItem | null = null) => setTarget({ kind, item })

  const act = async (kind: MarketingKind, item: MarketingItem, op: 'publish' | 'unpublish' | 'delete') => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/admin/marketing/${kind}/${item.id}`, {
        method: op === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: op === 'delete' ? undefined : JSON.stringify({ action: op }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        toast(res.status === 401 ? '目前帳號沒有這項權限' : (json?.error?.message ?? '操作失敗，請稍後再試'), 'error')
        return
      }
      toast(op === 'publish' ? `已發布「${item.title}」` : op === 'unpublish' ? `已下架「${item.title}」，改回草稿` : `已刪除「${item.title}」`, 'success')
      router.refresh()
    } catch {
      toast('網路連線失敗，請稍後再試', 'error')
    } finally {
      setBusyId(null)
      setPendingDelete(null)
    }
  }

  const lists: Record<MarketingKind, MarketingItem[]> = { banners, cards, announcements }

  return (
    <>
      {(Object.keys(SECTION) as MarketingKind[]).map((kind) => {
        const s = SECTION[kind]
        const items = lists[kind]
        return (
          <section key={kind} aria-labelledby={`mk-${kind}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 id={`mk-${kind}`} className="text-sm font-semibold text-zinc-700">
                  {s.heading}
                  <span className="ml-2 text-xs font-normal text-muted">{items.length} 則</span>
                </h2>
                <p className="mt-1 text-xs text-muted">{s.desc}</p>
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => openEditor(kind)}
                  className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {s.add}
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center">
                <p className="font-semibold text-zinc-800">{s.emptyTitle}</p>
                <p className="mt-2 text-sm text-zinc-600">{s.emptyDesc}</p>
                {canWrite ? (
                  <button
                    type="button"
                    onClick={() => openEditor(kind)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {s.add}
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-muted">目前帳號只能檢視，新增需由擁有者或管理員操作。</p>
                )}
              </div>
            ) : (
              <ul className={cn(kind === 'cards' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3')}>
                {items.map((item) => {
                  const state = publishState(item)
                  const badge = PUBLISH_LABEL[state]
                  const busy = busyId === item.id
                  const thumb = mediaSrc(item.imageAssetId, 'thumb')
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'flex gap-3 rounded-xl border bg-white p-3 sm:p-4',
                        kind === 'cards' ? 'flex-col' : 'flex-col sm:flex-row sm:items-center',
                        state === 'draft' ? 'border-dashed border-amber-300' : 'border-[rgb(var(--border))]',
                      )}
                    >
                      <div className={cn('flex min-w-0 flex-1 gap-3', kind === 'cards' && 'flex-col')}>
                        {kind !== 'announcements' ? (
                          <div className={cn('flex-shrink-0 overflow-hidden rounded-lg bg-hp-lilac', kind === 'cards' ? 'aspect-video w-full' : 'h-16 w-28')}>
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full place-items-center text-[11px] font-semibold text-hp-purple/70">無圖片</div>
                            )}
                          </div>
                        ) : (
                          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-hp-lilac text-hp-purple">
                            <Megaphone className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', badge.className)}>{badge.text}</span>
                            <p className="min-w-0 break-words font-semibold text-zinc-900">{item.title}</p>
                          </div>
                          {(item.description || item.content) && (
                            <p className="mt-1 line-clamp-2 break-words text-xs text-zinc-600">{item.description ?? item.content}</p>
                          )}
                          <p className="mt-1 text-[11px] text-muted">
                            {period(item)}
                            {item.buttonText && ` ・ 按鈕「${item.buttonText}」`}
                          </p>
                        </div>
                      </div>

                      {canWrite && (
                        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                          {pendingDelete === item.id ? (
                            <>
                              <span className="text-xs text-red-700">確定刪除？</span>
                              <button type="button" disabled={busy} onClick={() => act(kind, item, 'delete')} className="h-9 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : '刪除'}
                              </button>
                              <button type="button" disabled={busy} onClick={() => setPendingDelete(null)} className="h-9 rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-200">
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => act(kind, item, item.active ? 'unpublish' : 'publish')}
                                className={cn(
                                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-60',
                                  item.active ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' : 'bg-brand-600 text-white hover:bg-brand-700',
                                )}
                              >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : item.active ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                                {item.active ? '下架' : '發布'}
                              </button>
                              <button type="button" disabled={busy} onClick={() => openEditor(kind, item)} className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100" aria-label={`編輯「${item.title}」`}>
                                <Edit className="h-4 w-4" aria-hidden />
                              </button>
                              <button type="button" disabled={busy} onClick={() => setPendingDelete(item.id)} className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-700 hover:bg-red-100" aria-label={`刪除「${item.title}」`}>
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}

      <ContentEditor
        target={target}
        onClose={() => setTarget(null)}
        onSaved={(kind, title, isNew) => {
          setTarget(null)
          toast(isNew ? `已儲存${KIND_LABEL[kind]}草稿「${title}」，尚未公開` : `已更新「${title}」`, 'success')
          router.refresh()
        }}
      />
    </>
  )
}
