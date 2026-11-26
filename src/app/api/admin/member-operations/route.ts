import { NextRequest, NextResponse } from 'next/server'
import { pagePermission } from '@/lib/admin-auth'
import { getOperationData } from '@/app/admin/reports/member-operations-data'
import type { OperationFilters } from '@/app/admin/reports/member-operations-types'

export async function POST(request: NextRequest) {
  try {
    const perm = await pagePermission('finance')
    if (perm === 'forbidden') {
      return NextResponse.json({ error: '無權限' }, { status: 403 })
    }

    const body = await request.json()

    const filters: OperationFilters = {
      theme: body.theme,
      range: body.range,
      venues: body.venues || [],
      memberTypes: body.memberTypes || [],
    }

    const data = await getOperationData(filters)
    return NextResponse.json(data)
  } catch (error) {
    console.error('會員經營 API 錯誤:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '伺服器錯誤' },
      { status: 500 },
    )
  }
}
