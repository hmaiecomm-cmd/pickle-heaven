'use client'

import { Activity, FileText, CheckCircle2, Archive } from 'lucide-react'

interface MarketingOverviewCardsProps {
  stats: {
    draft: number
    published: number
    ended: number
    total: number
  }
  totalRegistrations: number
}

export function MarketingOverviewCards({ stats, totalRegistrations }: MarketingOverviewCardsProps) {
  const cards = [
    {
      label: '進行中的活動',
      value: stats.published,
      icon: Activity,
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      iconColor: 'text-emerald-600',
    },
    {
      label: '草稿活動',
      value: stats.draft,
      icon: FileText,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      iconColor: 'text-blue-600',
    },
    {
      label: '已結束活動',
      value: stats.ended,
      icon: Archive,
      bgColor: 'bg-zinc-100',
      textColor: 'text-zinc-700',
      iconColor: 'text-zinc-600',
    },
    {
      label: '活動報名總人數',
      value: totalRegistrations,
      icon: CheckCircle2,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      iconColor: 'text-purple-600',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className={`rounded-2xl ${card.bgColor} border border-transparent p-4 transition-all hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-600">{card.label}</p>
                <p className={`mt-2 text-3xl font-bold ${card.textColor}`}>{card.value.toLocaleString()}</p>
              </div>
              <div className={`rounded-lg ${card.bgColor} p-2`}>
                <Icon className={`h-5 w-5 ${card.iconColor}`} aria-hidden />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
