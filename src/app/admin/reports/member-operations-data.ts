'use server'
import { prisma } from '@/lib/db'
import type { OperationFilters, OperationData, OperationKpis, MemberKpi } from './member-operations-types'
import { assignMemberLabel } from './member-labels'
import { calculateDateRange, calculatePrevRange } from './operation-utils'
import { getRecommendationForTheme } from './member-operations-recommendations'

function calculateKpi(current: number, prev: number): MemberKpi {
  const change = prev !== 0 ? ((current - prev) / prev) * 100 : 0
  return { value: current, prev, change, trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable' }
}

// 根據營運痛點返回對應的 mock KPI
function getKpisForTheme(theme: string): OperationKpis {
  const baseKpis: OperationKpis = {
    communicableMembers: calculateKpi(100, 95),
    lineBindRate: calculateKpi(75, 70),
    active30d: calculateKpi(45, 42),
    highFreqCasual: calculateKpi(12, 10),
    prepaidMembers: calculateKpi(28, 25),
    cardExpiring14d: calculateKpi(5, 4),
    dormantMembers: calculateKpi(18, 20),
    organizerMembers: calculateKpi(8, 7),
  }

  // 根據痛點調整特定 KPI（模擬真實數據）
  switch (theme) {
    case 'off-peak-fill':
      return { ...baseKpis, active30d: calculateKpi(35, 42) }
    case 'casual-to-prepay':
      return { ...baseKpis, highFreqCasual: calculateKpi(18, 10), prepaidMembers: calculateKpi(22, 25) }
    case 'card-renewal':
      return { ...baseKpis, cardExpiring14d: calculateKpi(8, 4) }
    case 'dormant-recovery':
      return { ...baseKpis, dormantMembers: calculateKpi(25, 20) }
    case 'organizer-analysis':
      return { ...baseKpis, organizerMembers: calculateKpi(12, 7) }
    case 'noshowm-manage':
      return { ...baseKpis, active30d: calculateKpi(40, 42) }
    default:
      return baseKpis
  }
}

export async function getOperationData(filters: OperationFilters): Promise<OperationData> {
  const { from, to } = calculateDateRange(filters.range.days)
  const prevRange = calculatePrevRange(from, to)

  try {
    const recommendation = getRecommendationForTheme(filters.theme)
    const kpis = getKpisForTheme(filters.theme)

    // 生成對應痛點的會員推薦
    const memberList = generateMemberRecommendations(filters.theme, filters.range.days)

    return {
      filters,
      hasData: true,
      summary: {
        theme: filters.theme,
        range: filters.range,
        kpis,
        estimatedRevenue: calculateEstimatedRevenue(filters.theme)
      },
      dailyActions: [{
        priority: 'high',
        title: recommendation.suggestedActions[0] || '會員推播行動',
        targetCount: memberList.length,
        members: memberList
      }],
      memberList: memberList,
      recommendation: {
        theme: filters.theme,
        currentStatus: recommendation.currentStatus,
        possibleCauses: recommendation.possibleCauses,
        suggestedActions: recommendation.suggestedActions,
        suggestedPromotions: recommendation.suggestedPromotions,
        targetMembers: recommendation.targetMembers,
        trackedMetrics: recommendation.trackedMetrics
      }
    }
  } catch (error) {
    console.error('數據查詢失敗:', error)
    throw error
  }
}

function generateMemberRecommendations(theme: string, days: number): any[] {
  const recommendations: Record<string, any[]> = {
    'off-peak-fill': [
      { userId: 'M001', name: '張小明', labels: { preferences: ['weekday-evening'], status: [] }, triggerReason: '近 30 天曾在下午消費', suggestedAction: '推送下午 75 折優惠' },
      { userId: 'M002', name: '李美麗', labels: { preferences: ['weekday-evening'], status: [] }, triggerReason: '常在晚間消費，可推薦下午時段', suggestedAction: '推送早晚雙場套票' },
    ],
    'casual-to-prepay': [
      { userId: 'M003', name: '王大衛', labels: { preferences: ['weekend-morning'], status: [] }, triggerReason: '近 30 天消費 4 次，高頻臨打客', suggestedAction: '推送儲值 3,000 加贈 500 方案' },
      { userId: 'M004', name: '陳佳佳', labels: { preferences: ['weekend-evening'], status: [] }, triggerReason: '近 30 天消費 3 次，轉換潛力高', suggestedAction: '推送首次儲值優惠' },
    ],
    'card-renewal': [
      { userId: 'M005', name: '黃小芬', labels: { identity: 'seasonal', preferences: [], status: ['card-expiring'] }, triggerReason: '季卡即將於 7 天後到期', suggestedAction: '推送 9 折續約優惠' },
      { userId: 'M006', name: '賴大明', labels: { identity: 'seasonal', preferences: [], status: ['card-expiring'] }, triggerReason: '季卡已過期，可推送復活方案', suggestedAction: '推送限時復活優惠' },
    ],
    'dormant-recovery': [
      { userId: 'M007', name: '高小涵', labels: { preferences: ['weekday-morning'], status: ['dormant'] }, triggerReason: '45 天未消費，常在早晨活動', suggestedAction: '推送早晨時段個人化優惠' },
      { userId: 'M008', name: '林小傑', labels: { preferences: ['weekend-evening'], status: ['dormant'] }, triggerReason: '30 天未消費，過去是高頻用戶', suggestedAction: '推送專屬重啟優惠' },
    ],
    'organizer-analysis': [
      { userId: 'M009', name: '何主揪', labels: { identity: 'organizer', preferences: [], status: [] }, triggerReason: '近 30 天帶客 5 人，主揪會員', suggestedAction: '邀請加入 VIP 社群，提供帶客獎勵' },
      { userId: 'M010', name: '詹大組', labels: { identity: 'organizer', preferences: [], status: [] }, triggerReason: '長期帶客 3+ 人，穩定主揪', suggestedAction: '提供優先訂場權與獎勵' },
    ],
    'noshowm-manage': [
      { userId: 'M011', name: '郭沒有', labels: { preferences: [], status: ['high-noshow'] }, triggerReason: '近 30 天 No-show 率 50%', suggestedAction: '發送預約提醒政策說明，要求預付款' },
      { userId: 'M012', name: '邱臨時', labels: { preferences: [], status: ['high-cancel'] }, triggerReason: '近 30 天取消率 40%', suggestedAction: '發送溫和提醒，推送守時獎勵方案' },
    ]
  }

  return recommendations[theme as keyof typeof recommendations] || []
}

function calculateEstimatedRevenue(theme: string): number {
  const estimates: Record<string, number> = {
    'off-peak-fill': 15000,
    'casual-to-prepay': 12000,
    'card-renewal': 18000,
    'dormant-recovery': 8000,
    'organizer-analysis': 20000,
    'noshowm-manage': 5000,
    'line-binding': 3000,
    'retention': 10000,
    'high-value': 25000,
    'member-segmentation': 30000
  }

  return estimates[theme] || 10000
}
