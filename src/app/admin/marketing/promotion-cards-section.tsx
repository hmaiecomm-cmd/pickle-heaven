'use client'

import { Plus, Edit, Trash2 } from 'lucide-react'

interface PromotionCard {
  id: string
  title: string
  description?: string | null
  imageAssetId?: string | null
  displayPages: string
  active: boolean
  startAt?: Date | null
  endAt?: Date | null
}

interface PromotionCardsSectionProps {
  cards: PromotionCard[]
}

export function PromotionCardsSection({ cards }: PromotionCardsSectionProps) {
  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <div className="text-center">
          <p className="font-semibold text-zinc-800">尚未建立宣傳卡片</p>
          <p className="mt-2 text-sm text-zinc-600">新增宣傳卡片展示優惠與推廣內容</p>
          <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            新增卡片
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className="group relative overflow-hidden rounded-2xl border border-[rgb(var(--border))] bg-white transition-all hover:border-brand-500 hover:shadow-md"
        >
          {/* 卡片圖片 */}
          <div className="aspect-video bg-gradient-to-br from-zinc-200 to-zinc-300 overflow-hidden">
            {card.imageAssetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/media/${card.imageAssetId}?size=thumb`}
                alt={card.title}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="grid h-full place-items-center bg-gradient-to-br from-brand-100 to-brand-50 text-sm font-semibold text-brand-700">
                {card.title}
              </div>
            )}
          </div>

          {/* 卡片內容 */}
          <div className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-zinc-900 group-hover:text-brand-700 line-clamp-2">{card.title}</p>
                {card.description && <p className="text-xs text-muted line-clamp-2 mt-1">{card.description}</p>}
              </div>
            </div>

            {/* 狀態標籤 */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${
                  card.active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {card.active ? '已啟用' : '已停用'}
              </span>
              {card.startAt && (
                <span className="text-[11px] text-muted">
                  {new Date(card.startAt).toLocaleDateString('zh-TW')}
                </span>
              )}
            </div>

            {/* 操作按鈕 */}
            <div className="flex gap-2 pt-2 border-t border-zinc-100">
              <button className="flex-1 rounded-lg bg-brand-50 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors flex items-center justify-center gap-1">
                <Edit className="h-3 w-3" aria-hidden />
                編輯
              </button>
              <button className="rounded-lg bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors">
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
