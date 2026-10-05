import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** 健康檢查：確認應用程式與資料庫連線正常 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, db: 'up', time: new Date().toISOString() })
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503 })
  }
}
