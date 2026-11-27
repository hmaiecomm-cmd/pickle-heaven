import { CalendarDays, ChevronRight, Coins, LayoutDashboard, Package, ReceiptText, Ticket, Trophy, UserRound, Users, ShoppingBag } from 'lucide-react'

const groups = [
  { label: '訂單總覽', icon: LayoutDashboard },
  { label: '預約訂單', icon: CalendarDays },
  { label: '活動預約訂單', icon: Users },
  { label: '商品訂單', icon: ShoppingBag },
  { label: '點數與票券', icon: Coins },
]

const options = [
  {
    title: '版本 A｜清楚分層型',
    description: '左側先放「訂單總覽」，下面直接列出四類訂單。資訊層級最直覺，適合第一次使用的會員。',
    active: 0,
    note: '推薦：辨識最快、最接近目前頁面的使用習慣',
  },
  {
    title: '版本 B｜訂單中心型',
    description: '以「訂單」作為左側主標題，四類內容縮排在下方；點數與票券以獨立服務區呈現。',
    active: 1,
    note: '特色：更像會員中心，適合未來增加更多交易類型',
  },
  {
    title: '版本 C｜圖示導向型',
    description: '四大項採較大的圖示卡片，左側導覽更有視覺辨識度；適合手機與平板觸控操作。',
    active: 3,
    note: '特色：視覺最明顯、操作目標較大',
  },
]

function Sidebar({ variant, active }: { variant: number; active: number }) {
  return (
    <aside className={`w-[214px] shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${variant === 2 ? 'p-2' : ''}`}>
      <div className="mb-4 flex items-center gap-2 px-2 pt-1">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><ReceiptText className="h-4 w-4" /></div>
        <div><p className="text-xs font-semibold text-slate-900">我的訂單</p><p className="text-[10px] text-slate-400">交易與權益管理</p></div>
      </div>
      {variant === 1 && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">訂單中心</p>}
      <nav className="space-y-1">
        {groups.map((item, i) => {
          const Icon = item.icon
          const selected = i === active
          return <div key={item.label} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-medium ${selected ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'text-slate-500'} ${variant === 2 ? 'flex-col gap-1.5 text-center px-1 py-3.5' : ''}`}><Icon className={variant === 2 ? 'h-5 w-5' : 'h-4 w-4'} /><span>{item.label}</span>{selected && variant !== 2 && <ChevronRight className="ml-auto h-3.5 w-3.5" />}</div>
        })}
      </nav>
      <div className="mt-6 border-t border-slate-100 pt-3"><div className="flex items-center gap-3 px-3 py-2 text-xs text-slate-500"><UserRound className="h-4 w-4" />個人資料</div></div>
    </aside>
  )
}

function MainContent({ variant }: { variant: number }) {
  const title = variant === 0 ? '訂單總覽' : variant === 1 ? '預約訂單' : '商品訂單'
  return <main className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-[11px] font-medium text-emerald-600">我的訂單</p><h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{title}</h3><p className="mt-1 text-xs text-slate-500">延續目前「訂單／活動」頁面的卡片與狀態呈現</p></div><div className="rounded-xl bg-emerald-50 px-3 py-2 text-right"><p className="text-[10px] text-emerald-600">近期訂單</p><p className="text-lg font-bold text-emerald-700">3 筆</p></div></div><div className="mt-4 space-y-2"><div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><CalendarDays className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">PH-20261117-K7Q2</p><p className="mt-1 text-[11px] text-slate-500">11/24・場地 2 時段・已付款</p></div><span className="text-xs font-semibold text-slate-800">NT$1,200</span><ChevronRight className="h-4 w-4 text-slate-300" /></div><div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-amber-50 text-amber-700"><Ticket className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">活動體驗場・週末場</p><p className="mt-1 text-[11px] text-slate-500">12/01・2 位・已報名</p></div><span className="text-xs font-semibold text-slate-800">NT$600</span><ChevronRight className="h-4 w-4 text-slate-300" /></div></div><div className="mt-5 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500"><span className="font-semibold text-slate-700">行為說明：</span>點擊左側分頁後，內容區只顯示該類型，不在頁面內重複出現四個分頁。</div></main>
}

export default function OrderTabsPreviewPage() {
  return <div className="min-h-screen bg-[#f6f8f7] px-5 py-10 text-slate-900"><div className="mx-auto max-w-6xl"><div className="mb-8"><p className="text-xs font-semibold tracking-[0.18em] text-emerald-700">DESIGN REVIEW</p><h1 className="mt-2 text-2xl font-bold tracking-tight">訂單記錄・左側四大項分頁方案</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">請先比較以下三個版本。確認後，我再把選定方案套用到正式帳戶頁；票券頁的既有行為會維持不變。</p></div><div className="grid gap-6 lg:grid-cols-3">{options.map((option, index) => <section key={option.title} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"><div className="mb-4"><h2 className="text-sm font-bold">{option.title}</h2><p className="mt-1 min-h-10 text-xs leading-5 text-slate-500">{option.description}</p><p className="mt-3 rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] font-medium text-emerald-700">{option.note}</p></div><div className="flex min-h-[390px] gap-3"><Sidebar variant={index} active={option.active} /><MainContent variant={index} /></div></section>)}</div><div className="mt-8 flex flex-wrap gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><Package className="h-4 w-4" />四類訂單從左側進入</span><span className="inline-flex items-center gap-2"><Ticket className="h-4 w-4" />票券行為維持原樣</span><span className="inline-flex items-center gap-2"><Trophy className="h-4 w-4" />保留既有品牌視覺</span></div></div></div>
}
