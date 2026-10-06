import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { bookingId, courtId, expiresIn = 3600 } = await request.json()

  if (!bookingId || !courtId) {
    return NextResponse.json({ error: 'Missing bookingId or courtId' }, { status: 400 })
  }

  // Generate mock QR code
  const qrCode = {
    id: `qr-${Date.now()}`,
    bookingId,
    courtId,
    code: `${bookingId}-${Math.random().toString(36).substring(7).toUpperCase()}`,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    createdAt: new Date(),
    status: 'active',
  }

  return NextResponse.json(qrCode)
}
