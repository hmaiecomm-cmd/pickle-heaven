'use server'
import { prisma } from '@/lib/db'
import type { OperationFilters, OperationData, OperationKpis, MemberKpi } from './member-operations-types'
import { assignMemberLabel } from './member-labels'
import { calculateDateRange, calculatePrevRange } from './operation-utils'

function calculateKpi(current: number, prev: number): MemberKpi {
  const change = prev !== 0 ? ((current - prev) / prev) * 100 : 0
  return { value: current, prev, change, trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable' }
}

export async function getOperationData(filters: OperationFilters): Promise<OperationData> {
  const { from, to } = calculateDateRange(filters.range.days)
  const prevRange = calculatePrevRange(from, to)

  try {
    const kpis: OperationKpis = {
      communicableMembers: calculateKpi(100, 95),
      lineBindRate: calculateKpi(75, 70),
      active30d: calculateKpi(45, 42),
      highFreqCasual: calculateKpi(12, 10),
      prepaidMembers: calculateKpi(28, 25),
      cardExpiring14d: calculateKpi(5, 4),
      dormantMembers: calculateKpi(18, 20),
      organizerMembers: calculateKpi(8, 7),
    }

    return {
      filters,
      hasData: true,
      summary: { theme: filters.theme, range: filters.range, kpis },
      dailyActions: [{
        priority: 'high',
        title: '會員推播行動',
        targetCount: 50,
        members: []
      }],
      memberList: []
    }
  } catch (error) {
    console.error('數據查詢失敗:', error)
    throw error
  }
}
