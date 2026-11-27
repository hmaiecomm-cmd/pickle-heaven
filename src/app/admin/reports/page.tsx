import type { Metadata } from 'next'
import { pagePermission } from '@/lib/admin-auth'
import { Forbidden, SourceNote } from '@/components/admin/page-bits'
import { getMemberInsightsData, parseMemberInsightsRange } from './member-insights-data'
import { MemberInsightsDashboard } from './member-insights-dashboard'
import { MockMemberInsightsData } from './member-demo-data'
import type { ChartKeyMember } from './member-insights-types'

export const metadata: Metadata = { title: '營收與會員成長洞察' }
export const dynamic = 'force-dynamic'

const CHARTS: ChartKeyMember[] = ['arpu', 'retention', 'conversion', 'ltv', 'cohort', 'lifecycle', 'revenue-by-segment', 'growth-rate', 'churn', 'engagement']

export default async function MemberInsightsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string; chart?: string; demo?: string }> }) {
  if ((await pagePermission('finance')) === 'forbidden') return <Forbidden />
  const sp = await searchParams

  // 全部改用 DEMO 範例資料
  const data = MockMemberInsightsData
  const isDemo = true
  const chart = CHARTS.includes(sp.chart as ChartKeyMember) ? (sp.chart as ChartKeyMember) : 'arpu'

  return (
    <div className="space-y-6">
      <MemberInsightsDashboard data={data} initialChart={chart} isDemo={isDemo} />
      <SourceNote source="會員、訂單與交易紀錄 (DEMO 範例資料)" basis="此頁面當前使用範例資料進行展示；會員營收＝期間內會員訂單實收；ARPU＝累計會員總收入÷累計會員數；留存率與轉化率依前期比較；時間以 Asia/Taipei" updatedAt={new Date()} />
    </div>
  )
}
