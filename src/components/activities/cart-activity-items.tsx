'use client'

import { CalendarHeart, Trash2 } from 'lucide-react'
import { ntd } from '@/lib/utils'
import type { CartActivityItemDTO } from '@/lib/types'

/** 購物車／結帳的「活動報名」品項：日期、時間、數量、單價、小計，與場地租借分開列出 */
export function CartActivityItems({
  items,
  onRemove,
  busyId,
}: {
  items: CartActivityItemDTO[]
  onRemove?: (item: CartActivityItemDTO) => void
  busyId?: string | null
}) {
  if (items.length === 0) return null
  return (
    <section className="rounded-2xl bg-[#EEE6FA] p-4 text-[#281343]" aria-label="活動報名">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <CalendarHeart className="h-4 w-4" aria-hidden />
        活動報名
      </h2>
      <ul className="mt-3 divide-y divide-[#281343]/15">
        {items.map((it) => (
          <li key={it.registrationId} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{it.title}</p>
              <p className="mt-0.5 text-xs tabular">
                {it.dateLabel} {it.timeLabel}
                {it.courtNames.length > 0 && `・${it.courtNames.join('、')}`}
              </p>
              <p className="mt-1 text-xs tabular">
                {it.quantity} {it.unitLabel} × {ntd(it.unitPrice)}
              </p>
            </div>
            <span className="text-sm font-bold tabular">{ntd(it.amount)}</span>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(it)}
                disabled={busyId === it.registrationId}
                aria-label={`移除活動 ${it.title}`}
                className="rounded-lg p-2 text-[#281343]/70 transition-colors hover:bg-white hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-[#281343]/70">名額為暫留，完成付款才算報名成功。</p>
    </section>
  )
}
