'use client'

import Link from 'next/link'
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Banner {
  id: string
  title: string
  subtitle?: string | null
  imageAssetId?: string | null
  displayPages: string
  sortOrder: number
  active: boolean
  startAt?: Date | null
  endAt?: Date | null
}

interface MarketingBannersSectionProps {
  banners: Banner[]
}

export function MarketingBannersSection({ banners }: MarketingBannersSectionProps) {
  if (banners.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <div className="text-center">
          <p className="font-semibold text-zinc-800">尚未建立首頁橫幅</p>
          <p className="mt-2 text-sm text-zinc-600">新增行銷橫幅可吸引訪客注意</p>
          <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            新增橫幕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {banners.map((banner) => (
        <div
          key={banner.id}
          className="flex items-center justify-between gap-4 rounded-xl border border-[rgb(var(--border))] bg-white p-4 transition-all hover:border-brand-500"
        >
          {/* 橫幅預覽 */}
          <div className="flex flex-1 items-center gap-4 min-w-0">
            <div className="h-20 w-32 flex-shrink-0 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50">
              {banner.imageAssetId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/media/${banner.imageAssetId}?size=thumb`}
                  alt={banner.title}
                  className="h-full w-full object-cover rounded-lg"
                />
              ) : (
                <div className="grid h-full place-items-center text-xs font-semibold text-brand-700">無圖片</div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-900 truncate">{banner.title}</p>
              {banner.subtitle && <p className="text-xs text-muted truncate">{banner.subtitle}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[11px] rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700">
                  {banner.displayPages === 'HOMEPAGE' ? '首頁' : banner.displayPages === 'ALL' ? '全站' : banner.displayPages}
                </span>
                {banner.startAt && (
                  <span className="text-[11px] text-muted">
                    {new Date(banner.startAt).toLocaleDateString('zh-TW')}
                    {banner.endAt && ` ~ ${new Date(banner.endAt).toLocaleDateString('zh-TW')}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className={`rounded-lg px-2 py-2 transition-colors ${
                banner.active
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
              title={banner.active ? '停用' : '啟用'}
            >
              {banner.active ? (
                <Eye className="h-4 w-4" aria-hidden />
              ) : (
                <EyeOff className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button className="rounded-lg bg-brand-50 px-2 py-2 text-brand-700 hover:bg-brand-100 transition-colors">
              <Edit className="h-4 w-4" aria-hidden />
            </button>
            <button className="rounded-lg bg-red-50 px-2 py-2 text-red-700 hover:bg-red-100 transition-colors">
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
