'use client'

import Link from 'next/link'
import { Activity, AlertTriangle, CalendarCheck, CircleDollarSign, Coins, CreditCard, Gauge, Package, RadioTower, Ticket, TrendingUp, Users } from 'lucide-react'
import { BarChart, ChartCard, HBarChart, HeatmapChart, LineChart, PieChart, StatCard } from '@/components/common'

type Props = { data: any; days: number; courtId?: string; kpi: { bookings: number; activeCourts: number; rate: number | null; revenue: number; incidents: number }; incidents: { payment: number; notification: number; device: number; cancelled: number } }
const money = (n: number) => `NT$${n.toLocaleString()}`

export function OperationsDashboard({ data, days, courtId, kpi, incidents }: Props) {
  if (!data) return <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-12 text-center text-sm text-muted">尚無場館資料</div>
  const revenue = [{ label: '場地收入', value: data.revenue.court }, { label: '活動收入', value: data.revenue.event }, { label: '點數收入', value: data.revenue.topup }].filter((x) => x.value > 0)
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <StatCard label="今日預約" value={kpi.bookings} unit="筆" icon={<CalendarCheck className="h-5 w-5" />} color="green" description="幫助判斷今天的場館需求" />
      <StatCard label="目前使用場地" value={kpi.activeCourts} unit="面" icon={<Activity className="h-5 w-5" />} color="blue" description="確認目前是否有場地正在使用" />
      <StatCard label="今日使用率" value={kpi.rate ?? '—'} unit={kpi.rate === null ? '' : '%'} icon={<Gauge className="h-5 w-5" />} color="green" description="判斷今天是否需要調整營運安排" />
      <StatCard label="今日營收" value={money(kpi.revenue)} icon={<CircleDollarSign className="h-5 w-5" />} color="orange" description="快速了解今天的收入表現" />
      <StatCard label="異常數量" value={kpi.incidents} unit="件" icon={<AlertTriangle className="h-5 w-5" />} color={kpi.incidents ? 'red' : 'green'} description="優先查看目前需要處理的問題" />
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">{[12, 30, 90].map((n) => <Link key={n} href={`/admin/reports?days=${n}${courtId ? `&court=${courtId}` : ''}`} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${n === days ? 'bg-brand-100 text-brand-800' : 'bg-white text-muted ring-1 ring-zinc-200'}`}>近 {n} 天</Link>)}</div>
      <label className="flex items-center gap-2 text-xs text-muted">球場<select value={courtId ?? ''} onChange={(e) => { const q = new URLSearchParams(window.location.search); e.target.value ? q.set('court', e.target.value) : q.delete('court'); window.location.href = `/admin/reports?${q.toString()}` }} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800"><option value="">全部球場</option>{data.venue.courts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>

    <ChartCard title="球場使用率熱力圖" subtitle="深綠＝高使用率" description="找出高需求時段，作為排程與定價參考"><HeatmapChart data={data.heatmap} days={data.days.map((d: string) => d.slice(5).replace('-', '/'))} slots={data.slots.map((m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:00`)} height={Math.max(220, Math.min(360, data.days.length * 8))} /></ChartCard>
    <div className="grid gap-4 xl:grid-cols-2"><ChartCard title="球場使用率" description="觀察近期使用趨勢，判斷需求是否成長"><LineChart data={data.usage} unit="%" series="series-1" height={190} /></ChartCard><ChartCard title="尖峰／離峰分析" description="找出繁忙與空閒時段，協助安排優惠"><BarChart data={data.peak} unit="%" series="series-2" height={190} /></ChartCard></div>
    <div className="grid gap-4 xl:grid-cols-2"><ChartCard title="球場排行" description="找出熱門與低使用球場，協助調整場地策略"><HBarChart data={data.courts.map((c: any) => ({ label: c.name, value: c.rate }))} unit="%" /></ChartCard><ChartCard title="營收構成" subtitle={!data.productDataAvailable ? '商品收入資料尚未接入' : undefined} description="了解不同收入來源的貢獻比例"><PieChart data={revenue} height={190} /><div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">{revenue.map((x) => <span key={x.label}>{x.label} {money(x.value)}</span>)}{!data.productDataAvailable && <span className="text-zinc-400">商品收入 —</span>}</div></ChartCard></div>
    <section className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">異常狀態</h2><p className="mt-1 text-[11px] text-zinc-500">優先處理付款、通知、設備與取消問題</p></div><Link href="/admin/incidents" className="text-xs font-semibold text-brand-700 hover:underline">查看全部 →</Link></div><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[[CreditCard, '付款異常', incidents.payment, 'red'], [RadioTower, '通知失敗', incidents.notification, 'orange'], [Package, '設備異常', incidents.device, 'blue'], [Ticket, '預訂取消', incidents.cancelled, 'green']].map(([Icon, label, value, tone]: any) => <div key={label} className={`rounded-xl p-3 ${tone === 'red' ? 'bg-red-50 text-red-700' : tone === 'orange' ? 'bg-orange-50 text-orange-700' : tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}><Icon className="h-4 w-4" /><p className="mt-2 text-[11px] opacity-80">{label}</p><p className="mt-0.5 text-xl font-bold tabular">{value}</p></div>)}</div></section>
    <div className="flex flex-wrap gap-3 text-[11px] text-muted"><span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />資料依現有預約與付款紀錄計算</span><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />沒有資料時顯示空狀態，不填入假數據</span><span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5" />財務卡片沿用 finance 權限</span></div>
  </div>
}
