import Link from 'next/link'
import { Ban, Construction } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageTitle({ title, desc, right }: { title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  )
}

/** 尚未建置或未串接的功能：明確說明，不提供假操作 */
export function NotOpen({ title, reason, needs, links }: { title: string; reason: string; needs?: string[]; links?: { href: string; label: string }[] }) {
  return (
    <div>
      <PageTitle title={title} />
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6">
        <p className="flex items-center gap-2 font-semibold text-zinc-800">
          <Construction className="h-5 w-5 text-amber-600" aria-hidden />
          此功能尚未開放
        </p>
        <p className="mt-2 text-sm text-zinc-600">{reason}</p>
        {needs && needs.length > 0 && (
          <>
            <p className="mt-4 text-sm font-semibold">開放前需要</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-600">
              {needs.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
        {links && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="font-semibold text-brand-700 hover:underline">
                {l.label} →
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Forbidden() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
      <Ban className="mx-auto h-8 w-8 text-zinc-400" aria-hidden />
      <p className="mt-3 font-semibold">目前帳號沒有這個頁面的權限</p>
      <p className="mt-1 text-sm text-muted">如需使用，請洽場館擁有者調整權限。</p>
    </div>
  )
}

export function SourceNote({ source, updatedAt, basis, className }: { source: string; updatedAt?: string | Date | null; basis?: string; className?: string }) {
  const at = updatedAt ? new Date(updatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : null
  return (
    <p className={cn('text-[11px] text-muted', className)}>
      資料來源：{source}
      {basis ? `・計算口徑：${basis}` : ''}
      ・時區 Asia/Taipei{at ? `・更新於 ${at}` : ''}
    </p>
  )
}

const TONES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  gray: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
} as const

export function Pill({ tone = 'gray', children, className }: { tone?: keyof typeof TONES; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TONES[tone], className)}>{children}</span>
}
