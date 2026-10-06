import { NextResponse } from 'next/server'
import { getMockAIEvents } from '@/lib/device-adapter'

export async function GET() {
  const events = getMockAIEvents()

  return NextResponse.json({
    events,
    unresolved: events.filter((e) => !e.resolved).length,
    timestamp: new Date(),
  })
}

export async function PATCH(request: Request) {
  const { eventId, resolved } = await request.json()

  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })
  }

  // In mock mode, just return success
  return NextResponse.json({
    success: true,
    eventId,
    resolved,
    timestamp: new Date(),
  })
}
