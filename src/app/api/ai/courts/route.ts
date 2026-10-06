import { NextResponse } from 'next/server'
import { getMockCourtInfo } from '@/lib/device-adapter'

export async function GET() {
  const court1 = getMockCourtInfo('court-1')
  const court2 = getMockCourtInfo('court-2')

  return NextResponse.json({
    courts: [court1, court2],
    timestamp: new Date(),
  })
}
