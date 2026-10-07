import Link from 'next/link'

export function PeriodTabs({ base, days, from, to }: { base: string; days: number; from: string; to: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      {[7, 30, 90].map((d) => (
        <Link key={d} href={`${base}?days=${d}`} className={`rounded-full px-3 py-1 ${days === d ? 'bg-brand-100 font-semibold text-brand-800' : 'bg-white ring-1 ring-zinc-200'}`}>
          近 {d} 天
        </Link>
      ))}
      <span className="text-xs text-muted">期間 {from}～{to}（Asia/Taipei）</span>
    </div>
  )
}
