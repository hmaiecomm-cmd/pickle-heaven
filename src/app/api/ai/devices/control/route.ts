import { NextResponse } from 'next/server'
import { controlDevice } from '@/lib/device-adapter'

export async function POST(request: Request) {
  const { deviceId, action } = await request.json()

  if (!deviceId || !action) {
    return NextResponse.json({ error: 'Missing deviceId or action' }, { status: 400 })
  }

  try {
    const success = await controlDevice(deviceId, action)
    return NextResponse.json({
      success,
      deviceId,
      action,
      timestamp: new Date(),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
